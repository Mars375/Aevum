import { createServer, type IncomingMessage } from "node:http";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  CampaignSchema,
  replayCampaign,
  stateSignature,
  type Campaign,
} from "../packages/world/src/campaign.js";
import {
  resolveCouncil,
  incidentFor,
  activeCiv,
} from "../packages/world/src/spectator.js";
import { campaignSummary } from "../packages/world/src/campaign-summary.js";
import { defaultCouncilModels } from "../packages/agents/src/default-models.js";
import { requestValidatedCouncil } from "../packages/agents/src/council-review.js";
import { atomicWrite, lockWorld, reclaimStaleLock } from "./world-storage.js";
import { ENDPOINTS } from "../packages/agents/src/endpoints.js";
import { loadWindowsNousEnvironment } from "./windows-env.js";

/**
 * Le port du service, 5174 par defaut.
 *
 * Il etait fige. Une copie empaquetee ne pouvait donc ni cohabiter avec une
 * instance deja lancee, ni etre demarree pour verification sans prendre la
 * place de celle de l'utilisateur : un conflit de port transformait le
 * demarrage en un clic en echec sans recours.
 */
export const SERVICE_PORT = (() => {
  const raw = Number(process.env.AEVUM_PORT);
  return Number.isInteger(raw) && raw > 0 && raw < 65536 ? raw : 5174;
})();

const CreateSchema = z
  .object({
    seed: z.number().int().min(0).max(2147483647),
    mode: z.enum(["local", "remote"]),
    models: z.record(z.string().trim().max(180)).default({}),
    maxTurns: z.number().int().min(12).max(300).optional(),
  })
  .strict();
const StepSchema = z.object({ turn: z.number().int().nonnegative() }).strict();
async function body(req: IncomingMessage) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 32768)
      throw new Error("Requête trop volumineuse");
  }
  return JSON.parse(text || "{}");
}
/**
 * Ou vivent les parties, qui n est pas forcement ou vit l application.
 *
 * Une copie empaquetee gardait ses campagnes dans son propre dossier. Mettre
 * a jour l application, c est-a-dire remplacer ce dossier, effacait donc les
 * parties enregistrees : le critere « mises a jour et sauvegardes preservees »
 * etait perdu par construction. AEVUM_DATA les sort de l installation. Sans
 * lui, rien ne change pour le depot ni pour les tests.
 */
export const dataRoot = () => process.env.AEVUM_DATA?.trim() || process.cwd();

export function createSpectatorServer(
  directory = resolve(dataRoot(), "worlds/spectator"),
  env: NodeJS.ProcessEnv = process.env,
) {
  const busy = new Set<string>(),
    errors = new Map<string, string>();
  const replays = new Map<
    string,
    { key: string; value: ReturnType<typeof replayCampaign> }
  >();
  const replay = (campaign: Campaign) => {
    const key = createHash("sha256")
      .update(JSON.stringify([campaign.seed, campaign.turns]))
      .digest("hex");
    const cached = replays.get(campaign.id);
    if (cached?.key === key) return cached.value;
    const value = replayCampaign(campaign);
    replays.set(campaign.id, { key, value });
    while (replays.size > 3) replays.delete(replays.keys().next().value!);
    return value;
  };
  const path = (id: string) => resolve(directory, `${id}.json`);
  const load = (id: string) =>
    CampaignSchema.parse(JSON.parse(readFileSync(path(id), "utf8")));
  const save = (campaign: Campaign) =>
    atomicWrite(
      path(campaign.id),
      JSON.stringify(CampaignSchema.parse(campaign), null, 2),
    );
  async function advance(campaign: Campaign) {
    const id = campaign.id;
    try {
      const { state } = replay(campaign);
      if (state.world.civs.filter((c) => c.fellOnTick === null).length < 2)
        throw new Error("La partie est terminée");
      campaign.pending ??= { turn: state.world.tick, answers: [] };
      save(campaign);
      const current = ["spectator-4", "spectator-5", "spectator-6", "spectator-7", "spectator-8", "spectator-9"].includes(
        state.rules,
      )
        ? activeCiv(state)
        : null;
      // Persist every answer; an interrupted process resumes only missing rulers.
      const collected = await Promise.allSettled(
        state.world.civs
          .filter(
            (c) =>
              c.fellOnTick === null && (current === null || c.id === current),
          )
          .sort((a, b) => a.id.localeCompare(b.id))
          .map(async (civ) => {
            if (campaign.pending!.answers.some((a) => a.civ === civ.id)) return;
            const answer = await requestValidatedCouncil(
              state,
              civ.id,
              campaign.mode,
              campaign.models[civ.id] ?? "",
              env,
            );
            campaign.pending!.answers.push(answer);
            save(campaign);
          }),
      );
      if (collected.some((result) => result.status === "rejected"))
        throw new Error("Council checkpoint failed");
      campaign.pending.answers.sort((a, b) => a.civ.localeCompare(b.civ));
      const answers = campaign.pending.answers;
      if (
        ["spectator-4", "spectator-5", "spectator-6", "spectator-7", "spectator-8", "spectator-9"].includes(state.rules) &&
        answers.some((a) => a.source === "unavailable")
      ) {
        // Retry the same ruler on the next click; do not skip a failed AI turn.
        campaign.pending = null;
        save(campaign);
        errors.set(
          id,
          answers.find((a) => a.error)?.error ??
            "Le dirigeant n'a pas répondu. Réessayez son tour.",
        );
        return;
      }
      const result = resolveCouncil(
        state,
        answers.flatMap((a) => (a.decision ? [a.decision] : [])),
      );
      campaign.turns.push({
        turn: state.world.tick,
        answers,
        signature: stateSignature(result.state),
      });
      campaign.pending = null;
      save(campaign);
      errors.delete(id);
    } catch {
      errors.set(
        id,
        "Le tour n'a pas été terminé. Les réponses sauvegardées seront reprises à la prochaine tentative.",
      );
    } finally {
      busy.delete(id);
    }
  }
  return createServer(async (req, res) => {
    const send = (status: number, value: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    // Local service only. Reject foreign browser origins, including null origins.
    const origin = req.headers.origin;
    // 5173 est le serveur de developpement Vite ; SERVICE_PORT est celui
    // d'ici, et il n'est pas toujours 5174 : une copie empaquetee doit
    // pouvoir se decaler.
    const allowed = new RegExp(
      `^http://(127\\.0\\.0\\.1|localhost):(5173|${SERVICE_PORT})$`,
    );
    if (origin && !allowed.test(origin)) {
      send(403, { error: "Origine non autorisée" });
      return;
    }
    if (!/^(127\.0\.0\.1|localhost):\d{1,5}$/.test(req.headers.host ?? "")) {
      send(403, { error: "Hôte non autorisé" });
      return;
    }
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1:5174");
      if (req.method === "GET" && url.pathname === "/api/health") {
        send(200, { application: "aevum", ready: true });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/demo") {
        const demo = CampaignSchema.parse(
          JSON.parse(
            readFileSync(resolve("examples/nous-discovery.json"), "utf8"),
          ),
        );
        const id = "nous-discovery";
        if (!existsSync(path(id))) {
          replayCampaign(demo);
          save({ ...demo, id, maxTurns: demo.turns.length });
        }
        send(200, { id });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/campaigns") {
        const campaigns = existsSync(directory)
          ? readdirSync(directory)
              .filter((f) => /^[a-z0-9-]+\.json$/.test(f))
              .flatMap((f) => {
                try {
                  const c = load(f.slice(0, -5));
                  return [
                    {
                      id: c.id,
                      seed: c.seed,
                      mode: c.mode,
                      turn: c.turns.length,
                    },
                  ];
                } catch {
                  return [];
                }
              })
          : [];
        send(200, {
          campaigns,
          defaultModels: defaultCouncilModels(env),
          providers: [
            ...Object.entries(ENDPOINTS).map(([id, e]) => ({
              id,
              configured: !!env[e.keyEnv],
            })),
            { id: "nous", configured: !!env.NOUS_API_KEY },
          ],
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/campaigns") {
        const options = CreateSchema.parse(await body(req));
        if (options.mode === "remote") {
          const defaults = defaultCouncilModels(env);
          for (const civ of ["amber", "azure", "crimson", "verdant"] as const)
            if (!options.models[civ]) options.models[civ] = defaults[civ];
        }
        if (
          options.mode === "remote" &&
          ["amber", "azure", "crimson", "verdant"].some(
            (id) => !options.models[id],
          )
        ) {
          send(400, {
            error: "Choisir un modèle pour chacun des quatre dirigeants",
          });
          return;
        }
        const campaign: Campaign = {
          version: "spectator-9",
          id: randomUUID(),
          ...options,
          turns: [],
          pending: null,
        };
        save(campaign);
        send(201, { id: campaign.id });
        return;
      }
      const match =
        /^\/api\/campaigns\/([a-z0-9-]{1,80})(?:\/(step|export))?$/.exec(
          url.pathname,
        );
      if (match) {
        const id = match[1]!;
        if (!existsSync(path(id))) {
          send(404, { error: "Partie introuvable" });
          return;
        }
        const campaign = load(id);
        if (req.method === "GET") {
          if (match[2] === "export") {
            send(200, campaign);
            return;
          }
          if (match[2]) {
            send(405, { error: "Méthode non autorisée" });
            return;
          }
          const restored = replay(campaign);
          send(200, {
            campaign,
            ...restored,
            busy: busy.has(id),
            error: errors.get(id) ?? null,
            nextIncident: incidentFor(
              campaign.seed,
              ["spectator-4", "spectator-5", "spectator-6", "spectator-7", "spectator-8", "spectator-9"].includes(
                restored.state.rules,
              )
                ? (restored.state.sequence?.round ?? 1) - 1
                : restored.state.world.tick,
            ),
          });
          return;
        }
        if (req.method === "POST" && match[2] === "step") {
          const options = StepSchema.parse(await body(req));
          if (options.turn !== campaign.turns.length) {
            send(409, {
              error: "Ce tour a déjà été avancé. Actualisez la partie.",
            });
            return;
          }
          if (busy.has(id)) {
            send(202, { busy: true });
            return;
          }
          if (campaignSummary(campaign, replay(campaign).state).finished) {
            send(409, {
              error:
                "Cette campagne est terminée. Consultez le bilan ou lancez un nouveau monde.",
            });
            return;
          }
          if (
            campaign.turns.length >=
            (["spectator-4", "spectator-5", "spectator-6", "spectator-7", "spectator-8", "spectator-9"].includes(
              campaign.version,
            )
              ? 1200
              : 1000)
          ) {
            send(409, { error: "Limite de 1000 tours atteinte" });
            return;
          }
          busy.add(id);
          void advance(campaign);
          send(202, { busy: true });
          return;
        }
      }
      if (url.pathname.startsWith("/api/")) {
        send(404, { error: "Route inconnue" });
        return;
      }
      if (req.method !== "GET") {
        send(405, { error: "Méthode non autorisée" });
        return;
      }
      const root = resolve("apps/player/dist"),
        file = resolve(root, `.${decodeURIComponent(url.pathname)}`);
      if (file !== root && !file.startsWith(root + sep)) {
        send(403, { error: "Chemin interdit" });
        return;
      }
      const actual = url.pathname === "/" ? resolve(root, "index.html") : file;
      if (!existsSync(actual)) {
        send(404, { error: "Fichier absent. Exécutez npm run player:build." });
        return;
      }
      const types: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".glb": "model/gltf-binary",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
      };
      res.writeHead(200, {
        "Content-Type": types[extname(actual)] ?? "application/octet-stream",
      });
      res.end(readFileSync(actual));
    } catch {
      if (!res.headersSent)
        send(400, { error: "Données invalides ou sauvegarde illisible" });
      else res.end();
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (existsSync(".env")) process.loadEnvFile(".env");
  loadWindowsNousEnvironment();
  const lockPath = resolve(dataRoot(), "worlds/spectator/server.lock");
  // Fermer la fenetre du lanceur tue ce processus sans lui laisser liberer
  // son verrou. On le reprend quand son proprietaire est mort, et on le dit.
  if (reclaimStaleLock(lockPath))
    console.log(
      "Verrou repris : le serveur precedent a ete ferme sans arret propre.",
    );
  const release = lockWorld(lockPath);
  const server = createSpectatorServer();
  process.once("exit", release);
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => server.close(() => process.exit(0)));
  server.listen(SERVICE_PORT, "127.0.0.1", () =>
    console.log(
      `Observatoire : http://127.0.0.1:${SERVICE_PORT} (API locale ; npm run player:build pour le site)`,
    ),
  );
}

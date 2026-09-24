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
  atLeast,
  SPECTATOR_RULES,
} from "../packages/world/src/spectator.js";
import { campaignSummary } from "../packages/world/src/campaign-summary.js";
import { defaultCouncilModels } from "../packages/agents/src/default-models.js";
import { requestValidatedCouncil } from "../packages/agents/src/council-review.js";
import { atomicWrite, lockWorld, reclaimStaleLock } from "./world-storage.js";
import { ENDPOINTS } from "../packages/agents/src/endpoints.js";
import { STABLE_FREE_MODELS } from "../packages/agents/src/stable-models.js";
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
const LiveSchema = z.object({ live: z.boolean() }).strict();

/**
 * Les règles d'une partie neuve : les dernières, lues dans la liste.
 *
 * Écrites en clair, elles étaient restées à `spectator-9` pendant qu'on livrait
 * la diplomatie en `spectator-10` : aucune partie lancée depuis l'observatoire
 * ne l'activait, et rien ne le signalait.
 */
export const CURRENT_RULES = SPECTATOR_RULES[SPECTATOR_RULES.length - 1]!;

/**
 * Le rythme d'une partie en direct.
 *
 * Distant : un tour toutes les 18 s au plus. Kilo, qui sert le modèle par
 * défaut sans clé, accepte 200 requêtes par heure pour toute l'adresse IP ;
 * un tour en coûte une, parfois deux avec la correction. La partie de 480
 * tours jouée d'une traite en a consommé environ 170 par heure.
 * Local : une seconde et demie, le temps de voir un tour avant le suivant.
 *
 * Un dirigeant qui ne répond pas est redemandé — jamais remplacé : 2 s, puis
 * 30, 60, 120 s, comme la sonde de campagne. Au dixième échec d'affilée,
 * une quinzaine de minutes, le direct se suspend et dit pourquoi.
 */
export interface LiveTiming {
  remotePaceMs: number;
  localPaceMs: number;
  backoffMs: readonly number[];
  maxFailures: number;
}
export const LIVE_TIMING: LiveTiming = {
  remotePaceMs: 18_000,
  localPaceMs: 1_500,
  backoffMs: [2_000, 30_000, 60_000, 120_000],
  maxFailures: 10,
};
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
  timing: LiveTiming = LIVE_TIMING,
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
      const current = atLeast(state.rules, "spectator-4")
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
        atLeast(state.rules, "spectator-4") &&
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

  /**
   * Les parties en direct : le serveur les joue seul, page ouverte ou non.
   *
   * Les « tours automatiques » vivaient dans la page : fermer l'onglet arrêtait
   * la partie, et le premier dirigeant sans réponse aussi. La liste est écrite
   * sur disque, pour qu'un redémarrage reprenne le direct là où il était.
   */
  interface Live {
    failures: number;
    nextAt: number;
    timer: ReturnType<typeof setTimeout> | null;
    stopped: string | null;
  }
  const live = new Map<string, Live>();
  const liveFile = resolve(directory, ".live.json");
  let closed = false;
  const persistLive = () => {
    if (closed) return;
    atomicWrite(
      liveFile,
      JSON.stringify(
        [...live].filter(([, entry]) => !entry.stopped).map(([id]) => id),
      ),
    );
  };
  const liveStatus = (id: string) => {
    const entry = live.get(id);
    return entry
      ? {
          on: !entry.stopped,
          failures: entry.failures,
          nextAt: entry.stopped ? null : entry.nextAt,
          stopped: entry.stopped,
        }
      : { on: false, failures: 0, nextAt: null, stopped: null };
  };
  const schedule = (id: string, delay: number) => {
    const entry = live.get(id);
    if (!entry || entry.stopped || closed) return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.nextAt = Date.now() + delay;
    entry.timer = setTimeout(() => void playLive(id), delay);
    entry.timer.unref?.();
  };
  const stopLive = (id: string, reason: string | null) => {
    const entry = live.get(id);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    if (reason) entry.stopped = reason;
    else live.delete(id);
    persistLive();
  };
  async function playLive(id: string) {
    const entry = live.get(id);
    if (!entry || entry.stopped || closed) return;
    entry.timer = null;
    if (!existsSync(path(id))) return stopLive(id, "Partie introuvable");
    if (busy.has(id)) return schedule(id, 1_000);
    let campaign: Campaign;
    try {
      campaign = load(id);
    } catch {
      return stopLive(id, "Sauvegarde illisible");
    }
    const { state } = replay(campaign);
    const cap = atLeast(campaign.version, "spectator-4") ? 1200 : 1000;
    if (
      campaignSummary(campaign, state).finished ||
      campaign.turns.length >= cap
    )
      return stopLive(id, "Partie terminée");
    const started = Date.now();
    const before = campaign.turns.length;
    busy.add(id);
    await advance(campaign);
    if (live.get(id) !== entry || entry.stopped || closed) return;
    if (campaign.turns.length > before) {
      entry.failures = 0;
      const pace =
        campaign.mode === "remote" ? timing.remotePaceMs : timing.localPaceMs;
      return schedule(id, Math.max(0, pace - (Date.now() - started)));
    }
    entry.failures++;
    if (entry.failures >= timing.maxFailures)
      return stopLive(
        id,
        `Direct suspendu après ${entry.failures} essais sans réponse : ${errors.get(id) ?? "le dirigeant n'a pas répondu"}`,
      );
    schedule(
      id,
      timing.backoffMs[Math.min(entry.failures, timing.backoffMs.length) - 1] ??
        0,
    );
  }
  const startLive = (id: string) => {
    const previous = live.get(id);
    if (previous && !previous.stopped) return;
    if (previous?.timer) clearTimeout(previous.timer);
    live.set(id, {
      failures: 0,
      nextAt: Date.now(),
      timer: null,
      stopped: null,
    });
    errors.delete(id);
    persistLive();
    schedule(id, 0);
  };
  // Reprendre le direct après un redémarrage : fermer le lanceur ne doit pas
  // interrompre une partie qu'on regardait.
  try {
    if (existsSync(liveFile))
      for (const id of z
        .array(z.string().regex(/^[a-z0-9-]{1,80}$/))
        .parse(JSON.parse(readFileSync(liveFile, "utf8"))))
        if (existsSync(path(id))) startLive(id);
  } catch {
    // Une liste illisible ne vaut pas un serveur qui refuse de démarrer.
  }

  const server = createServer(async (req, res) => {
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
          // Les modèles retenus, proposés dans le formulaire : seuls ceux
          // qu'on peut appeler ici, clé posée ou sans clé.
          stableModels: STABLE_FREE_MODELS.filter(
            (model) => !model.key || !!env[model.key],
          ).map(({ ref, role }) => ({ ref, role })),
          providers: [
            ...Object.entries(ENDPOINTS).map(([id, e]) => ({
              id,
              // Kilo sert ses modeles gratuits sans cle : il est disponible
              // meme non configure.
              configured: !!env[e.keyEnv] || !!e.anonymousFree,
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
          version: CURRENT_RULES,
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
        /^\/api\/campaigns\/([a-z0-9-]{1,80})(?:\/(step|export|live|head))?$/.exec(
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
          // Ce que la page interroge toutes les secondes et demie : de quoi
          // savoir si la partie a bougé, sans la rejouer. Elle suit ainsi une
          // partie jouée en direct ici comme par un autre processus.
          if (match[2] === "head") {
            send(200, {
              turns: campaign.turns.length,
              pending: campaign.pending?.answers.length ?? null,
              busy: busy.has(id),
              error: errors.get(id) ?? null,
              live: liveStatus(id),
            });
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
            live: liveStatus(id),
            nextIncident: incidentFor(
              campaign.seed,
              atLeast(restored.state.rules, "spectator-4")
                ? (restored.state.sequence?.round ?? 1) - 1
                : restored.state.world.tick,
            ),
          });
          return;
        }
        if (req.method === "POST" && match[2] === "live") {
          const { live: on } = LiveSchema.parse(await body(req));
          if (on) {
            if (campaignSummary(campaign, replay(campaign).state).finished) {
              send(409, { error: "Cette campagne est terminée." });
              return;
            }
            startLive(id);
          } else stopLive(id, null);
          send(200, { live: liveStatus(id) });
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
          // Le message nommait 1000 quelle que soit la limite appliquee ;
          // un joueur arrete a 1200 lisait donc un chiffre qui n'etait pas le sien.
          const cap = atLeast(campaign.version, "spectator-4") ? 1200 : 1000;
          if (campaign.turns.length >= cap) {
            send(409, { error: `Limite de ${cap} tours atteinte` });
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
  server.on("close", () => {
    closed = true;
    for (const entry of live.values())
      if (entry.timer) clearTimeout(entry.timer);
  });
  return server;
}
let started = false;

/**
 * Démarre le service : verrou, serveur, écoute. Une seule fois par processus.
 *
 * Exporté pour `Aevum.exe`, qui ne peut pas compter sur la garde ci-dessous.
 * Mesuré : dans l'exécutable autonome, `import.meta.url` est indéfini dans ce
 * module chargé à la demande. La garde concluait « pas lancé directement »,
 * et le paquet se terminait aussitôt, code 0, sans un mot.
 */
export function startServer(): void {
  if (started) return;
  started = true;
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
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  startServer();

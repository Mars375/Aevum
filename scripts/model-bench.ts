/**
 * model-bench — quel modèle gratuit gouverne de façon stable et propre ?
 *
 * Jouer une campagne par modèle ne compare rien : chaque partie diverge dès le
 * premier tour, et deux modèles ne répondent jamais à la même question. Ce banc
 * fige des situations — des états de jeu reproduits à l'identique par le moteur
 * local — et les soumet toutes à chaque modèle. C'est l'appariement que ce
 * dépôt réclame ailleurs (`npm run rank-eras`).
 *
 * Chaque modèle passe par le chemin du produit, pas par un raccourci : le même
 * prompt, la même observation, la même lecture de la réponse, la même passe de
 * correction (`requestValidatedCouncil`), le même délai de 45 s. Seul l'appel
 * final est redirigé vers le fournisseur visé. La sortie structurée et le bridage
 * du raisonnement suivent ce que le catalogue du modèle déclare, comme dans le
 * produit.
 *
 * Mesuré pour chaque couple (modèle, situation) : a-t-il répondu lui-même, en
 * combien de temps, du premier coup ou après correction, combien d'ordres le
 * moteur rejette, combien de constructions sortent des options proposées.
 *
 * Usage : npm run bench:models -- [--targets=a,b] [--out=chemin]
 * Reprend là où il s'est arrêté : chaque résultat est écrit aussitôt obtenu.
 * Aucune clé n'est imprimée ; seule celle de Nous est lue, pour Nous.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  activeCiv,
  localCouncil,
  newSpectator,
  resolveCouncil,
  type SpectatorState,
} from "../packages/world/src/spectator.js";
import { requestValidatedCouncil } from "../packages/agents/src/council-review.js";
import { councilOptions } from "../packages/agents/src/council-options.js";
import { loadWindowsNousEnvironment } from "./windows-env.js";

const arg = (name: string, fallback: string) => {
  const found = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

interface Provider {
  base: string;
  /** Catalogue au format OpenRouter, ou null : le modèle est déclaré à la main. */
  catalogue: string | null;
  /** Secondes minimales entre deux appels, pour ne pas mesurer sa propre hâte. */
  pace: number;
  keyEnv?: string;
  /** Sans catalogue, ce que le point d'accès sait faire, déclaré à la main. */
  declared?: string[];
}

const PROVIDERS: Record<string, Provider> = {
  nous: {
    base: "https://inference-api.nousresearch.com/v1",
    catalogue: "https://inference-api.nousresearch.com/v1/models",
    pace: 6,
    keyEnv: "NOUS_API_KEY",
  },
  kilo: {
    base: "https://api.kilo.ai/api/gateway",
    catalogue: "https://api.kilo.ai/api/gateway/models",
    // L'accès anonyme est limité à 200 requêtes par heure pour toute l'adresse
    // IP, pas par modèle : un banc long à 4 s entre les appels la dépasse, et
    // mesure alors la limite au lieu du modèle.
    pace: 18,
  },
  ovh: {
    base: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
    catalogue: null,
    pace: 31,
  },
  // LLM7 : quatre modèles « turbo » servis sans clé, 60 requêtes par heure.
  // Son catalogue ne déclare pas de paramètres au format OpenRouter : ses
  // modèles passent donc en mode prompt, sans sortie structurée imposée.
  // OpenRouter : modèles `:free` seulement ; 50 requêtes par jour sans achat,
  // 1 000 après 10 $ payés une fois. Le banc s'arrête si la clé manque.
  openrouter: {
    base: "https://openrouter.ai/api/v1",
    catalogue: "https://openrouter.ai/api/v1/models",
    pace: 4,
    keyEnv: "OPENROUTER_API_KEY",
  },
  // Mistral : palier gratuit de compte, environ une requête par seconde.
  mistral: {
    base: "https://api.mistral.ai/v1",
    catalogue: null,
    pace: 2,
    keyEnv: "MISTRAL_API_KEY",
  },
  llm7: {
    base: "https://api.llm7.io/v1",
    catalogue: null,
    pace: 61,
  },
  ollama: {
    base: "http://127.0.0.1:11434/v1",
    catalogue: null,
    pace: 0,
    // Ollama applique un schéma JSON par sa compatibilité OpenAI ; le lui
    // déclarer le traite comme le produit traiterait un modèle qui le peut.
    declared: ["structured_outputs"],
  },
};

const DEFAULT_TARGETS = [
  "nous:meituan/longcat-2.0:free",
  "nous:poolside/laguna-s-2.1:free",
  "nous:poolside/laguna-xs-2.1:free",
  "nous:inclusionai/ling-3.0-flash-fin:free",
  "nous:inclusionai/ling-3.0-flash-sante:free",
  "kilo:nvidia/nemotron-3-ultra-550b-a55b:free",
  "kilo:nvidia/nemotron-3-super-120b-a12b:free",
  "kilo:dots-studio/dots-3-note-preview:free",
  "kilo:nex-agi/nex-n2.5-pro:free",
  "kilo:nex-agi/nex-n2.5-mini:free",
  "kilo:stepfun/step-3.7-flash:free",
  "kilo:inclusionai/ling-3.0-flash-fin:free",
  "kilo:liquid/lfm-2.5-2.6b:free",
];

/**
 * Les situations : jouées par le dirigeant local, donc reproduites à
 * l'identique à chaque exécution. Début de partie, premiers tours, milieu —
 * et deux graines, pour qu'aucune carte n'avantage un modèle.
 */
const SITUATIONS: { seed: number; turn: number }[] = [
  { seed: 42, turn: 0 },
  { seed: 42, turn: 2 },
  { seed: 42, turn: 13 },
  { seed: 42, turn: 30 },
  { seed: 7, turn: 4 },
  { seed: 7, turn: 20 },
];

function situation(seed: number, turn: number): SpectatorState {
  let state = newSpectator(seed, "spectator-10");
  for (let n = 0; n < turn; n++) {
    const civ = activeCiv(state)!;
    state = resolveCouncil(state, [localCouncil(state, civ)]).state;
  }
  return state;
}

interface Row {
  target: string;
  situation: string;
  civ: string;
  answered: boolean;
  firstTry: boolean;
  corrected: boolean;
  calls: number;
  latencyMs: number;
  rejected: number | null;
  /** Le motif de chaque rejet : un modèle qui répète la même erreur se lit ici. */
  rejectDetails: string[];
  outsideOptions: number | null;
  finish: string | null;
  completionTokens: number | null;
  error: string | null;
}

const catalogues = new Map<
  string,
  Array<{ id: string; supported_parameters?: string[] }>
>();
async function declaredParameters(
  provider: string,
  model: string,
): Promise<string[]> {
  const source = PROVIDERS[provider]!;
  if (!source.catalogue) return source.declared ?? [];
  if (!catalogues.has(provider)) {
    const headers: Record<string, string> = {};
    if (source.keyEnv && process.env[source.keyEnv])
      headers.Authorization = `Bearer ${process.env[source.keyEnv]}`;
    const response = await fetch(source.catalogue, {
      headers,
      signal: AbortSignal.timeout(20000),
    });
    catalogues.set(
      provider,
      ((await response.json()) as { data: [] }).data ?? [],
    );
  }
  return (
    catalogues.get(provider)!.find((m) => m.id === model)
      ?.supported_parameters ?? []
  );
}

type Decision = Parameters<typeof resolveCouncil>[1][number];

async function bench(
  target: string,
  label: string,
  state: SpectatorState,
): Promise<{ row: Row; decision: Decision | null }> {
  const [provider, ...rest] = target.split(":");
  const model = rest.join(":");
  const source = PROVIDERS[provider!];
  if (!source) throw new Error(`Fournisseur inconnu : ${provider}`);
  if (source.keyEnv && provider !== "nous" && !process.env[source.keyEnv])
    throw new Error(
      `${source.keyEnv} absente : posez-la dans .env ou dans les variables Windows`,
    );
  if (provider === "openrouter" && !model.endsWith(":free"))
    throw new Error(
      `${model} n'est pas gratuit : le banc ne mesure que des modèles gratuits`,
    );
  const civ = activeCiv(state)!;
  // --raisonnement-impose=a,b : certains modèles refusent qu'on leur interdise
  // de raisonner (« Reasoning is mandatory ») — le produit, lui, ne le leur
  // demande pas. Sans cette option, le banc les déclarait morts à tort.
  const mandatory = arg("raisonnement-impose", "").split(",").includes(target);
  const parameters = (await declaredParameters(provider!, model)).filter(
    (name) => !mandatory || name !== "reasoning",
  );
  let calls = 0;
  let latencyMs = 0;
  let finish: string | null = null;
  let completionTokens: number | null = null;

  /**
   * Le chemin Nous du produit, dont on ne redirige que la destination. Pour un
   * autre fournisseur, le catalogue Nous est remplacé par la déclaration du
   * modèle visé : gratuit, et ses paramètres réels.
   */
  const routed: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/models")) {
      if (provider === "nous") return fetch(input, init);
      return new Response(
        JSON.stringify({
          data: [
            {
              id: model,
              pricing: { prompt: "0", completion: "0" },
              supported_parameters: parameters,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    const headers = new Headers(init?.headers);
    // La clé du fournisseur visé, jamais celle de Nous : le chemin Nous pose la
    // sienne, qu'on retire avant tout appel ailleurs.
    if (provider !== "nous") {
      headers.delete("Authorization");
      const key = source.keyEnv ? process.env[source.keyEnv] : undefined;
      if (key) headers.set("Authorization", `Bearer ${key}`);
    }
    const started = Date.now();
    calls++;
    const response = await fetch(`${source.base}/chat/completions`, {
      ...init,
      headers,
    });
    latencyMs += Date.now() - started;
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as {
      usage?: { completion_tokens?: number };
      choices?: { finish_reason?: string }[];
    } | null;
    finish = body?.choices?.[0]?.finish_reason ?? `HTTP ${response.status}`;
    completionTokens = body?.usage?.completion_tokens ?? null;
    return response;
  };

  const env =
    provider === "nous"
      ? process.env
      : // Le chemin Nous exige une clé ; elle n'est jamais envoyée ailleurs,
        // l'en-tête est retiré avant l'appel.
        { ...process.env, NOUS_API_KEY: "banc-sans-cle" };
  const answer = await requestValidatedCouncil(
    state,
    civ,
    "remote",
    `nous:${model}`,
    env,
    routed,
  ).catch((error: Error) => ({
    source: "unavailable" as const,
    decision: null,
    error: error.message,
    review: undefined,
  }));
  const answered = answer.source === "remote" && !!answer.decision;
  let rejected: number | null = null;
  let rejectDetails: string[] = [];
  let outsideOptions: number | null = null;
  if (answered && answer.decision) {
    rejectDetails = resolveCouncil(state, [answer.decision])
      .rejected.filter((entry) => entry.civ === civ)
      .map((entry) => entry.detail);
    rejected = rejectDetails.length;
    const offered = (
      councilOptions(state, civ) as {
        construction: { city: string; building: string }[];
      }
    ).construction;
    outsideOptions = answer.decision.construction.filter(
      (build) =>
        !offered.some(
          (option) =>
            option.city === build.city && option.building === build.building,
        ),
    ).length;
  }
  const review = (
    answer as { review?: { issues: string[]; corrected: boolean } }
  ).review;
  const row: Row = {
    target,
    situation: label,
    civ,
    answered,
    firstTry: answered && (!review || review.issues.length === 0),
    corrected: !!review?.corrected,
    calls,
    latencyMs,
    rejected,
    rejectDetails,
    outsideOptions,
    finish,
    completionTokens,
    error: answer.error ?? null,
  };
  return { row, decision: answered ? (answer.decision as Decision) : null };
}

async function warmUp(target: string) {
  if (!target.startsWith("ollama:")) return;
  await fetch(`${PROVIDERS.ollama!.base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: target.slice("ollama:".length),
      messages: [{ role: "user", content: "ok" }],
      max_tokens: 1,
    }),
    signal: AbortSignal.timeout(300_000),
  }).catch(() => undefined);
}

/**
 * La stabilité dans la durée, que six situations indépendantes ne disent pas :
 * `longcat` gouvernait proprement chaque situation isolée, et bloquait au
 * troisième tour d'une vraie partie. Ici, N tours consécutifs réellement joués,
 * trois essais par tour espacés. Un tour sans réponse après trois essais est
 * compté comme perdu, puis joué par le dirigeant local pour que la partie
 * continue — et le rapport le dit, tour par tour.
 */
async function consecutive(target: string, turns: number, out: string) {
  const provider = target.split(":")[0]!;
  const pace = (PROVIDERS[provider]?.pace ?? 0) * 1000;
  const rows: (Row & { attempts: number; substituted: boolean })[] = [];
  let state = newSpectator(42, "spectator-10");
  await warmUp(target);
  for (let turn = 0; turn < turns; turn++) {
    const label = `tour ${turn}`;
    let result: Awaited<ReturnType<typeof bench>> | null = null;
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      result = await bench(target, label, state);
      if (result.row.answered) break;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(pace, 5000) * attempts),
      );
    }
    const civ = activeCiv(state)!;
    const decision = result!.decision ?? (localCouncil(state, civ) as Decision);
    rows.push({ ...result!.row, attempts, substituted: !result!.decision });
    state = resolveCouncil(state, [decision]).state;
    writeFileSync(
      out,
      JSON.stringify(
        { checkedAt: new Date().toISOString(), target, turns, rows },
        null,
        1,
      ) + "\n",
    );
    const row = result!.row;
    console.log(
      `${label.padEnd(8)} ${civ.padEnd(8)} ${row.answered ? (row.firstTry ? "valide " : row.corrected ? "corrige" : "brut   ") : "PERDU  "} essais ${attempts}  ${String(row.latencyMs).padStart(6)} ms  rejets ${row.rejected ?? "-"}${row.error && !row.answered ? "  " + row.error.slice(0, 50) : ""}`,
    );
    if (pace) await new Promise((resolve) => setTimeout(resolve, pace));
  }
  const served = rows.filter((row) => row.answered);
  console.log(
    `
${target} : ${served.length}/${turns} tours servis, ${rows.filter((row) => row.attempts > 1).length} avec relance, ${rows.filter((row) => row.substituted).length} perdus ; 1er coup ${rows.filter((row) => row.firstTry).length} ; rejets ${served.reduce((sum, row) => sum + (row.rejected ?? 0), 0)} ; latence médiane ${median(served.map((row) => row.latencyMs))} ms`,
  );
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)]! : null;
};

async function main() {
  // Comme le serveur : un .env local d'abord, puis les variables Windows.
  // Sans cette ligne, une clé posée dans .env était vue par l'observatoire
  // mais pas par les sondes, qui déclaraient le fournisseur sans clé.
  if (existsSync(".env")) process.loadEnvFile(".env");
  loadWindowsNousEnvironment();
  const targets = arg("targets", "")
    ? arg("targets", "").split(",")
    : DEFAULT_TARGETS;
  const out = arg("out", "docs/reports/model-bench.json");
  const turns = Number(arg("consecutive", "0"));
  if (turns > 0) {
    for (const target of targets)
      await consecutive(
        target,
        turns,
        out.replace(/.json$/, `-${target.replace(/[^a-z0-9.]+/gi, "_")}.json`),
      );
    return;
  }
  const saved = existsSync(out)
    ? (JSON.parse(readFileSync(out, "utf8")) as { rows: Row[] }).rows
    : [];
  const rows: Row[] = [...saved];
  const done = new Set(rows.map((row) => `${row.target}|${row.situation}`));
  const lastCall = new Map<string, number>();
  const warmed = new Set<string>();
  const save = () =>
    writeFileSync(
      out,
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          rules: "spectator-10",
          situations: SITUATIONS,
          rows,
        },
        null,
        1,
      ) + "\n",
    );

  // Situation par situation, puis modèle par modèle : la charge se répartit
  // entre les fournisseurs au lieu de s'abattre sur l'un d'eux d'un bloc.
  const count = Number(arg("situations", String(SITUATIONS.length)));
  for (const { seed, turn } of SITUATIONS.slice(0, count)) {
    const label = `graine ${seed}, tour ${turn}`;
    const state = situation(seed, turn);
    for (const target of targets) {
      if (done.has(`${target}|${label}`)) continue;
      const provider = target.split(":")[0]!;
      const wait =
        (lastCall.get(provider) ?? 0) +
        (PROVIDERS[provider]?.pace ?? 0) * 1000 -
        Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      // Un modèle local se charge en mémoire graphique au premier appel : ce
      // chargement a dépassé les 45 s une fois, et comptait comme un échec du
      // modèle. On l'échauffe d'abord, hors mesure.
      if (!warmed.has(target)) {
        await warmUp(target);
        warmed.add(target);
      }
      const { row } = await bench(target, label, state);
      lastCall.set(provider, Date.now());
      rows.push(row);
      done.add(`${target}|${label}`);
      save();
      console.log(
        `${label.padEnd(17)} ${target.padEnd(52)} ${row.answered ? (row.firstTry ? "valide" : row.corrected ? "corrige" : "brut  ") : "ABSENT"} ${String(row.latencyMs).padStart(6)} ms  rejets ${row.rejected ?? "-"}  hors options ${row.outsideOptions ?? "-"}${row.error ? "  " + row.error.slice(0, 60) : ""}`,
      );
    }
  }

  console.log(
    `\n${"modèle".padEnd(52)} répond  1er coup  rejets  hors opt.  latence médiane`,
  );
  for (const target of targets) {
    const mine = rows.filter((row) => row.target === target);
    const answered = mine.filter((row) => row.answered);
    console.log(
      `${target.padEnd(52)} ${`${answered.length}/${mine.length}`.padStart(6)}  ${String(mine.filter((row) => row.firstTry).length).padStart(8)}  ${String(answered.reduce((sum, row) => sum + (row.rejected ?? 0), 0)).padStart(6)}  ${String(answered.reduce((sum, row) => sum + (row.outsideOptions ?? 0), 0)).padStart(9)}  ${String(median(answered.map((row) => row.latencyMs)) ?? "-").padStart(9)} ms`,
    );
  }
  console.log(`\nrapport : ${out}`);
}

await main();

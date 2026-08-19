/**
 * Is the instrument working before the measurement starts?
 *
 * A rotation costs on the order of two hundred calls and a night. The last one
 * produced no usable ranking because one model answered 1 of its 25 decisions —
 * something four calls would have revealed before the run rather than after it.
 *
 * Each roster model is asked one real ruler question. What matters is not the
 * answer's quality but that the model itself answered, in reasonable time, in a
 * shape the parser accepts.
 *
 *   npm run preflight
 */
import { resolve } from "node:path";
import { DEFAULT_GENERALS, RemoteProvider, askRuler } from "@abs/agents";
import { newCiv, type DecisionPoint } from "@abs/world";

try {
  process.loadEnvFile(resolve(process.cwd(), ".env"));
} catch {
  /* fall through to the real environment */
}

const apiKeys = {
  openrouter: process.env.OPENROUTER_API_KEY,
  groq: process.env.GROQ_API_KEY,
  nvidia: process.env.NVIDIA_API_KEY,
  mistral: process.env.MISTRAL_API_KEY,
};

const point: DecisionPoint = {
  tick: 42,
  civ: "crimson",
  kind: "FAMINE",
  urgency: 80,
  standing: false,
  evidence: ["2.1 tours de vivres restants", "340 habitants", "mauvaise recolte (0.61x)"],
};

console.log("\nUn dirigeant, une question, par modele du roster.\n");
let ready = 0;

for (const general of DEFAULT_GENERALS) {
  // Alone in its chain: the point is to find out whether THIS model answers,
  // and a fallback quietly covering for it is exactly what we are guarding
  // against.
  const solo = { ...general, fallbacks: [] };
  const provider = new RemoteProvider({ apiKeys, freeModelsOnly: true });
  const started = Date.now();
  let rejection: string | null = null;
  const ruling = await askRuler(provider, solo, newCiv("crimson"), point, undefined, (why) => (rejection = why));
  const ms = Date.now() - started;
  const used = provider.usage()[0]?.completion ?? 0;

  if (ruling) {
    ready += 1;
    const vow = ruling.doctrine.vow ? `serment ${ruling.doctrine.vow.metric}>=${ruling.doctrine.vow.floor}` : "aucun serment";
    console.log(`  OK   ${general.model.padEnd(34)} ${String(ms).padStart(6)} ms  ${String(used).padStart(5)} jetons  ${vow}`);
  } else {
    console.log(`  NON  ${general.model.padEnd(34)} ${String(ms).padStart(6)} ms  ${rejection ?? provider.lastError() ?? "?"}`);
  }
}

console.log(`\n${ready}/${DEFAULT_GENERALS.length} modeles servent leur propre civilisation.`);
if (ready < DEFAULT_GENERALS.length) {
  console.log("Lancer une rotation maintenant produirait le resultat d'une chaine de repli, pas celui d'un modele.\n");
  process.exit(1);
}
console.log("La rotation peut partir.\n");

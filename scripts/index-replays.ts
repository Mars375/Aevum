/**
 * Build the catalogue the player offers in its replay picker.
 *
 * Adding v2 and report replays made the player's single hardcoded default a
 * usability problem: a reader landing on the page saw one battle with no way to
 * know the others existed. This scans `replays/` and writes an index the player
 * can list.
 *
 *   npm run index-replays
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { ReplaySchema } from "@abs/contracts";

const ROOT = resolve("replays");

interface Entry {
  path: string;
  battleId: string;
  ruleset: string;
  turns: number;
  outcome: string;
  winner: string | null;
  createdAt: string;
  hasReports: boolean;
  models: string[];
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return e.isFile() && e.name.endsWith(".json") && e.name !== "index.json" && e.name !== "results.json" ? [full] : [];
  });
}

const entries: Entry[] = [];
for (const file of walk(ROOT)) {
  let replay;
  try {
    replay = ReplaySchema.parse(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    // A partial checkpoint from an interrupted battle is not a catalogue entry.
    continue;
  }
  entries.push({
    path: relative(ROOT, file).split("\\").join("/"),
    battleId: replay.manifest.battleId,
    ruleset: replay.manifest.rulesetVersion,
    turns: replay.turns.length,
    outcome: replay.outcome.kind,
    winner: replay.outcome.winner ?? (replay.outcome.winners.length ? replay.outcome.winners.join(" + ") : null),
    createdAt: replay.manifest.createdAt,
    hasReports: replay.reports.length > 0,
    models: [...new Set(replay.manifest.config.generals.map((g) => g.model))],
  });
}

// Newest first: the reader almost always wants the most recent battle.
entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
writeFileSync(join(ROOT, "index.json"), JSON.stringify(entries, null, 2));

/**
 * Les batailles de référence partent aussi dans le lecteur.
 *
 * `index-worlds` publie déjà son monde dans `apps/player/public/worlds`, si
 * bien qu'une construction statique a une chronique à montrer. Les batailles
 * n'étaient publiées nulle part : l'onglet Archives s'ouvrait sur « Unexpected
 * token '<' », le serveur rendant la page de l'application à la place du JSON
 * absent. Docker monte `./replays` par-dessus et sert donc tout ; un hébergeur
 * statique ne monte rien, et n'avait rien.
 *
 * Les rotations de tournoi restent dehors : deux mégaoctets de données de
 * mesure ne sont pas ce que cet onglet donne à lire.
 */
const PUBLIC_ROOT = resolve("apps/player/public/replays");
const published = entries.filter((entry) => entry.path === "reference.json" || entry.path.startsWith("reference/"));

mkdirSync(PUBLIC_ROOT, { recursive: true });
writeFileSync(join(PUBLIC_ROOT, "index.json"), JSON.stringify(published, null, 2));
for (const entry of published) {
  const destination = join(PUBLIC_ROOT, entry.path);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(ROOT, entry.path), destination);
}

console.log(`${entries.length} replay(s) indexed:`);
for (const e of entries) {
  console.log(`  ${e.path.padEnd(40)} ${e.ruleset}  ${String(e.turns).padStart(2)} tours  ${e.outcome}${e.hasReports ? "  +rapports" : ""}`);
}

/**
 * Compare models *within* a course, not across courses.
 *
 * The first reading of a rotation averaged each model's territory over twelve
 * courses and asked whether the means differed. That throws away the strongest
 * fact in the design: within one course the four models share a board, a seed,
 * the same seasons and the same disasters. Comparing them there removes the
 * world's variance entirely instead of trying to average it away.
 *
 * So this ranks the four inside each course and asks a simpler question: how
 * often does A finish above B when both lived the same world?
 *
 *   npx tsx scripts/rank-eras.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DEFAULT_GENERALS } from "@abs/agents";
import { JournalSchema, census, replay, type Civ } from "@abs/world";

const ROOT = resolve("worlds");
const FACTIONS = DEFAULT_GENERALS.map((g) => g.factionId);
const rotate = (r: number) => DEFAULT_GENERALS.map((g, i) => ({ model: g.model, faction: FACTIONS[(i + r) % FACTIONS.length]! }));

const METRICS = {
  lieux: (c: Civ) => c.territory,
  population: (c: Civ) => c.population,
  progres: (c: Civ) => c.advances.length,
} as const;

interface Course {
  label: string;
  final: Map<string, Civ>;
}

const courses: Course[] = [];
for (const dir of readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const m = /^rotation-(\d+)-(\d+)$/.exec(dir.name);
  if (!m) continue;
  const [, seed, r] = m;
  const path = join(ROOT, dir.name, "era-0001.json");
  let journal;
  try {
    journal = JournalSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    continue;
  }
  const world = census(replay(journal.origin, journal.rulings, journal.livedTo).world);
  const final = new Map<string, Civ>();
  for (const { model, faction } of rotate(Number(r))) final.set(model, world.civs.find((c) => c.id === faction)!);
  courses.push({ label: `${seed}/${r}`, final });
}

if (courses.length === 0) {
  console.error("Aucune course trouvee dans worlds/rotation-*.");
  process.exit(1);
}

const models = [...courses[0]!.final.keys()];
console.log(`\n${courses.length} courses, ${models.length} modeles, compares a l'interieur de chaque monde.\n`);

for (const [name, of] of Object.entries(METRICS)) {
  console.log(`--- ${name} ---`);

  // Mean rank: 1 is best. Ties share the average rank, so a four-way tie gives
  // everyone 2.5 rather than rewarding whoever the sort put first.
  const ranks = new Map<string, number[]>(models.map((m) => [m, []]));
  for (const course of courses) {
    const scored = models.map((m) => ({ m, v: of(course.final.get(m)!) })).sort((a, b) => b.v - a.v);
    let i = 0;
    while (i < scored.length) {
      let j = i;
      while (j + 1 < scored.length && scored[j + 1]!.v === scored[i]!.v) j += 1;
      const shared = (i + j) / 2 + 1;
      for (let k = i; k <= j; k += 1) ranks.get(scored[k]!.m)!.push(shared);
      i = j + 1;
    }
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  for (const [m, rs] of [...ranks].sort((a, b) => mean(a[1]) - mean(b[1]))) {
    console.log(`  ${m.padEnd(34)} rang moyen ${mean(rs).toFixed(2)}`);
  }

  console.log("\n  face a face, dans le meme monde :");
  for (let i = 0; i < models.length; i += 1) {
    for (let j = i + 1; j < models.length; j += 1) {
      const a = models[i]!;
      const b = models[j]!;
      let wa = 0;
      let wb = 0;
      for (const course of courses) {
        const va = of(course.final.get(a)!);
        const vb = of(course.final.get(b)!);
        if (va > vb) wa += 1;
        else if (vb > va) wb += 1;
      }
      const n = wa + wb;
      // A run of n coin flips: a lead is only worth reading past about
      // one standard deviation on each side, which is sqrt(n) / 2.
      const edge = n > 0 ? Math.abs(wa - wb) / Math.sqrt(n) : 0;
      const verdict = n === 0 ? "aucun depart" : edge >= 2 ? "NET" : edge >= 1.3 ? "penche" : "indistinct";
      console.log(
        `    ${a.split("/").pop()!.padEnd(24)} ${String(wa).padStart(2)} - ${String(wb).padEnd(2)} ${b.split("/").pop()!.padEnd(24)} ${verdict}`,
      );
    }
  }
  console.log();
}

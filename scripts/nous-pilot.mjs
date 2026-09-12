import { writeFileSync, mkdirSync } from "node:fs";
const base = "http://127.0.0.1:5174/api/campaigns";
const models = {
  amber: "nous:meituan/longcat-2.0:free",
  azure: "nous:poolside/laguna-xs-2.1:free",
  crimson: "nous:inclusionai/ling-3.0-flash-sante:free",
  verdant: "nous:poolside/laguna-s-2.1:free",
};
async function json(url, body) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (!r.ok) throw Error("HTTP " + r.status);
  return r.json();
}
const id =
  process.argv[2] ||
  (await json(base, { seed: 42, mode: "remote", models })).id;
const initial = await json(`${base}/${id}`);
console.log("PILOT " + id);
mkdirSync("docs/reports", { recursive: true });
for (let turn = initial.campaign.turns.length; turn < 50; turn++) {
  await json(`${base}/${id}/step`, { turn });
  let result;
  do {
    await new Promise((r) => setTimeout(r, 2000));
    result = await json(`${base}/${id}`);
  } while (result.busy);
  if (result.campaign.turns.length !== turn + 1)
    throw Error("Turn incomplete: " + result.error);
  const report = {
    id,
    models: result.campaign.models,
    completedTurns: turn + 1,
    answers: result.campaign.turns
      .flatMap((t) => t.answers)
      .reduce((a, x) => ((a[x.source] = (a[x.source] || 0) + 1), a), {}),
    rejections: result.outcomes.flatMap((o) => o.rejected ?? []),
    civilizations: result.state.world.civs.map((c) => ({
      id: c.id,
      population: c.population,
      territory: c.territory,
      soldiers: c.soldiers,
      advances: c.advances,
    })),
    cities: result.state.world.simulation.cities.length,
    events: result.outcomes.flatMap((o) => o.events ?? []),
  };
  writeFileSync(
    "docs/reports/nous-pilot.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      turn: turn + 1,
      answers: report.answers,
      cities: report.cities,
      rejections: report.rejections.length,
      lastErrors: result.campaign.turns
        .at(-1)
        .answers.filter((a) => a.error)
        .map((a) => ({ civ: a.civ, error: a.error })),
    }),
  );
  if (result.state.world.civs.filter((c) => c.fellOnTick === null).length < 2)
    break;
  await new Promise((r) => setTimeout(r, 5000));
  if (
    turn >= 2 &&
    result.campaign.turns
      .slice(-3)
      .every((t) => t.answers.every((a) => a.source === "unavailable"))
  )
    throw Error("Provider unavailable three consecutive turns; pilot paused");
}

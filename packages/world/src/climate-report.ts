import { atLeast, incidentFor, type SpectatorState } from "./spectator.js";

/** Observed changes across a completed event, never a claim of causal loss.
 * Callers supply history only through the currently displayed snapshot.
 */
export function latestClimateReport(history: readonly SpectatorState[]) {
  const current = history.at(-1);
  if (current === undefined || !atLeast(current.rules, "spectator-8") || !current.sequence) return null;
  const turn = current.sequence.round - 1;
  for (let ago = 1; ago <= 15; ago++) {
    if (turn - ago < 0) break;
    const event = incidentFor(current.world.seed, turn - ago);
    if (!event || event.end >= turn) continue;
    const before = history.find((s) => s.sequence?.round === event.start + 1);
    const after = history.find((s) => s.sequence?.round === event.end + 2);
    if (!before || !after) return null;
    return {
      event,
      startTick: before.world.tick,
      endTick: after.world.tick,
      civilizations: before.world.civs
        .filter((c) => c.fellOnTick === null && c.population > 0)
        .map((c) => {
          const final = after.world.civs.find((other) => other.id === c.id)!;
          return {
            civ: c.id,
            foodBefore: c.stock.food,
            foodAfter: final.stock.food,
            populationChange: final.population - c.population,
            foodPerPerson: Math.round(c.stock.food / c.population * 10) / 10,
            protected: c.advances.includes("irrigation") ||
              before.world.simulation!.cities.some(
                (city) => city.owner === c.id && city.buildings.includes("granary"),
              ),
            survived: final.fellOnTick === null && final.population > 0,
          };
        }),
    };
  }
  return null;
}

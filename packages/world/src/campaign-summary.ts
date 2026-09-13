import type { Campaign } from "./campaign.js";
import type { SpectatorState } from "./spectator.js";
import type { FactionId } from "@abs/contracts";

/** Reporting only: ending an observation period does not assert a military victory.
 * Outcomes must belong to this campaign and stop at the supplied state.
 */
export function campaignSummary(
  campaign: Campaign,
  state: SpectatorState,
  outcomes?: readonly { state: SpectatorState }[],
) {
  const completed = new Map<string, Set<string>>();
  for (const snapshot of [
    ...(outcomes ?? []).map((outcome) => outcome.state),
    state,
  ]) {
    if (snapshot.world.tick > state.world.tick) continue;
    for (const [civ, plan] of Object.entries(snapshot.plans ?? {})) {
      if (plan.status !== "completed") continue;
      const keys = completed.get(civ) ?? new Set<string>();
      keys.add(
        JSON.stringify([
          plan.startedAt,
          plan.kind,
          plan.targetTile,
          plan.targetCity,
          plan.targetTech,
          plan.targetBuilding,
        ]),
      );
      completed.set(civ, keys);
    }
  }
  const metrics = state.world.civs.map((civ) => ({
    civ: civ.id as FactionId,
    alive: civ.fellOnTick === null && civ.population > 0,
    population: civ.population,
    cities:
      state.world.simulation?.cities.filter((city) => city.owner === civ.id)
        .length ?? 0,
    advances: new Set(civ.advances).size,
    completedPlans: completed.get(civ.id)?.size ?? 0,
  }));
  const standings = metrics
    .sort((a, b) => a.civ.localeCompare(b.civ))
    .map((entry) => ({
      ...entry,
      ranks: Object.fromEntries(
        (["population", "cities", "advances", "completedPlans"] as const).map(
          (metric) => [
            metric,
            1 + metrics.filter((other) => other[metric] > entry[metric]).length,
          ],
        ),
      ) as Record<
        "population" | "cities" | "advances" | "completedPlans",
        number
      >,
    }));
  const turns =
    state.rules === "spectator-4"
      ? (state.sequence?.round ?? 1) - 1
      : state.world.tick;
  const maxTurns = campaign.maxTurns ?? null;
  const aliveCount = standings.filter((civ) => civ.alive).length;
  const reason =
    maxTurns !== null && turns >= maxTurns
      ? ("turn-limit" as const)
      : aliveCount <= 1
        ? ("last-civilization" as const)
        : null;
  return {
    finished: reason !== null,
    reason,
    turns,
    maxTurns,
    remainingTurns: maxTurns === null ? null : Math.max(0, maxTurns - turns),
    aliveCount,
    standings,
    plansScope:
      outcomes === undefined
        ? ("current-plan" as const)
        : ("provided-history" as const),
    rankingMethod:
      "Classements indépendants, par valeur décroissante, avec rang partagé en cas d'égalité. Aucun score composite ni vainqueur désigné. Les plans terminés sont dédupliqués dans l'historique fourni ; sans historique, seul le plan courant est compté.",
  };
}
export type CampaignSummary = ReturnType<typeof campaignSummary>;

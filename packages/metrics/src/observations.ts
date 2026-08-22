import { applyRuling, doctrineFingerprint, tickWorld, type Doctrine, type Ruling, type World, type Year } from "@abs/world";
import type { LearningObservation, ObservationEvent, ObservationService } from "./types.js";

const objectiveState = (year: Year, civId: LearningObservation["civId"]) => {
  const civ = year.world.civs.find((candidate) => candidate.id === civId);
  if (!civ) return null;
  return {
    population: civ.population,
    food: civ.stock.food,
    timber: civ.stock.timber,
    ore: civ.stock.ore,
    wealth: civ.stock.wealth,
    soldiers: civ.soldiers,
    territory: civ.territory,
    advances: civ.advances.length,
  };
};

const deltas = (
  before: ReturnType<typeof objectiveState>,
  after: ReturnType<typeof objectiveState>,
): Record<string, number> => {
  if (!before || !after) return {};
  return Object.fromEntries(Object.keys(before).map((key) => {
    const metric = key as keyof typeof before;
    return [key, after[metric] - before[metric]];
  }));
};

function serviceOf(ruling: Ruling): ObservationService {
  const evidence = ruling.service ?? null;
  return {
    evidence: evidence ? "KNOWN" : "UNKNOWN",
    requestedModel: evidence?.requestedModel ?? null,
    servedModel: evidence?.servedModel ?? null,
    provider: evidence?.provider ?? null,
    selfServed: evidence !== null
      && evidence.servedModel === evidence.requestedModel
      && !evidence.servedByFallback
      && evidence.fallbackCount === 0,
    servedByFallback: evidence?.servedByFallback ?? false,
    fallbackCount: evidence?.fallbackCount ?? null,
    attempts: evidence?.attempts ?? 0,
    deferredBy: ruling.deferredBy,
  };
}

function worldsAroundRulings(
  orderedYears: readonly Year[],
  indexed: ReadonlyArray<{ ruling: Ruling; index: number; effectiveTick: number }>,
): Map<number, { before: World; after: World }> {
  const transitions = new Map<number, { before: World; after: World }>();
  const byTick = new Map<number, typeof indexed[number][]>();
  for (const entry of indexed) byTick.set(entry.effectiveTick, [...(byTick.get(entry.effectiveTick) ?? []), entry]);
  for (const [effectiveTick, entries] of byTick) {
    const recorded = orderedYears.find((year) => year.tick === effectiveTick);
    if (!recorded) continue;
    const previous = [...orderedYears].reverse().find((year) => year.tick < effectiveTick);
    let world = previous?.world ?? recorded.world;
    while (world.tick < effectiveTick) {
      world = tickWorld(world).world;
      if (world.tick < effectiveTick) {
        for (const entry of byTick.get(world.tick) ?? []) world = applyRuling(world, entry.ruling);
      }
    }
    for (const entry of entries) {
      const before = world;
      world = applyRuling(world, entry.ruling);
      transitions.set(entry.index, { before, after: world });
    }
  }
  return transitions;
}

/**
 * Derive auditable before/after facts from a replayed chronicle.
 * "Observed-after" is deliberate: temporal order does not prove causality.
 */
export function buildObservations(years: Year[], rulings: Ruling[], runId: string): LearningObservation[] {
  if (runId.length === 0) throw new Error("runId must not be empty");
  const orderedYears = [...years].sort((a, b) => a.tick - b.tick);
  const yearAt = new Map(orderedYears.map((year) => [year.tick, year]));
  const eventAtId = new Map(orderedYears.flatMap((year) => year.events).map((event) => [event.id, event]));
  const indexed = rulings.map((ruling, index) => ({ ruling, index, effectiveTick: ruling.tick + ruling.deferredBy }))
    .sort((a, b) => a.effectiveTick - b.effectiveTick || a.index - b.index);
  const transitions = worldsAroundRulings(orderedYears, indexed);

  return indexed.flatMap(({ ruling, index, effectiveTick }) => {
    const decisionYear = yearAt.get(effectiveTick);
    if (!decisionYear) return [];
    const followingYear = orderedYears.find((year) => year.tick > effectiveTick);
    const transition = transitions.get(index);
    const beforeCiv = transition?.before.civs.find((civ) => civ.id === ruling.civ)
      ?? decisionYear.world.civs.find((civ) => civ.id === ruling.civ);
    const afterCiv = transition?.after.civs.find((civ) => civ.id === ruling.civ)
      ?? decisionYear.world.civs.find((civ) => civ.id === ruling.civ);
    if (!beforeCiv || !afterCiv) return [];

    const next = indexed.find((candidate) => candidate.index !== index
      && candidate.ruling.civ === ruling.civ
      && (candidate.effectiveTick > effectiveTick
        || (candidate.effectiveTick === effectiveTick && candidate.index > index)));
    const referenced = ruling.consequenceRef ? eventAtId.get(ruling.consequenceRef) : undefined;
    const sources = referenced && referenced.civ === ruling.civ && referenced.tick <= ruling.tick
      ? [referenced]
      : [];
    const triggerEvents: ObservationEvent[] = sources.map(({ id, tick, kind, detail }) => ({ id, tick, kind, detail }));
    const service = serviceOf(ruling);
    const beforeDoctrine: Doctrine = structuredClone(beforeCiv.doctrine);
    const afterDoctrine: Doctrine = structuredClone(afterCiv.doctrine);

    return [{
      modelId: service.requestedModel,
      runId,
      civId: ruling.civ,
      seed: decisionYear.world.seed,
      triggerEventIds: triggerEvents.map((event) => event.id),
      triggerEvents,
      decisionTick: ruling.tick,
      effectiveTick,
      nextDecisionTick: next?.effectiveTick ?? null,
      decisionKind: ruling.kind,
      beforeDoctrineFingerprint: doctrineFingerprint(beforeDoctrine),
      afterDoctrineFingerprint: doctrineFingerprint(afterDoctrine),
      beforeDoctrine,
      afterDoctrine,
      objectiveDeltas: deltas(objectiveState(decisionYear, ruling.civ), followingYear ? objectiveState(followingYear, ruling.civ) : null),
      reason: ruling.reason,
      context: [...(ruling.context ?? [])],
      attribution: "observed-after" as const,
      eligibleForNumerator: service.evidence === "KNOWN"
        && service.selfServed
        && !service.servedByFallback
        && service.attempts === 1
        && ruling.deferredBy === 0,
      service,
    }];
  });
}

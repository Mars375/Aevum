import { doctrineFingerprint, type Doctrine, type Ruling, type Year } from "@abs/world";
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
  const requestedModel = evidence?.requestedModel ?? ruling.model ?? "UNSERVED";
  return {
    requestedModel,
    servedModel: evidence?.servedModel ?? ruling.model,
    provider: evidence?.provider ?? null,
    selfServed: evidence
      ? evidence.servedModel === evidence.requestedModel && !evidence.servedByFallback
      : ruling.model !== null,
    servedByFallback: evidence?.servedByFallback ?? false,
    attempts: evidence?.attempts ?? 1,
    deferredBy: ruling.deferredBy,
  };
}

/**
 * Derive auditable before/after facts from a replayed chronicle.
 * "Observed-after" is deliberate: temporal order does not prove causality.
 */
export function buildObservations(years: Year[], rulings: Ruling[]): LearningObservation[] {
  const orderedYears = [...years].sort((a, b) => a.tick - b.tick);
  const yearAt = new Map(orderedYears.map((year) => [year.tick, year]));
  const eventAtId = new Map(orderedYears.flatMap((year) => year.events).map((event) => [event.id, event]));
  const indexed = rulings.map((ruling, index) => ({ ruling, index, effectiveTick: ruling.tick + ruling.deferredBy }))
    .sort((a, b) => a.effectiveTick - b.effectiveTick || a.index - b.index);

  return indexed.flatMap(({ ruling, index, effectiveTick }) => {
    const decisionYear = yearAt.get(effectiveTick);
    if (!decisionYear) return [];
    const previousYear = [...orderedYears].reverse().find((year) => year.tick < effectiveTick);
    const followingYear = orderedYears.find((year) => year.tick > effectiveTick);
    const beforeCiv = previousYear?.world.civs.find((civ) => civ.id === ruling.civ)
      ?? decisionYear.world.civs.find((civ) => civ.id === ruling.civ);
    const afterCiv = decisionYear.world.civs.find((civ) => civ.id === ruling.civ);
    if (!beforeCiv || !afterCiv) return [];

    const next = indexed.find((candidate) => candidate.index !== index
      && candidate.ruling.civ === ruling.civ
      && (candidate.effectiveTick > effectiveTick
        || (candidate.effectiveTick === effectiveTick && candidate.index > index)));
    const referenced = ruling.consequenceRef ? eventAtId.get(ruling.consequenceRef) : undefined;
    const sameYear = decisionYear.events.filter((event) => event.civ === ruling.civ);
    const sources = referenced
      ? [referenced, ...sameYear.filter((event) => event.id !== referenced.id)]
      : sameYear;
    const triggerEvents: ObservationEvent[] = sources.map(({ id, tick, kind, detail }) => ({ id, tick, kind, detail }));
    const service = serviceOf(ruling);
    const beforeDoctrine: Doctrine = structuredClone(beforeCiv.doctrine);
    const afterDoctrine: Doctrine = structuredClone(afterCiv.doctrine);

    return [{
      modelId: service.requestedModel,
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
      eligibleForNumerator: ruling.deferredBy === 0 && service.attempts === 1,
      service,
    }];
  });
}

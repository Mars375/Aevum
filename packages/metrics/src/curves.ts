import type { Doctrine, TickEvent } from "@abs/world";
import type {
  LearningCurve,
  LearningCurveOptions,
  LearningObservation,
  LearningSignal,
  MetricName,
  MetricSeries,
} from "./types.js";

type DoctrineKey = keyof Doctrine;

const NEGATIVE_EVENTS = new Set<TickEvent["kind"]>([
  "STARVED", "LOST_LAND", "COLLAPSED", "SHORTAGE", "HARD_YEAR", "CEDED", "ROUTED",
  "RAIDED", "DISASTER", "VOW_BROKEN", "CAPITAL_LOST",
]);

const RELEVANT_BY_EVENT: Partial<Record<TickEvent["kind"], DoctrineKey[]>> = {
  STARVED: ["farming"],
  HARD_YEAR: ["farming"],
  SHORTAGE: ["military", "trade"],
  LOST_LAND: ["military", "posture"],
  CEDED: ["military", "posture"],
  ROUTED: ["military", "posture"],
  RAIDED: ["military", "posture"],
  DISASTER: ["claim", "farming"],
  VOW_BROKEN: ["vow"],
  CAPITAL_LOST: ["military", "posture"],
  COLLAPSED: ["farming", "military", "posture"],
};

const RELEVANT_BY_DECISION: Partial<Record<LearningObservation["decisionKind"], DoctrineKey[]>> = {
  FAMINE: ["farming"],
  TREASURY: ["military", "trade"],
  DECLINE: ["military", "posture"],
  INVADED: ["military", "posture"],
  RAIDED: ["military", "posture"],
  ROUTED: ["military", "posture"],
  MISMATCH: ["farming", "forestry", "mining", "trade", "claim"],
  DISASTER: ["claim", "farming"],
  VOW_BROKEN: ["vow"],
  CAPITAL: ["military", "posture"],
};

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function relevantKeys(observation: LearningObservation): DoctrineKey[] {
  const keys = new Set<DoctrineKey>(RELEVANT_BY_DECISION[observation.decisionKind] ?? []);
  for (const event of observation.triggerEvents) {
    for (const key of RELEVANT_BY_EVENT[event.kind] ?? []) keys.add(key);
  }
  return [...keys];
}

const changedRelevant = (observation: LearningObservation): boolean =>
  relevantKeys(observation).some((key) => !same(observation.beforeDoctrine[key], observation.afterDoctrine[key]));

const negativeKinds = (observation: LearningObservation): string[] => {
  const events = observation.triggerEvents.filter((event) => NEGATIVE_EVENTS.has(event.kind)).map((event) => event.kind);
  return events.length > 0 ? [...new Set(events)] : RELEVANT_BY_DECISION[observation.decisionKind] ? [observation.decisionKind] : [];
};

function wilson(numerator: number, denominator: number): { lower: number | null; upper: number | null } {
  if (denominator === 0) return { lower: null, upper: null };
  const z = 1.959963984540054;
  const p = numerator / denominator;
  const z2 = z * z;
  const centre = (p + z2 / (2 * denominator)) / (1 + z2 / denominator);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * denominator)) / denominator) / (1 + z2 / denominator);
  return { lower: Math.max(0, centre - margin), upper: Math.min(1, centre + margin) };
}

function makeSeries(
  metric: MetricName,
  observations: readonly LearningObservation[],
  scored: Array<{ eligible: boolean; pass: boolean }>,
): MetricSeries {
  const ticks = observations.map((observation) => observation.effectiveTick);
  const denominator = scored.length;
  const numerator = scored.filter((entry) => entry.eligible && entry.pass).length;
  const uncertainty = wilson(numerator, denominator);
  const seeds = new Set(observations.map((observation) => observation.seed));
  return {
    metric,
    window: {
      startTick: ticks.length > 0 ? Math.min(...ticks) : 0,
      endTick: ticks.length > 0 ? Math.max(...ticks) : 0,
    },
    numerator,
    denominator,
    value: denominator > 0 ? numerator / denominator : null,
    sampleCount: observations.length,
    serviceRate: observations.length > 0
      ? observations.filter((observation) => observation.service.selfServed).length / observations.length
      : 0,
    fallbackRate: observations.length > 0
      ? observations.filter((observation) => observation.service.servedByFallback).length / observations.length
      : 0,
    uncertainty: {
      method: "WILSON_95",
      ...uncertainty,
      seedCount: seeds.size,
      runCount: seeds.size,
    },
    eventSourceIds: [...new Set(observations.flatMap((observation) => observation.triggerEventIds))].sort(),
  };
}

export function scoreConsequenceRecognition(observations: readonly LearningObservation[]): MetricSeries {
  const candidates = observations.filter((observation) => negativeKinds(observation).length > 0);
  return makeSeries("consequence-recognition", observations, candidates.map((observation) => ({
    eligible: observation.eligibleForNumerator,
    pass: changedRelevant(observation),
  })));
}

export function scoreErrorCorrection(observations: readonly LearningObservation[]): MetricSeries {
  return makeSeries("error-correction", observations, errorCorrectionEntries(observations).map(({ eligible, pass }) => ({ eligible, pass })));
}

function errorCorrectionEntries(observations: readonly LearningObservation[]): Array<{
  observation: LearningObservation;
  eligible: boolean;
  pass: boolean;
}> {
  const ordered = [...observations].sort((a, b) => a.effectiveTick - b.effectiveTick || a.civId.localeCompare(b.civId));
  const scored: Array<{ observation: LearningObservation; eligible: boolean; pass: boolean }> = [];
  const failures = new Map<string, Set<string>>();
  for (const observation of ordered) {
    const key = `${observation.seed}\u0000${observation.modelId}\u0000${observation.civId}`;
    const seen = failures.get(key) ?? new Set<string>();
    const kinds = negativeKinds(observation);
    if (kinds.some((kind) => seen.has(kind))) {
      scored.push({ observation, eligible: observation.eligibleForNumerator, pass: changedRelevant(observation) });
    }
    for (const kind of kinds) seen.add(kind);
    failures.set(key, seen);
  }
  return scored;
}

const normalise = (text: string): string => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function doctrineClaims(observation: LearningObservation): boolean[] {
  const reason = normalise(observation.reason);
  const claims: boolean[] = [];
  for (const posture of ["trade", "guard", "pressure"] as const) {
    const postureClaim = new RegExp(`(?:\\b(posture|policy|choose|adopt|remain|stay|maintain)\\s+(?:of\\s+)?${posture}\\b|\\b${posture}\\s+posture\\b)`);
    if (postureClaim.test(reason)) claims.push(observation.afterDoctrine.posture.toLowerCase() === posture);
  }
  const work: Array<["farming" | "forestry" | "mining" | "trade" | "military", RegExp]> = [
    ["farming", /\b(farm|farming|agricultur|food|vivres|nourr|grenier)/],
    ["forestry", /\b(forest|forestry|timber|bois)/],
    ["mining", /\b(min|mining|ore|minerai)/],
    ["trade", /\b(trade|trading|commerce|wealth|tresor)/],
    ["military", /\b(militar|soldier|army|soldat|armee)/],
  ];
  for (const [key, pattern] of work) {
    if (!pattern.test(reason)) continue;
    const before = observation.beforeDoctrine[key];
    const after = observation.afterDoctrine[key];
    if (/\b(more|increase|raise|plus|davantage|renfor)/.test(reason)) claims.push(after > before);
    else if (/\b(less|reduce|lower|moins|redu|diminu)/.test(reason)) claims.push(after < before);
  }
  return claims;
}

export function scoreDoctrineCoherence(observations: readonly LearningObservation[]): MetricSeries {
  return makeSeries("doctrine-coherence", observations, observations.map((observation) => {
    const claims = doctrineClaims(observation);
    const stableWithoutClaim = claims.length === 0
      && observation.beforeDoctrineFingerprint === observation.afterDoctrineFingerprint;
    return {
      eligible: observation.eligibleForNumerator,
      pass: stableWithoutClaim || (claims.length > 0 && claims.every(Boolean)),
    };
  }));
}

const EVENT_CLAIMS: Array<{ pattern: RegExp; kinds: TickEvent["kind"][] }> = [
  { pattern: /\b(famine|starv|affam)/, kinds: ["STARVED"] },
  { pattern: /\b(raid|pillard)/, kinds: ["RAIDED", "REPELLED"] },
  { pattern: /\b(rout|assaut.*(echou|fail)|attack.*fail)/, kinds: ["ROUTED"] },
  { pattern: /\b(disaster|catastroph|flood|plague|fire|inond|incend|peste)/, kinds: ["DISASTER"] },
  { pattern: /(?:\b(capital|seat|siege)\b.*\b(lost|fell|prise|perd|tombe)|\b(lost|perd)\b.*\b(capital|seat|siege))/, kinds: ["CAPITAL_LOST"] },
  { pattern: /\b(advance|progress|progres)/, kinds: ["ADVANCE"] },
  { pattern: /\b(lost|perdu|cede|cedee)\b.*\b(land|territor|terre|frontier)/, kinds: ["LOST_LAND", "CEDED"] },
  { pattern: /\b(vow|promesse|serment)\b.*\b(broke|broken|rompu|brise)/, kinds: ["VOW_BROKEN"] },
];

function narrativeClaims(observation: LearningObservation): boolean[] {
  const reason = normalise(observation.reason);
  const eventKinds = new Set(observation.triggerEvents.map((event) => event.kind));
  return EVENT_CLAIMS
    .filter((claim) => claim.pattern.test(reason))
    .map((claim) => claim.kinds.some((kind) => eventKinds.has(kind)));
}

export function scoreNarrativeFidelity(observations: readonly LearningObservation[]): MetricSeries {
  const scored = observations.flatMap((observation) => narrativeClaims(observation).map((pass) => ({
    eligible: observation.eligibleForNumerator,
    pass,
  })));
  return makeSeries("narrative-fidelity", observations, scored);
}

const DEFAULT_OPTIONS: Required<Omit<LearningCurveOptions, "pairedRunKey">> = {
  windowSize: 40,
  minimumServiceRate: 0.7,
  maximumFallbackRate: 0.3,
  minimumSamples: 4,
  minimumWindows: 2,
  minimumImprovement: 0.1,
};

export function buildLearningCurve(
  observations: readonly LearningObservation[],
  options: LearningCurveOptions,
): LearningCurve {
  if (!Number.isInteger(options.windowSize) || options.windowSize <= 0) throw new Error("windowSize must be a positive integer");
  const seeds = [...new Set(observations.map((observation) => observation.seed))].sort((a, b) => a - b);
  if (seeds.length > 1 && !options.pairedRunKey) {
    throw new Error("different seeds require an explicit pairedRunKey");
  }
  const models = [...new Set(observations.map((observation) => observation.modelId))];
  if (models.length > 1) throw new Error("buildLearningCurve accepts one requested model at a time");
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const buckets = new Map<number, LearningObservation[]>();
  for (const observation of observations) {
    const start = Math.floor(observation.effectiveTick / resolved.windowSize) * resolved.windowSize;
    buckets.set(start, [...(buckets.get(start) ?? []), observation]);
  }
  const windows = [...buckets].sort((a, b) => a[0] - b[0]);
  const score = (scorer: (values: readonly LearningObservation[]) => MetricSeries) => windows.map(([start, values]) => ({
    ...scorer(values),
    window: { startTick: start, endTick: start + resolved.windowSize - 1 },
  }));
  const correctionEntries = errorCorrectionEntries(observations);
  const correctionSeries = windows.map(([start, values]) => {
    const inWindow = new Set(values);
    return {
      ...makeSeries(
        "error-correction",
        values,
        correctionEntries.filter((entry) => inWindow.has(entry.observation)).map(({ eligible, pass }) => ({ eligible, pass })),
      ),
      window: { startTick: start, endTick: start + resolved.windowSize - 1 },
    };
  });
  const sampleCount = observations.length;
  const serviceRate = sampleCount > 0 ? observations.filter((observation) => observation.service.selfServed).length / sampleCount : 0;
  const fallbackRate = sampleCount > 0 ? observations.filter((observation) => observation.service.servedByFallback).length / sampleCount : 0;
  const unrankedReasons: string[] = [];
  if (serviceRate < resolved.minimumServiceRate) unrankedReasons.push("SERVICE_RATE_BELOW_THRESHOLD");
  if (fallbackRate > resolved.maximumFallbackRate) unrankedReasons.push("FALLBACK_RATE_ABOVE_THRESHOLD");

  return {
    modelId: models[0] ?? null,
    seeds,
    pairedRunKey: options.pairedRunKey ?? null,
    options: resolved,
    sampleCount,
    serviceRate,
    fallbackRate,
    eventSources: [...new Map(observations.flatMap((observation) => observation.triggerEvents).map((event) => [event.id, event])).values()]
      .sort((a, b) => a.tick - b.tick || a.id.localeCompare(b.id)),
    series: {
      consequenceRecognition: score(scoreConsequenceRecognition),
      errorCorrection: correctionSeries,
      doctrineCoherence: score(scoreDoctrineCoherence),
      narrativeFidelity: score(scoreNarrativeFidelity),
    },
    unrankedReasons,
  };
}

export function classifyLearningSignal(curve: LearningCurve): LearningSignal {
  if (curve.unrankedReasons.length > 0) return "UNRANKED";
  const eligible = [curve.series.consequenceRecognition, curve.series.errorCorrection]
    .map((series) => series.filter((point) => point.value !== null));
  if (curve.sampleCount < curve.options.minimumSamples
    || eligible.some((series) => series.length < curve.options.minimumWindows)) return "INSUFFICIENT_DATA";
  const improved = eligible.every((series) => {
    const first = series[0]!.value!;
    const last = series.at(-1)!.value!;
    return last - first >= curve.options.minimumImprovement;
  });
  return improved ? "ADAPTATION_OBSERVED" : "NO_EVIDENCE";
}

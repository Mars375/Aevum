import type { LearningObservation as ContractLearningObservation, ServiceEvidence } from "@abs/contracts";
import type { DecisionKind, Doctrine, LifeEvent } from "@abs/world";

export type MetricName =
  | "consequence-recognition"
  | "error-correction"
  | "doctrine-coherence"
  | "narrative-fidelity";

export interface ObservationEvent extends Pick<LifeEvent, "id" | "tick" | "kind" | "detail"> {}

export interface ObservationService {
  evidence: "KNOWN" | "UNKNOWN";
  requestedModel: string | null;
  servedModel: string | null;
  provider: string | null;
  selfServed: boolean;
  servedByFallback: boolean;
  fallbackCount: number | null;
  attempts: number;
  deferredBy: number;
}

/** The shared bounded fact plus the journal evidence needed by pure scorers. */
export interface LearningObservation extends Omit<ContractLearningObservation, "modelId"> {
  modelId: string | null;
  runId: string;
  seed: number;
  effectiveTick: number;
  decisionKind: DecisionKind;
  triggerEvents: ObservationEvent[];
  beforeDoctrine: Doctrine;
  afterDoctrine: Doctrine;
  reason: string;
  context: string[];
  attribution: "observed-after";
  eligibleForNumerator: boolean;
  service: ObservationService;
}

export interface MetricWindow {
  startTick: number;
  endTick: number;
}

export interface MetricUncertainty {
  method: "WILSON_95";
  lower: number | null;
  upper: number | null;
  seedCount: number;
  runCount: number;
}

export interface MetricSeries {
  metric: MetricName;
  window: MetricWindow;
  numerator: number;
  denominator: number;
  value: number | null;
  sampleCount: number;
  serviceRate: number | null;
  fallbackRate: number | null;
  unknownServiceCount: number;
  uncertainty: MetricUncertainty;
  eventSourceIds: string[];
}

export interface LearningCurveOptions {
  windowSize: number;
  minimumServiceRate?: number;
  maximumFallbackRate?: number;
  minimumSamples?: number;
  minimumWindows?: number;
  minimumImprovement?: number;
  pairedRunKey?: string;
  pairedRunIds?: readonly string[];
}

export interface LearningCurve {
  modelId: string | null;
  runIds: string[];
  seeds: number[];
  pairedRunKey: string | null;
  options: Required<Omit<LearningCurveOptions, "pairedRunKey" | "pairedRunIds">>;
  sampleCount: number;
  serviceRate: number | null;
  fallbackRate: number | null;
  unknownServiceCount: number;
  eventSources: ObservationEvent[];
  series: {
    consequenceRecognition: MetricSeries[];
    errorCorrection: MetricSeries[];
    doctrineCoherence: MetricSeries[];
    narrativeFidelity: MetricSeries[];
  };
  unrankedReasons: string[];
}

export type LearningSignal = "ADAPTATION_OBSERVED" | "NO_EVIDENCE" | "INSUFFICIENT_DATA" | "UNRANKED";

export type { ServiceEvidence };

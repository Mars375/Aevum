export {
  createInitialState,
  createInitialStateV2,
  DEPLOYMENT,
  DEPLOYMENT_TILES,
  DEFAULT_V2_COMPOSITION,
  V1_COMPOSITION,
  compositionCost,
  validateComposition,
  type CompositionRejection,
} from "./setup.js";
export { resolveTurn, type FactionOrders, type TurnResult, type AllyLookup } from "./resolve.js";
export { checkOutcome, checkOutcomeV2 } from "./outcome.js";
export { SeededRng } from "./rng.js";
export { localViewFor, localViewForV2, visibleTo, updateSightings, appendMemory, type V2ViewInput } from "./view.js";
export {
  alliesOf,
  areAllied,
  emptyDiplomacy,
  pairKey,
  proposalsTo,
  resolveDiplomacy,
  snapshot as diplomacySnapshot,
  type DiplomacyState,
  type DiplomacyInput,
} from "./alliances.js";
export { auditReport, verifyClaim, factionMetrics } from "./verify-report.js";

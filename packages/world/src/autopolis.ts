import type { Resource } from "./state.js";

/**
 * Autopolis is deliberately a separate ruleset.  The existing w8 world keeps
 * its schema and replay meaning; this module is the small, closed world loop
 * used by the continuous mode.
 */
export const AUTOPOLIS_RULESET = "autopolis-v1" as const;
export const MAX_SHORT_MEMORY = 5;
const MAX_TEXT = 400;
const MAX_CLAIMS = 8;
const MAX_REASONING = 600;

export type AutopolisTrait = number;
export type AutopolisPriorityKey = "survival" | "food" | "security" | "expansion" | "wealth" | "knowledge" | "continuity";
export type AutopolisPosture = "TRADE" | "GUARD" | "PRESSURE";
export type AutopolisLandKind = "plain" | "forest" | "hill" | "river";

export interface AutopolisPersonality {
  risk: AutopolisTrait;
  solidarity: AutopolisTrait;
  expansion: AutopolisTrait;
  tradition: AutopolisTrait;
  curiosity: AutopolisTrait;
}

export interface AutopolisPriority {
  key: AutopolisPriorityKey;
  weight: number;
  rank: number;
}

export interface AutopolisMemoryFact {
  tick: number;
  kind: "event" | "decision" | "consequence" | "inheritance";
  text: string;
  sourceId: string;
  salience: number;
}

export interface AutopolisDoctrineArtifact {
  id: string;
  parentId: string | null;
  authorLeaderId: string;
  createdAt: number;
  text: string;
  claims: string[];
}

export interface AutopolisPolicy {
  farming: number;
  forestry: number;
  mining: number;
  trade: number;
  military: number;
  expansion: number;
  posture: AutopolisPosture;
  claim: AutopolisLandKind;
  creed: string;
}

export interface AutopolisLeaderIdentity {
  id: string;
  generation: number;
  predecessorId: string | null;
  modelAssignment: string;
  personality: AutopolisPersonality;
  priorities: AutopolisPriority[];
  doctrine: AutopolisDoctrineArtifact;
  policy: AutopolisPolicy;
  shortMemory: AutopolisMemoryFact[];
  bornAt: number;
}

export interface AutopolisCivilizationIdentity {
  civ: string;
  name: string;
  foundingValues: string[];
  leader: AutopolisLeaderIdentity;
  lineage: string[];
}

export type AutopolisStock = Record<Resource, number>;

export interface AutopolisCiv {
  id: string;
  population: number;
  territory: number;
  stock: AutopolisStock;
  soldiers: number;
  advances: string[];
  alive: boolean;
  identity: AutopolisCivilizationIdentity;
  ticksSinceDecision: number;
}

export interface AutopolisWorld {
  ruleset: typeof AUTOPOLIS_RULESET;
  tick: number;
  seed: number;
  totalLand: number;
  freeLand: number;
  civs: AutopolisCiv[];
}

export type AutopolisEventKind =
  | "RESOURCE_GAINED"
  | "FAMINE"
  | "SHORTAGE"
  | "CRISIS"
  | "LOSS"
  | "EXPANSION"
  | "BORDER"
  | "ADVANCE"
  | "COLLAPSE"
  | "RULING_ACCEPTED"
  | "RULING_DEFERRED"
  | "PROPOSAL_REJECTED"
  | "SUCCESSION"
  | "CULTURE_TRANSMITTED";

export interface AutopolisEvent {
  tick: number;
  civ: string | null;
  kind: AutopolisEventKind;
  detail: string;
  evidence: string[];
  sourceId: string;
}

export interface AutopolisDecisionProposal {
  pointTick: number;
  civ: string;
  leaderId: string;
  kind: string;
  reasoning: string;
  doctrinePatch?: Partial<AutopolisPolicy>;
  proposedDoctrineText?: string;
  proposedClaims?: string[];
  proposedPersonalityPatch?: Partial<AutopolisPersonality>;
  proposedPriorityPatch?: AutopolisPriority[];
}

export interface AutopolisServiceProvenance {
  model?: string | null;
  fallback?: string | null;
  deferredBy?: number;
}

export interface AutopolisAcceptedRuling {
  id: string;
  askedAt: number;
  appliedAt: number;
  deferredBy: number;
  proposal: AutopolisDecisionProposal;
  model: string | null;
  fallback: string | null;
  acceptedDoctrineArtifactId: string | null;
  engineEffects: string[];
}

export interface AutopolisSuccessionEntry {
  type: "succession";
  tick: number;
  civ: string;
  leader: AutopolisLeaderIdentity;
}

export interface AutopolisRulingEntry {
  type: "ruling";
  ruling: AutopolisAcceptedRuling;
}

export type AutopolisJournalEntry = AutopolisRulingEntry | AutopolisSuccessionEntry;

export interface AutopolisJournal {
  ruleset: typeof AUTOPOLIS_RULESET;
  seed: number;
  origin: AutopolisWorld;
  livedTo: number;
  entries: AutopolisJournalEntry[];
}

export interface AutopolisStepResult {
  world: AutopolisWorld;
  events: AutopolisEvent[];
}

export interface AutopolisAcceptanceResult extends AutopolisStepResult {
  ruling: AutopolisAcceptedRuling | null;
}

const DEFAULT_POLICY: AutopolisPolicy = {
  farming: 0.4,
  forestry: 0.2,
  mining: 0.2,
  trade: 0.15,
  military: 0.05,
  expansion: 0.5,
  posture: "GUARD",
  claim: "plain",
  creed: "",
};

const DEFAULT_PERSONALITY: AutopolisPersonality = {
  risk: 0,
  solidarity: 0,
  expansion: 0,
  tradition: 0,
  curiosity: 0,
};

const PRIORITY_KEYS: AutopolisPriorityKey[] = ["survival", "food", "security", "expansion", "wealth", "knowledge", "continuity"];
const LAND_KINDS: AutopolisLandKind[] = ["plain", "forest", "hill", "river"];
const POSTURES: AutopolisPosture[] = ["TRADE", "GUARD", "PRESSURE"];
const RESOURCES: Resource[] = ["food", "timber", "ore", "wealth"];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, "0");
}

function roll(seed: number, tick: number, civ: string, salt: number): number {
  const key = `${seed}|${tick}|${civ}|${salt}`;
  return Number.parseInt(hashText(key), 16) / 0x100000000;
}

function season(seed: number, tick: number): number {
  return 0.82 + roll(seed, tick, "climate", 1) * 0.36;
}


function normalizePolicy(policy: AutopolisPolicy): AutopolisPolicy {
  const total = policy.farming + policy.forestry + policy.mining + policy.trade + policy.military;
  const divisor = total > 0 ? total : 1;
  return {
    farming: policy.farming / divisor,
    forestry: policy.forestry / divisor,
    mining: policy.mining / divisor,
    trade: policy.trade / divisor,
    military: policy.military / divisor,
    expansion: policy.expansion,
    posture: policy.posture,
    claim: policy.claim,
    creed: policy.creed,
  };
}

function leaderId(civ: string, generation: number): string {
  return `${civ}-leader-${generation}`;
}

function artifactId(world: AutopolisWorld, proposal: AutopolisDecisionProposal, parentId: string): string {
  return `doctrine-${hashText(`${world.seed}|${proposal.pointTick}|${proposal.civ}|${parentId}|${proposal.proposedDoctrineText ?? ""}|${(proposal.proposedClaims ?? []).join("|")}`)}`;
}

function defaultPriorities(): AutopolisPriority[] {
  return PRIORITY_KEYS.map((key, index) => ({ key, weight: index === 0 ? 1 : 0.5, rank: index + 1 }));
}

function identityFor(civ: string, tick: number, modelAssignment: string): AutopolisCivilizationIdentity {
  const artifact: AutopolisDoctrineArtifact = {
    id: `doctrine-${civ}-founding`,
    parentId: null,
    authorLeaderId: leaderId(civ, 1),
    createdAt: tick,
    text: "",
    claims: [],
  };
  return {
    civ,
    name: civ,
    foundingValues: ["survival", "continuity"],
    lineage: [artifact.id],
    leader: {
      id: leaderId(civ, 1),
      generation: 1,
      predecessorId: null,
      modelAssignment,
      personality: { ...DEFAULT_PERSONALITY },
      priorities: defaultPriorities(),
      doctrine: artifact,
      policy: { ...DEFAULT_POLICY },
      shortMemory: [],
      bornAt: tick,
    },
  };
}

export interface NewAutopolisWorldOptions {
  totalLand?: number;
  population?: number;
  food?: number;
  timber?: number;
  ore?: number;
  wealth?: number;
  modelAssignments?: Record<string, string>;
}

export function newAutopolisWorld(seed: number, civIds: string[], options: NewAutopolisWorldOptions = {}): AutopolisWorld {
  const ids = [...new Set(civIds)].sort();
  const totalLand = Math.max(ids.length, Math.floor(options.totalLand ?? 24));
  const civs = ids.map((id) => ({
    id,
    population: Math.max(0, options.population ?? 100),
    territory: 1,
    stock: {
      food: Math.max(0, options.food ?? 200),
      timber: Math.max(0, options.timber ?? 80),
      ore: Math.max(0, options.ore ?? 40),
      wealth: Math.max(0, options.wealth ?? 50),
    },
    soldiers: 5,
    advances: [],
    alive: true,
    identity: identityFor(id, 0, options.modelAssignments?.[id] ?? "scripted"),
    ticksSinceDecision: 0,
  } satisfies AutopolisCiv));
  return { ruleset: AUTOPOLIS_RULESET, tick: 0, seed, totalLand, freeLand: totalLand - ids.length, civs };
}

function event(tick: number, civ: string | null, kind: AutopolisEventKind, detail: string, evidence: string[], sourceId: string): AutopolisEvent {
  return { tick, civ, kind, detail, evidence, sourceId };
}

function remember(leader: AutopolisLeaderIdentity, facts: AutopolisMemoryFact[]): AutopolisLeaderIdentity {
  const all = [...leader.shortMemory, ...facts].map((fact) => ({
    ...fact,
    text: fact.text.slice(0, MAX_TEXT),
    salience: clamp(fact.salience, 0, 1),
  }));
  all.sort((a, b) => b.salience - a.salience || b.tick - a.tick || a.sourceId.localeCompare(b.sourceId));
  return { ...leader, shortMemory: all.slice(0, MAX_SHORT_MEMORY) };
}

function factsForEvents(events: AutopolisEvent[]): Map<string, AutopolisMemoryFact[]> {
  const facts = new Map<string, AutopolisMemoryFact[]>();
  for (const item of events) {
    if (!item.civ) continue;
    const list = facts.get(item.civ) ?? [];
    list.push({ tick: item.tick, kind: item.kind === "RULING_ACCEPTED" ? "decision" : "event", text: item.detail, sourceId: item.sourceId, salience: item.kind === "RESOURCE_GAINED" ? 0.2 : 0.8 });
    facts.set(item.civ, list);
  }
  return facts;
}

function production(civ: AutopolisCiv, harvest: number): AutopolisStock {
  const p = normalizePolicy(civ.identity.leader.policy);
  const capacity = Math.min(civ.population, civ.territory * 25);
  const watch = p.posture === "GUARD" ? 0.94 : 1;
  return {
    food: capacity * p.farming * 2.5 * harvest * watch,
    timber: capacity * p.forestry * 0.7 * watch,
    ore: capacity * p.mining * 0.45 * watch,
    wealth: capacity * p.trade * 0.5 * watch,
  };
}

function applyNaturalCiv(world: AutopolisWorld, civ: AutopolisCiv, tick: number): { civ: AutopolisCiv; events: AutopolisEvent[] } {
  const events: AutopolisEvent[] = [];
  const source = `${world.ruleset}:${tick}:${civ.id}`;
  const p = normalizePolicy(civ.identity.leader.policy);
  const gain = production(civ, season(world.seed, tick));
  const eaten = civ.population * 0.8 + civ.soldiers * 1.5;
  const upkeep = civ.soldiers * 0.6;
  const stock: AutopolisStock = {
    food: civ.stock.food + gain.food - eaten,
    timber: civ.stock.timber + gain.timber,
    ore: civ.stock.ore + gain.ore,
    wealth: civ.stock.wealth + gain.wealth - upkeep,
  };
  const gainedResource = RESOURCES.find((resource) => gain[resource] > 0.01);
  if (gainedResource) events.push(event(tick, civ.id, "RESOURCE_GAINED", `${gainedResource} +${gain[gainedResource].toFixed(2)}`, [`production ${gainedResource}`, `territory ${civ.territory}`], `${source}:resources`));

  let population = civ.population;
  let soldiers = civ.soldiers;
  if (stock.food < 0) {
    const lost = Math.min(population, Math.ceil(-stock.food / 2));
    population -= lost;
    stock.food = 0;
    events.push(event(tick, civ.id, "FAMINE", `${lost} habitants morts de faim`, [`food 0`, `population ${civ.population}`], `${source}:famine`));
  }
  if (stock.wealth < 0) {
    const deserted = Math.min(soldiers, Math.ceil(-stock.wealth / 2));
    soldiers -= deserted;
    stock.wealth = 0;
    events.push(event(tick, civ.id, "SHORTAGE", `${deserted} soldats desertent`, [`wealth 0`, `soldiers ${civ.soldiers}`], `${source}:treasury`));
  }

  // A small, seed-derived crisis is observable state, never an unlogged random
  // side effect. Its ceiling keeps one unlucky year from erasing a culture.
  if (roll(world.seed, tick, civ.id, 7) < 0.025 && population > 1) {
    const lost = Math.min(Math.max(1, Math.floor(population * 0.05)), population - 1);
    population -= lost;
    stock.food = Math.max(0, stock.food * 0.85);
    events.push(event(tick, civ.id, "LOSS", `crise : ${lost} pertes`, [`seed ${world.seed}`, `population ${civ.population}`], `${source}:crisis`));
  }

  if (stock.food > population * 6) population += Math.max(1, Math.floor(population * 0.02));
  soldiers = Math.max(0, Math.round(soldiers + population * p.military * 0.05 - soldiers * 0.02));

  const advances = [...civ.advances];
  const possible: Array<[string, boolean]> = [
    ["irrigation", stock.food >= 250],
    ["masonry", stock.timber >= 250 && civ.territory >= 3],
    ["metallurgy", stock.ore >= 150],
    ["coinage", stock.wealth >= 250],
    ["engineering", advances.includes("masonry") && advances.includes("metallurgy")],
  ];
  for (const [name, reached] of possible) {
    if (reached && !advances.includes(name)) {
      advances.push(name);
      events.push(event(tick, civ.id, "ADVANCE", `progres : ${name}`, [`${name} threshold reached`], `${source}:advance:${name}`));
    }
  }

  let alive = civ.alive;
  if (population <= 0) {
    population = 0;
    alive = false;
    events.push(event(tick, civ.id, "COLLAPSE", "la civilisation s'est eteinte", ["population 0"], `${source}:collapse`));
  }
  const next: AutopolisCiv = {
    ...civ,
    population,
    soldiers,
    stock: Object.fromEntries(RESOURCES.map((resource) => [resource, Math.max(0, Number(stock[resource].toFixed(2))) ])) as AutopolisStock,
    advances,
    alive,
    ticksSinceDecision: civ.ticksSinceDecision + 1,
  };
  return { civ: next, events };
}

function expand(world: AutopolisWorld, civ: AutopolisCiv, tick: number): { civ: AutopolisCiv; freeLand: number; events: AutopolisEvent[] } {
  const p = normalizePolicy(civ.identity.leader.policy);
  const wants = civ.alive && civ.population > Math.max(20, civ.territory * 20) && civ.stock.timber >= 20 && p.expansion !== 0;
  if (!wants) return { civ, freeLand: world.freeLand, events: [] };
  const source = `${world.ruleset}:${tick}:${civ.id}:expansion`;
  if (world.freeLand <= 0) {
    return { civ, freeLand: 0, events: [event(tick, civ.id, "BORDER", "aucune terre libre pour s'etendre", [`freeLand 0`, `territory ${civ.territory}`], source)] };
  }
  return {
    civ: { ...civ, territory: civ.territory + 1, stock: { ...civ.stock, timber: Number(Math.max(0, civ.stock.timber - 20).toFixed(2)) } },
    freeLand: world.freeLand - 1,
    events: [event(tick, civ.id, "EXPANSION", `expansion vers une terre ${p.claim}`, [`freeLand ${world.freeLand}`, `claim ${p.claim}`], source)],
  };
}

function applyFacts(world: AutopolisWorld, events: AutopolisEvent[]): AutopolisWorld {
  const byCiv = factsForEvents(events);
  return {
    ...world,
    civs: world.civs.map((civ) => {
      const facts = byCiv.get(civ.id);
      return facts ? { ...civ, identity: { ...civ.identity, leader: remember(civ.identity.leader, facts) } } : civ;
    }),
  };
}

/** Advance one year. No model, clock, network, or mutable RNG is consulted. */
export function stepAutopolis(world: AutopolisWorld): AutopolisStepResult {
  const tick = world.tick + 1;
  let freeLand = world.freeLand;
  const events: AutopolisEvent[] = [];
  const civs = [...world.civs].sort((a, b) => a.id.localeCompare(b.id)).map((civ) => {
    if (!civ.alive) return civ;
    const natural = applyNaturalCiv(world, civ, tick);
    events.push(...natural.events);
    const expanded = expand({ ...world, freeLand }, natural.civ, tick);
    freeLand = expanded.freeLand;
    events.push(...expanded.events);
    return expanded.civ;
  });
  const next = applyFacts({ ...world, tick, freeLand, civs }, events);
  return { world: next, events };
}

function invalidProposal(world: AutopolisWorld, proposal: AutopolisDecisionProposal): string | null {
  if (!Number.isInteger(proposal.pointTick) || proposal.pointTick !== world.tick + 1) return "pointTick doit viser le prochain tour";
  if (proposal.reasoning.length > MAX_REASONING) return "raisonnement trop long";
  const civ = world.civs.find((item) => item.id === proposal.civ);
  if (!civ || !civ.alive) return "civilisation absente ou eteinte";
  if (civ.identity.leader.id !== proposal.leaderId) return "identite du dirigeant obsolète";
  const patch = proposal.doctrinePatch ?? {};
  for (const key of ["farming", "forestry", "mining", "trade", "military", "expansion"] as const) {
    if (patch[key] !== undefined && (!Number.isFinite(patch[key]) || patch[key] < 0 || patch[key] > 1)) return `${key} hors bornes`;
  }
  if (patch.posture !== undefined && !POSTURES.includes(patch.posture)) return "posture illegale";
  if (patch.claim !== undefined && !LAND_KINDS.includes(patch.claim)) return "claim illegal";
  if (patch.creed !== undefined && patch.creed.length > MAX_TEXT) return "creed trop long";
  if (proposal.proposedDoctrineText !== undefined && proposal.proposedDoctrineText.length > MAX_TEXT) return "artefact trop long";
  if ((proposal.proposedClaims ?? []).length > MAX_CLAIMS || (proposal.proposedClaims ?? []).some((claim) => claim.length > MAX_TEXT)) return "claims trop longs";
  if (proposal.proposedPersonalityPatch) {
    for (const value of Object.values(proposal.proposedPersonalityPatch)) if (value !== undefined && (!Number.isFinite(value) || value < -1 || value > 1)) return "personnalite hors bornes";
  }
  if (proposal.proposedPriorityPatch) {
    if (proposal.proposedPriorityPatch.length !== PRIORITY_KEYS.length) return "priorites incompletes";
    const keys = proposal.proposedPriorityPatch.map((item) => item.key);
    if (new Set(keys).size !== PRIORITY_KEYS.length || !keys.every((key) => PRIORITY_KEYS.includes(key))) return "priorites dupliquees";
    if (proposal.proposedPriorityPatch.some((item) => !Number.isFinite(item.weight) || item.weight < 0 || item.weight > 1 || !Number.isInteger(item.rank) || item.rank < 1 || item.rank > PRIORITY_KEYS.length)) return "priorite hors bornes";
    if (new Set(proposal.proposedPriorityPatch.map((item) => item.rank)).size !== PRIORITY_KEYS.length) return "rangs de priorite dupliques";
  }
  return null;
}

function applyAcceptedRuling(world: AutopolisWorld, ruling: AutopolisAcceptedRuling): AutopolisStepResult {
  const civs = world.civs.map((civ) => {
    if (civ.id !== ruling.proposal.civ) return civ;
    const leader = civ.identity.leader;
    const policy = normalizePolicy({ ...leader.policy, ...(ruling.proposal.doctrinePatch ?? {}) });
    let nextLeader: AutopolisLeaderIdentity = { ...leader, policy };
    if (ruling.proposal.proposedPersonalityPatch) nextLeader = { ...nextLeader, personality: { ...leader.personality, ...ruling.proposal.proposedPersonalityPatch } };
    if (ruling.proposal.proposedPriorityPatch) nextLeader = { ...nextLeader, priorities: clone(ruling.proposal.proposedPriorityPatch) };
    const text = ruling.proposal.proposedDoctrineText;
    if (text !== undefined) {
      const artifact: AutopolisDoctrineArtifact = {
        id: ruling.acceptedDoctrineArtifactId ?? artifactId(world, ruling.proposal, leader.doctrine.id),
        parentId: leader.doctrine.id,
        authorLeaderId: leader.id,
        createdAt: world.tick,
        text,
        claims: [...(ruling.proposal.proposedClaims ?? [])].slice(0, MAX_CLAIMS),
      };
      nextLeader = { ...nextLeader, doctrine: artifact, policy: { ...nextLeader.policy, creed: text } };
    }
    nextLeader = remember(nextLeader, [{ tick: world.tick, kind: "decision", text: ruling.proposal.reasoning, sourceId: ruling.id, salience: 0.7 }]);
    return {
      ...civ,
      ticksSinceDecision: 0,
      identity: {
        ...civ.identity,
        leader: nextLeader,
        lineage: nextLeader.doctrine.id === leader.doctrine.id ? civ.identity.lineage : [...civ.identity.lineage, nextLeader.doctrine.id],
      },
    };
  });
  const effects = ruling.engineEffects.length > 0 ? ruling.engineEffects : ["doctrine normalisee par le moteur"];
  const accepted = event(world.tick, ruling.proposal.civ, "RULING_ACCEPTED", effects.join("; "), effects, ruling.id);
  return { world: { ...world, civs }, events: [accepted] };
}

/** Validate a proposal, let the engine advance, then apply only legal effects. */
export function acceptAutopolisProposal(world: AutopolisWorld, proposal: AutopolisDecisionProposal, provenance: AutopolisServiceProvenance = {}): AutopolisAcceptanceResult {
  const error = invalidProposal(world, proposal);
  if (error) {
    const rejection = event(world.tick, proposal.civ, "PROPOSAL_REJECTED", error, ["world unchanged", `point ${proposal.pointTick}`], `${AUTOPOLIS_RULESET}:${world.tick}:rejected:${hashText(JSON.stringify(proposal))}`);
    return { world, events: [rejection], ruling: null };
  }
  const deferredBy = Math.max(0, Math.floor(provenance.deferredBy ?? 0));
  const ruling: AutopolisAcceptedRuling = {
    id: `ruling-${hashText(`${world.seed}|${JSON.stringify(proposal)}|${provenance.model ?? ""}|${provenance.fallback ?? ""}`)}`,
    askedAt: proposal.pointTick,
    appliedAt: proposal.pointTick + deferredBy,
    deferredBy,
    proposal: clone(proposal),
    model: provenance.model ?? null,
    fallback: provenance.fallback ?? null,
    acceptedDoctrineArtifactId: proposal.proposedDoctrineText === undefined ? null : artifactId(world, proposal, world.civs.find((civ) => civ.id === proposal.civ)!.identity.leader.doctrine.id),
    engineEffects: ["stocks, population et territoire restent souverains au moteur"],
  };
  const stepped = stepAutopolis(world);
  if (deferredBy > 0) {
    const deferred = event(stepped.world.tick, proposal.civ, "RULING_DEFERRED", `decision differee de ${deferredBy} tour(s)`, [`askedAt ${ruling.askedAt}`, `appliedAt ${ruling.appliedAt}`], ruling.id);
    return { world: stepped.world, events: [...stepped.events, deferred], ruling };
  }
  const applied = applyAcceptedRuling(stepped.world, ruling);
  return { world: applied.world, events: [...stepped.events, ...applied.events], ruling };
}

export function succeedAutopolisLeader(world: AutopolisWorld, civId: string): AutopolisStepResult & { succession: AutopolisSuccessionEntry | null } {
  const civ = world.civs.find((item) => item.id === civId);
  if (!civ || !civ.alive) return { world, events: [], succession: null };
  const previous = civ.identity.leader;
  const next: AutopolisLeaderIdentity = {
    ...clone(previous),
    id: leaderId(civId, previous.generation + 1),
    generation: previous.generation + 1,
    predecessorId: previous.id,
    bornAt: world.tick,
    doctrine: { ...previous.doctrine },
    shortMemory: [],
  };
  const memory = remember(next, [{ tick: world.tick, kind: "inheritance", text: `artefact transmis depuis ${previous.id}`, sourceId: previous.doctrine.id, salience: 1 }]);
  const leader = { ...memory, shortMemory: memory.shortMemory.slice(0, MAX_SHORT_MEMORY) };
  const succession: AutopolisSuccessionEntry = { type: "succession", tick: world.tick, civ: civId, leader: clone(leader) };
  const nextWorld: AutopolisWorld = {
    ...world,
    civs: world.civs.map((item) => item.id === civId ? { ...item, ticksSinceDecision: 0, identity: { ...item.identity, leader } } : item),
  };
  const transmission = event(world.tick, civId, "CULTURE_TRANSMITTED", `artefact ${leader.doctrine.id} transmis`, [`parent ${previous.doctrine.id}`, `successor ${leader.id}`], `${AUTOPOLIS_RULESET}:${world.tick}:${civId}:inheritance`);
  const successionEvent = event(world.tick, civId, "SUCCESSION", `${previous.id} devient ${leader.id}`, [`generation ${leader.generation}`], `${AUTOPOLIS_RULESET}:${world.tick}:${civId}:succession`);
  return { world: nextWorld, events: [transmission, successionEvent], succession };
}

export function newAutopolisJournal(origin: AutopolisWorld): AutopolisJournal {
  return { ruleset: AUTOPOLIS_RULESET, seed: origin.seed, origin: clone(origin), livedTo: origin.tick, entries: [] };
}

/** Replay uses only the origin, seed, and accepted journal entries. */
export function replayAutopolis(journal: AutopolisJournal, untilTick = journal.livedTo): AutopolisStepResult {
  if (journal.ruleset !== AUTOPOLIS_RULESET) throw new Error(`unsupported ruleset: ${journal.ruleset}`);
  if (journal.origin.seed !== journal.seed) throw new Error("journal seed does not match origin");
  let world = clone(journal.origin);
  const events: AutopolisEvent[] = [];
  const applyEntriesAtTick = (tick: number): void => {
    const entries = journal.entries.filter((entry) => (entry.type === "ruling" ? entry.ruling.appliedAt === tick : entry.tick === tick));
    for (const entry of entries) {
      if (entry.type === "ruling") {
        const applied = applyAcceptedRuling(world, entry.ruling);
        world = applied.world;
        events.push(...applied.events);
      } else {
        const civ = world.civs.find((item) => item.id === entry.civ);
        if (!civ || !civ.alive) continue;
        world = { ...world, civs: world.civs.map((item) => item.id === entry.civ ? { ...item, ticksSinceDecision: 0, identity: { ...item.identity, leader: clone(entry.leader) } } : item) };
        events.push(event(world.tick, entry.civ, "SUCCESSION", `succession rejouee : ${entry.leader.id}`, [`leader ${entry.leader.id}`], `${AUTOPOLIS_RULESET}:${world.tick}:${entry.civ}:succession`));
      }
    }
  };
  applyEntriesAtTick(world.tick);
  while (world.tick < untilTick) {
    const stepped = stepAutopolis(world);
    world = stepped.world;
    events.push(...stepped.events);
    applyEntriesAtTick(world.tick);
  }
  return { world, events };
}

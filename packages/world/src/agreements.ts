import { z } from "zod";
import { FactionIdSchema, type FactionId } from "@abs/contracts";
import { affordable, pay, round as round2 } from "./development.js";
import type { Stock, World } from "./state.js";

/**
 * Agreements — bilateral diplomacy with obligations you can check (v10).
 *
 * One module, like infrastructure.ts: schemas, rules and helpers together. It
 * never imports the spectator; it reads a structural context so the spectator
 * can hand its own cloned state in without creating a cycle.
 *
 * The design it implements lives in docs/diplomacy-v10-design.md, and the
 * comments below carry the defect each rule answers — several of them were
 * found in the draft before a line was written.
 */

export const AGREEMENT_KINDS = ["nonaggression", "transfer"] as const;
export const AgreementKindSchema = z.enum(AGREEMENT_KINDS);
export type AgreementKind = z.infer<typeof AgreementKindSchema>;

export const PACT_DURATIONS = [4, 8, 12] as const;
export const PactDurationSchema = z.union([
  z.literal(4),
  z.literal(8),
  z.literal(12),
]);

/** Offered or demanded goods. Absent means nothing of that kind. */
export const ParcelSchema = z
  .object({
    food: z.number().int().nonnegative().default(0),
    timber: z.number().int().nonnegative().default(0),
    ore: z.number().int().nonnegative().default(0),
    wealth: z.number().int().nonnegative().default(0),
  })
  .strict();
export type Parcel = z.infer<typeof ParcelSchema>;

export const AgreementCommandSchema = z
  .object({
    action: z.enum(["propose", "accept", "decline", "renounce"]),
    offerId: z.string().min(1).max(200).nullable().default(null),
    target: FactionIdSchema.nullable().default(null),
    kind: AgreementKindSchema.nullable().default(null),
    duration: PactDurationSchema.nullable().default(null),
    give: ParcelSchema.nullable().default(null),
    receive: ParcelSchema.nullable().default(null),
  })
  .strict();
export type AgreementCommand = z.infer<typeof AgreementCommandSchema>;

export const AgreementOfferSchema = z
  .object({
    id: z.string().min(1).max(200),
    from: FactionIdSchema,
    to: FactionIdSchema,
    kind: AgreementKindSchema,
    duration: PactDurationSchema.nullable(),
    give: ParcelSchema,
    receive: ParcelSchema,
    issuedRound: z.number().int().nonnegative(),
    expiresRound: z.number().int().nonnegative(),
  })
  .strict();
export type AgreementOffer = z.infer<typeof AgreementOfferSchema>;

export const AgreementPactSchema = z
  .object({
    id: z.string().min(1).max(200),
    a: FactionIdSchema,
    b: FactionIdSchema,
    startRound: z.number().int().nonnegative(),
    endRound: z.number().int().nonnegative(),
  })
  .strict();
export type AgreementPact = z.infer<typeof AgreementPactSchema>;

export const AGREEMENT_EVENTS = [
  "OFFERED",
  "OFFER_EXPIRED",
  "DECLINED",
  "TRANSFER",
  "PACT",
  "PACT_FULFILLED",
  "PACT_BROKEN",
  "PACT_DISSOLVED",
] as const;
export const AgreementEventSchema = z.enum(AGREEMENT_EVENTS);
export type AgreementEventKind = z.infer<typeof AgreementEventSchema>;

export const AgreementHistoryEntrySchema = z
  .object({
    round: z.number().int().nonnegative(),
    kind: AgreementEventSchema,
    a: FactionIdSchema,
    b: FactionIdSchema,
    detail: z.string().max(400),
  })
  .strict();
export type AgreementHistoryEntry = z.infer<typeof AgreementHistoryEntrySchema>;

export const TRUST_FLOOR = -100;
export const TRUST_CEILING = 100;
export const OFFER_CAP = 12;
export const HISTORY_CAP = 40;
export const OFFER_LIFETIME = 3;

/** What each outcome does to the trust its partner holds in the author. */
export const TRUST_DELTAS = {
  fulfilled: 15,
  renounced: -25,
  brokenByWar: -35,
} as const;

export const AgreementStateSchema = z
  .object({
    offers: z.array(AgreementOfferSchema).max(OFFER_CAP),
    pacts: z.array(AgreementPactSchema).max(64),
    history: z.array(AgreementHistoryEntrySchema).max(HISTORY_CAP),
    trust: z.record(z.string(), z.record(z.string(), z.number())),
    seq: z.record(z.string(), z.number().int().nonnegative()),
  })
  .strict();
export type AgreementState = z.infer<typeof AgreementStateSchema>;

/** Structural context: the world plus the optional v10 records. */
export interface AgreementContext {
  world: World;
  agreement?: AgreementState;
}

export const emptyAgreement = (): AgreementState => ({
  offers: [],
  pacts: [],
  history: [],
  trust: {},
  seq: {},
});

/**
 * The v10 records, or a fault — the v9 lesson, kept.
 *
 * Callers assemble their context inline, so a helper that answered a missing
 * `agreement` by creating one would write into that throwaway object: the
 * resources moved, the pact recorded nowhere, and not one word of complaint.
 * The schema requires the records under `spectator-10`; their absence is an
 * engine fault.
 */
function records(ctx: AgreementContext): AgreementState {
  if (!ctx.agreement) throw new Error("Agreement records required");
  return ctx.agreement;
}

/** Refusal reasons, in the engine's language. Never a silent rewrite. */
export const AGREEMENT_ISSUES = {
  inactive: "Civilisation inactive",
  unknownTarget: "Civilisation inconnue",
  selfTarget: "Un accord se passe avec une autre civilisation",
  missingTarget: "Cible manquante",
  missingKind: "Type d'accord manquant",
  missingDuration: "Durée de pacte manquante",
  emptyTransfer: "Un échange doit porter sur au moins une ressource",
  offersFull: "Trop d'offres en attente",
  unknownOffer: "Offre inconnue ou expirée",
  notAddressed: "Cette offre ne vous est pas adressée",
  atWar: "Impossible pendant une guerre",
  pactActive: "Un pacte est déjà actif",
  insufficientOfferer: "Réserves insuffisantes chez l'offreur",
  insufficientAccepter: "Réserves insuffisantes",
  noPact: "Aucun pacte actif à rompre",
  missingOffer: "Identifiant d'offre manquant",
} as const;

const EMPTY_PARCEL: Parcel = { food: 0, timber: 0, ore: 0, wealth: 0 };
const parcelTotal = (parcel: Parcel) =>
  parcel.food + parcel.timber + parcel.ore + parcel.wealth;
const describe = (parcel: Parcel) =>
  (
    [
      ["nourriture", parcel.food],
      ["bois", parcel.timber],
      ["minerai", parcel.ore],
      ["richesse", parcel.wealth],
    ] as const
  )
    .filter(([, amount]) => amount > 0)
    .map(([name, amount]) => `${amount} ${name}`)
    .join(", ") || "rien";

const civOf = (world: World, id: string) => world.civs.find((c) => c.id === id);
const alive = (world: World, id: string) => {
  const civ = civOf(world, id);
  return !!civ && civ.fellOnTick === null && civ.population > 0;
};
const atWar = (world: World, a: string, b: string) =>
  (world.simulation?.relations ?? []).some(
    (relation) =>
      relation.status === "war" &&
      [relation.a, relation.b].includes(a as FactionId) &&
      [relation.a, relation.b].includes(b as FactionId),
  );

/** One pact per pair, whichever way round the pair is written. */
const pactBetween = (state: AgreementState, a: string, b: string) =>
  state.pacts.find(
    (pact) => (pact.a === a && pact.b === b) || (pact.a === b && pact.b === a),
  );

/** Deterministic identity: no clock, no counter outside the replayed state. */
export function agreementId(
  round: number,
  from: string,
  to: string,
  kind: AgreementKind,
  seq: number,
): string {
  return `agreement-v1:${round}:${from}:${to}:${kind}:${seq}`;
}

function remember(state: AgreementState, entry: AgreementHistoryEntry): void {
  state.history.push(entry);
  // A cache of recent moves, never the archive: the replay's events hold the
  // full record, so dropping the oldest here loses nothing auditable.
  while (state.history.length > HISTORY_CAP) state.history.shift();
}

export function trustOf(
  state: AgreementState,
  civ: string,
  target: string,
): number {
  return state.trust[civ]?.[target] ?? 0;
}

function moveTrust(
  state: AgreementState,
  holder: string,
  about: string,
  delta: number,
): void {
  const row = (state.trust[holder] ??= {});
  const next = (row[about] ?? 0) + delta;
  row[about] = Math.max(TRUST_FLOOR, Math.min(TRUST_CEILING, next));
}

/** Both sides gain or lose together — a pact is held by two. */
function moveTrustBoth(
  state: AgreementState,
  a: string,
  b: string,
  delta: number,
): void {
  moveTrust(state, a, b, delta);
  moveTrust(state, b, a, delta);
}

const settle = (stock: Stock, incoming: Parcel): void => {
  stock.food = round2(stock.food + incoming.food);
  stock.timber = round2(stock.timber + incoming.timber);
  stock.ore = round2(stock.ore + incoming.ore);
  stock.wealth = round2(stock.wealth + incoming.wealth);
};

/** Offers past their life are removed and recorded; they never execute. */
export function expireOffers(
  ctx: AgreementContext,
  round: number,
): AgreementContext {
  const state = records(ctx);
  const kept: AgreementOffer[] = [];
  for (const offer of state.offers) {
    if (round < offer.expiresRound) {
      kept.push(offer);
      continue;
    }
    remember(state, {
      round,
      kind: "OFFER_EXPIRED",
      a: offer.from,
      b: offer.to,
      detail: `Offre expirée : ${offer.kind}`,
    });
  }
  state.offers = kept;
  return ctx;
}

function proposeIssue(
  ctx: AgreementContext,
  state: AgreementState,
  actor: string,
  command: AgreementCommand,
): string | null {
  if (!command.target) return AGREEMENT_ISSUES.missingTarget;
  if (!command.kind) return AGREEMENT_ISSUES.missingKind;
  if (command.target === actor) return AGREEMENT_ISSUES.selfTarget;
  if (!alive(ctx.world, command.target)) return AGREEMENT_ISSUES.unknownTarget;
  if (atWar(ctx.world, actor, command.target)) return AGREEMENT_ISSUES.atWar;
  if (command.kind === "nonaggression") {
    if (!command.duration) return AGREEMENT_ISSUES.missingDuration;
    if (pactBetween(state, actor, command.target))
      return AGREEMENT_ISSUES.pactActive;
    return null;
  }
  const give = command.give ?? EMPTY_PARCEL;
  const receive = command.receive ?? EMPTY_PARCEL;
  // An exchange with nothing on either side is not an exchange.
  if (parcelTotal(give) + parcelTotal(receive) === 0)
    return AGREEMENT_ISSUES.emptyTransfer;
  return null;
}

/**
 * Applies one agreement command for the acting civilisation.
 *
 * Mutates the already-cloned context and returns the refusal reason, or null.
 * Every refusal is named so the caller can record it: a rejected agreement is
 * kept in the journal, never quietly turned into something legal.
 */
export function applyAgreement(
  ctx: AgreementContext,
  actor: string,
  command: AgreementCommand,
  round: number,
): string | null {
  const state = records(ctx);
  if (!alive(ctx.world, actor)) return AGREEMENT_ISSUES.inactive;

  if (command.action === "propose") {
    const issue = proposeIssue(ctx, state, actor, command);
    if (issue) return issue;
    const target = command.target!;
    const kind = command.kind!;
    // A fresh proposal replaces this pair's pending one of the same kind: a
    // ruler speaks once, and the last word is the offer.
    state.offers = state.offers.filter(
      (offer) =>
        !(offer.from === actor && offer.to === target && offer.kind === kind),
    );
    if (state.offers.length >= OFFER_CAP) return AGREEMENT_ISSUES.offersFull;
    const seq = (state.seq[actor] ?? 0) + 1;
    state.seq[actor] = seq;
    const offer: AgreementOffer = {
      id: agreementId(round, actor, target, kind, seq),
      from: actor as FactionId,
      to: target,
      kind,
      duration: kind === "nonaggression" ? command.duration : null,
      give: command.give ?? EMPTY_PARCEL,
      receive: command.receive ?? EMPTY_PARCEL,
      issuedRound: round,
      expiresRound: round + OFFER_LIFETIME,
    };
    state.offers.push(offer);
    remember(state, {
      round,
      kind: "OFFERED",
      a: offer.from,
      b: offer.to,
      detail:
        kind === "nonaggression"
          ? `Pacte de non-agression proposé pour ${offer.duration} manches`
          : `Échange proposé : donne ${describe(offer.give)}, demande ${describe(offer.receive)}`,
    });
    return null;
  }

  if (command.action === "accept" || command.action === "decline") {
    /**
     * The offer is named by its id, never rebuilt from target and kind.
     *
     * A proposal replaces this pair's pending one, so between the moment a
     * ruler reads its options and the moment it answers, the offer it means
     * can have been replaced by another with different terms. Matching on
     * target and kind would have accepted that other contract in its place.
     */
    if (!command.offerId) return AGREEMENT_ISSUES.missingOffer;
    const offer = state.offers.find((entry) => entry.id === command.offerId);
    if (!offer) return AGREEMENT_ISSUES.unknownOffer;
    if (offer.to !== actor) return AGREEMENT_ISSUES.notAddressed;

    const drop = () => {
      state.offers = state.offers.filter((entry) => entry.id !== offer.id);
    };

    if (command.action === "decline") {
      drop();
      remember(state, {
        round,
        kind: "DECLINED",
        a: actor as FactionId,
        b: offer.from,
        detail: `Offre refusée : ${offer.kind}`,
      });
      return null;
    }

    if (!alive(ctx.world, offer.from)) return AGREEMENT_ISSUES.unknownTarget;
    if (atWar(ctx.world, actor, offer.from)) return AGREEMENT_ISSUES.atWar;

    if (offer.kind === "nonaggression") {
      // The draft also refused when an offer existed, which made every
      // acceptance impossible: accepting is precisely what an offer is for.
      // Only a pact already standing blocks a new one.
      if (pactBetween(state, actor, offer.from))
        return AGREEMENT_ISSUES.pactActive;
      drop();
      const seq = (state.seq[actor] ?? 0) + 1;
      state.seq[actor] = seq;
      state.pacts.push({
        id: agreementId(round, offer.from, actor, "nonaggression", seq),
        a: offer.from,
        b: actor as FactionId,
        startRound: round,
        endRound: round + (offer.duration ?? PACT_DURATIONS[0]),
      });
      remember(state, {
        round,
        kind: "PACT",
        a: offer.from,
        b: actor as FactionId,
        detail: `Pacte de non-agression conclu pour ${offer.duration} manches`,
      });
      return null;
    }

    // Both sides pay, so both sides are checked before anything moves.
    const offerer = civOf(ctx.world, offer.from)!;
    const accepter = civOf(ctx.world, actor)!;
    if (!affordable(offerer.stock, offer.give))
      return AGREEMENT_ISSUES.insufficientOfferer;
    if (!affordable(accepter.stock, offer.receive))
      return AGREEMENT_ISSUES.insufficientAccepter;
    // Atomic: the four movements happen together or the refusal above already
    // returned. No partial exchange, no double execution.
    pay(offerer.stock, offer.give);
    pay(accepter.stock, offer.receive);
    settle(offerer.stock, offer.receive);
    settle(accepter.stock, offer.give);
    drop();
    remember(state, {
      round,
      kind: "TRANSFER",
      a: offer.from,
      b: actor as FactionId,
      detail: `Échange conclu : ${offer.from} donne ${describe(offer.give)}, reçoit ${describe(offer.receive)}`,
    });
    return null;
  }

  // renounce
  if (!command.target) return AGREEMENT_ISSUES.missingTarget;
  const pact = pactBetween(state, actor, command.target);
  if (!pact) return AGREEMENT_ISSUES.noPact;
  const partner = pact.a === actor ? pact.b : pact.a;
  state.pacts = state.pacts.filter((entry) => entry.id !== pact.id);
  // Only the partner's view of the author moves: breaking your own word does
  // not change what you think of them.
  moveTrust(state, partner, actor, TRUST_DELTAS.renounced);
  remember(state, {
    round,
    kind: "PACT_BROKEN",
    a: actor as FactionId,
    b: partner,
    detail: "Pacte rompu unilatéralement",
  });
  return null;
}

/**
 * A declared war breaks any pact between the belligerents.
 *
 * Called only for a war the engine actually accepted. A declaration the rules
 * refused — a truce still running — is not a betrayal: the ruler asked, the
 * engine said no, and nothing was broken.
 */
export function breakPactsOnWar(
  ctx: AgreementContext,
  aggressor: string,
  defender: string,
  round: number,
): AgreementContext {
  const state = records(ctx);
  const pact = pactBetween(state, aggressor, defender);
  if (!pact) return ctx;
  state.pacts = state.pacts.filter((entry) => entry.id !== pact.id);
  moveTrust(state, defender, aggressor, TRUST_DELTAS.brokenByWar);
  remember(state, {
    round,
    kind: "PACT_BROKEN",
    a: aggressor as FactionId,
    b: defender as FactionId,
    detail: "Pacte rompu par une déclaration de guerre",
  });
  return ctx;
}

/**
 * Offers and pacts of the dead go, without blame and without reward.
 *
 * The draft said "without blame" and stopped there. Without the other half, a
 * civilisation that died exactly on its pact's last round would have collected
 * a fidelity bonus for a pact nobody holds any more. Run this BEFORE
 * tickPacts, so a dissolved pact is never also counted as fulfilled.
 */
export function dissolveOnDeath(
  ctx: AgreementContext,
  round: number,
): AgreementContext {
  const state = records(ctx);
  const gone = (id: string) => !alive(ctx.world, id);
  state.offers = state.offers.filter((offer) => {
    if (!gone(offer.from) && !gone(offer.to)) return true;
    remember(state, {
      round,
      kind: "OFFER_EXPIRED",
      a: offer.from,
      b: offer.to,
      detail: "Offre dissoute : civilisation éteinte",
    });
    return false;
  });
  state.pacts = state.pacts.filter((pact) => {
    if (!gone(pact.a) && !gone(pact.b)) return true;
    remember(state, {
      round,
      kind: "PACT_DISSOLVED",
      a: pact.a,
      b: pact.b,
      detail: "Pacte dissous : civilisation éteinte",
    });
    return false;
  });
  return ctx;
}

/** A pact carried to its end raises the trust both sides hold. */
export function tickPacts(
  ctx: AgreementContext,
  round: number,
): AgreementContext {
  const state = records(ctx);
  const kept: AgreementPact[] = [];
  for (const pact of state.pacts) {
    if (round < pact.endRound) {
      kept.push(pact);
      continue;
    }
    moveTrustBoth(state, pact.a, pact.b, TRUST_DELTAS.fulfilled);
    remember(state, {
      round,
      kind: "PACT_FULFILLED",
      a: pact.a,
      b: pact.b,
      detail: "Pacte mené à son terme",
    });
  }
  state.pacts = kept;
  return ctx;
}

export interface AgreementView {
  incoming: AgreementOffer[];
  outgoing: AgreementOffer[];
  pacts: { id: string; partner: string; roundsLeft: number }[];
  trust: Record<string, number>;
  recent: AgreementHistoryEntry[];
}

/**
 * What one ruler may see. Read-only, and personal.
 *
 * An offer says what it asks for, never what the other side holds: a ruler
 * learns a partner is insolvent by being refused, not by reading their coffers.
 */
export function agreementView(
  ctx: AgreementContext,
  civ: string,
  round: number,
): AgreementView {
  const state = records(ctx);
  return {
    incoming: state.offers.filter((offer) => offer.to === civ),
    outgoing: state.offers.filter((offer) => offer.from === civ),
    pacts: state.pacts
      .filter((pact) => pact.a === civ || pact.b === civ)
      .map((pact) => ({
        id: pact.id,
        partner: pact.a === civ ? pact.b : pact.a,
        roundsLeft: Math.max(0, pact.endRound - round),
      })),
    trust: Object.fromEntries(
      ctx.world.civs
        .filter((other) => other.id !== civ)
        .map((other) => [other.id, trustOf(state, civ, other.id)]),
    ),
    recent: state.history.filter((entry) => entry.a === civ || entry.b === civ),
  };
}

import { z } from "zod";
import {
  CouncilDecisionSchema,
  SpectatorStateSchema,
  newSpectator,
  resolveCouncil,
  type SpectatorState,
  SPECTATOR_RULES,
} from "./spectator.js";
import { ServiceEvidenceSchema, FactionIdSchema } from "@abs/contracts";

export const CouncilAnswerSchema = z.object({
  civ: FactionIdSchema,
  decision: CouncilDecisionSchema.nullable(),
  source: z.enum(["local", "remote", "unavailable"]),
  model: z.string().nullable(),
  service: ServiceEvidenceSchema.nullable(),
  error: z.string().nullable(),
  review: z
    .object({
      attempts: z.literal(2),
      issues: z.array(z.string()).max(128),
      corrected: z.boolean(),
      secondError: z.string().nullable(),
    })
    .optional(),
});
export type CouncilAnswer = z.infer<typeof CouncilAnswerSchema>;
export const CampaignSchema = z
  .object({
    // Le meme catalogue que l etat : une campagne d une version que l etat
    // accepte doit pouvoir se parser, donc se rejouer.
    version: z.enum(SPECTATOR_RULES),
    id: z.string().regex(/^[a-z0-9-]{1,80}$/),
    seed: z.number().int().nonnegative().max(2147483647),
    mode: z.enum(["local", "remote"]),
    models: z.record(z.string().max(180)),
    maxTurns: z.number().int().min(12).max(300).optional(),
    turns: z
      .array(
        z.object({
          turn: z.number().int().nonnegative(),
          answers: z.array(CouncilAnswerSchema).max(4),
          signature: z.string(),
        }),
      )
      .max(1200),
    pending: z
      .object({
        turn: z.number().int().nonnegative(),
        answers: z.array(CouncilAnswerSchema).max(4),
      })
      .nullable(),
  })
  .superRefine((c, ctx) => {
    for (const [index, turn] of c.turns.entries())
      if (
        turn.turn !== index ||
        new Set(turn.answers.map((a) => a.civ)).size !== turn.answers.length ||
        turn.answers.some(
          (a) =>
            a.decision &&
            (a.decision.civ !== a.civ || a.decision.turn !== index),
        )
      )
        ctx.addIssue({ code: "custom", message: "Invalid turn ledger" });
    if (
      c.pending &&
      (c.pending.turn !== c.turns.length ||
        new Set(c.pending.answers.map((a) => a.civ)).size !==
          c.pending.answers.length ||
        c.pending.answers.some(
          (a) =>
            a.decision &&
            (a.decision.civ !== a.civ || a.decision.turn !== c.pending!.turn),
        ))
    )
      ctx.addIssue({ code: "custom", message: "Invalid pending council" });
  });
export type Campaign = z.infer<typeof CampaignSchema>;
/** Stable full-state digest for accidental corruption detection, not authentication. */
export function stateSignature(state: SpectatorState): string {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, value]) => [k, canonical(value)]),
          )
        : v;
  const text = JSON.stringify(canonical(SpectatorStateSchema.parse(state)));
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export function replayCampaign(campaign: Campaign) {
  const parsed = CampaignSchema.parse(campaign);
  let state = newSpectator(parsed.seed, parsed.version);
  const history = [state];
  const outcomes: ReturnType<typeof resolveCouncil>[] = [];
  for (const turn of parsed.turns) {
    const result = resolveCouncil(
      state,
      turn.answers.flatMap((a) => (a.decision ? [a.decision] : [])),
    );
    state = result.state;
    if (stateSignature(state) !== turn.signature)
      throw new Error(`Rejeu incohérent au tour ${turn.turn + 1}`);
    history.push(state);
    outcomes.push(result);
  }
  return { state, history, outcomes };
}

export type CampaignReplay = ReturnType<typeof replayCampaign>;

/**
 * Rejouer seulement ce qui est nouveau.
 *
 * Une partie suivie en direct gagne un tour toutes les 18 s. La rejouer depuis
 * le début à chaque fois coûtait une seconde de calcul à 480 tours — et le
 * serveur, qui rejouait pour la page, lui envoyait 31,5 Mo d'états pour un
 * fichier de 0,8 Mo. On repart donc du rejeu précédent quand la partie en est
 * la suite exacte : même graine, mêmes règles, et chaque tour déjà connu porte
 * la même signature. Sinon — partie remplacée, histoire réécrite —, rejeu
 * complet. Les tours ajoutés sont vérifiés comme les autres : W4 tient.
 */
export function extendReplay(
  previous: { campaign: Campaign; replay: CampaignReplay } | null,
  campaign: Campaign,
): CampaignReplay {
  const parsed = CampaignSchema.parse(campaign);
  const known = previous?.campaign.turns ?? [];
  const continues =
    previous !== null &&
    previous.campaign.id === parsed.id &&
    previous.campaign.seed === parsed.seed &&
    previous.campaign.version === parsed.version &&
    previous.replay.history.length === known.length + 1 &&
    known.length <= parsed.turns.length &&
    known.every((turn, i) => turn.signature === parsed.turns[i]!.signature);
  if (!continues) return replayCampaign(parsed);
  let state = previous.replay.state;
  const history = [...previous.replay.history];
  const outcomes = [...previous.replay.outcomes];
  for (const turn of parsed.turns.slice(known.length)) {
    const result = resolveCouncil(
      state,
      turn.answers.flatMap((a) => (a.decision ? [a.decision] : [])),
    );
    state = result.state;
    if (stateSignature(state) !== turn.signature)
      throw new Error(`Rejeu incohérent au tour ${turn.turn + 1}`);
    history.push(state);
    outcomes.push(result);
  }
  return { state, history, outcomes };
}

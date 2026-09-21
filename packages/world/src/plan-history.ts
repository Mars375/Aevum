import type { TrackedPlan } from "./strategic-plans.js";

/**
 * Décision, action, conséquence — reconstituées, jamais stockées.
 *
 * Le moteur ne garde que le plan courant d'une civilisation : son histoire
 * passée n'existe nulle part. Elle n'a pas besoin d'exister. Une campagne
 * conserve tous ses états, et le rejeu les reproduit à l'identique (W4) ; la
 * suite d'un plan se lit donc en parcourant cette histoire, sans un octet de
 * plus dans l'état ni une ligne de plus dans la signature de rejeu.
 *
 * Deux voix, et on ne les mélange pas. `rationale` est ce que le dirigeant a
 * écrit, mot pour mot. `detail` est ce que le moteur a mesuré — « Colons à
 * 3 case(s) de l'objectif », « La case de fondation est indisponible ». Rien
 * ici n'invente un raisonnement que personne n'a tenu.
 */

/** Entrée structurelle : juste ce qu'il faut, pour ne dépendre de personne. */
export interface PlanBearingState {
  world: { tick: number };
  sequence?: { round: number } | undefined;
  plans?: Record<string, TrackedPlan> | undefined;
}

export interface PlanStep {
  tick: number;
  round: number | null;
  status: TrackedPlan["status"];
  progress: number;
  /** Constat du moteur, jamais une interprétation. */
  detail: string;
}

export interface PlanChapter {
  kind: TrackedPlan["kind"];
  targetTile: number | null;
  targetCity: string | null;
  targetTech: string | null;
  targetBuilding: string | null;
  /** Les mots du dirigeant, verbatim. */
  rationale: string;
  startedAt: number;
  /** Le tour où il s'est conclu, ou null s'il court encore. */
  endedAt: number | null;
  outcome: TrackedPlan["status"];
  steps: PlanStep[];
}

const sameAim = (a: TrackedPlan, b: TrackedPlan) =>
  a.startedAt === b.startedAt &&
  a.kind === b.kind &&
  a.targetTile === b.targetTile &&
  a.targetCity === b.targetCity &&
  a.targetTech === b.targetTech &&
  a.targetBuilding === b.targetBuilding;

/** Un pas ne vaut d'être montré que s'il dit quelque chose de neuf. */
const moved = (previous: PlanStep | undefined, next: PlanStep) =>
  !previous ||
  previous.status !== next.status ||
  previous.detail !== next.detail ||
  Math.round(previous.progress * 100) !== Math.round(next.progress * 100);

/**
 * L'histoire des plans d'une civilisation, dans l'ordre où elle s'est écrite.
 *
 * Un chapitre par plan adopté. Un plan remplacé par un autre se referme sur le
 * dernier état qu'on lui a connu : le dirigeant a changé d'avis, et c'est un
 * fait de l'histoire, pas une anomalie à masquer.
 */
export function planHistory(
  history: readonly PlanBearingState[],
  civId: string,
): PlanChapter[] {
  const chapters: PlanChapter[] = [];
  let current: TrackedPlan | null = null;

  for (const state of history) {
    const plan = state.plans?.[civId];
    if (!plan) continue;
    const step: PlanStep = {
      tick: state.world.tick,
      round: state.sequence?.round ?? null,
      status: plan.status,
      progress: plan.progress,
      detail: plan.detail,
    };

    if (!current || !sameAim(current, plan)) {
      chapters.push({
        kind: plan.kind,
        targetTile: plan.targetTile,
        targetCity: plan.targetCity,
        targetTech: plan.targetTech,
        targetBuilding: plan.targetBuilding,
        rationale: plan.rationale,
        startedAt: plan.startedAt,
        endedAt: null,
        outcome: plan.status,
        steps: [step],
      });
      current = plan;
      continue;
    }

    const chapter = chapters[chapters.length - 1]!;
    if (moved(chapter.steps[chapter.steps.length - 1], step))
      chapter.steps.push(step);
    chapter.outcome = plan.status;
    // Un plan conclu garde la date de sa conclusion, pas celle du dernier
    // état observé : une campagne qui continue ne repousse pas sa fin.
    if (
      (plan.status === "completed" || plan.status === "cancelled") &&
      chapter.endedAt === null
    )
      chapter.endedAt = state.world.tick;
    current = plan;
  }

  return chapters;
}

/** Ce qu'une civilisation a tenu, et ce qu'elle a laissé tomber. */
export interface PlanRecord {
  adopted: number;
  completed: number;
  blocked: number;
  cancelled: number;
  active: number;
}

export function planRecord(chapters: readonly PlanChapter[]): PlanRecord {
  const count = (status: TrackedPlan["status"]) =>
    chapters.filter((chapter) => chapter.outcome === status).length;
  return {
    adopted: chapters.length,
    completed: count("completed"),
    blocked: count("blocked"),
    cancelled: count("cancelled"),
    active: count("active"),
  };
}

import { describe, expect, it } from "vitest";
import {
  planHistory,
  planRecord,
  type PlanBearingState,
} from "../src/plan-history.js";
import type { TrackedPlan } from "../src/strategic-plans.js";

/**
 * Décision, action, conséquence — reconstituées depuis l'histoire.
 *
 * Rien n'est stocké pour cela : le moteur ne garde que le plan courant, et
 * c'est le rejeu qui rend l'histoire disponible. Ces bornes disent ce que la
 * reconstitution a le droit de dire, et surtout ce qu'elle n'a pas le droit
 * d'inventer.
 */
const plan = (over: Partial<TrackedPlan> = {}): TrackedPlan => ({
  kind: "settle",
  targetTile: 42,
  targetCity: null,
  targetTech: null,
  targetBuilding: null,
  rationale: "Fonder à l'ouest, près de la rivière.",
  status: "active",
  progress: 0,
  stagnation: 0,
  startedAt: 3,
  updatedAt: 3,
  detail: "Plan adopté.",
  ...over,
});

const at = (
  tick: number,
  round: number,
  current: TrackedPlan | null,
): PlanBearingState => ({
  world: { tick },
  sequence: { round },
  ...(current ? { plans: { amber: current } } : {}),
});

describe("l'histoire d'un plan se lit, elle ne se stocke pas", () => {
  it("ouvre un chapitre par plan adopté, et garde les mots du dirigeant", () => {
    const chapters = planHistory(
      [
        at(3, 1, plan()),
        at(
          4,
          2,
          plan({ progress: 0.2, detail: "Colons à 3 case(s) de l'objectif." }),
        ),
      ],
      "amber",
    );

    expect(chapters).toHaveLength(1);
    expect(chapters[0]!.rationale).toBe(
      "Fonder à l'ouest, près de la rivière.",
    );
    expect(chapters[0]!.targetTile).toBe(42);
    expect(chapters[0]!.startedAt).toBe(3);
  });

  /** Un pas n'existe que s'il dit quelque chose de neuf. */
  it("ne répète pas un tour où rien n'a bougé", () => {
    const stable = plan({
      progress: 0.2,
      detail: "Colons à 3 case(s) de l'objectif.",
    });
    const chapters = planHistory(
      [at(3, 1, plan()), at(4, 2, stable), at(5, 3, stable), at(6, 4, stable)],
      "amber",
    );
    expect(chapters[0]!.steps).toHaveLength(2);
    expect(chapters[0]!.steps.at(-1)!.detail).toBe(
      "Colons à 3 case(s) de l'objectif.",
    );
  });

  it("suit une avancée jusqu'à la fondation, et date la conclusion", () => {
    const chapters = planHistory(
      [
        at(3, 1, plan()),
        at(
          5,
          2,
          plan({ progress: 0.4, detail: "Colons à 1 case(s) de l'objectif." }),
        ),
        at(
          7,
          3,
          plan({
            progress: 1,
            status: "completed",
            detail: "La ville est fondée sur la case prévue.",
          }),
        ),
        // La campagne continue : la fin du plan ne doit pas se decaler.
        at(
          9,
          4,
          plan({
            progress: 1,
            status: "completed",
            detail: "La ville est fondée sur la case prévue.",
          }),
        ),
      ],
      "amber",
    );

    expect(chapters[0]!.outcome).toBe("completed");
    expect(chapters[0]!.endedAt).toBe(7);
    expect(chapters[0]!.steps.map((s) => s.detail)).toEqual([
      "Plan adopté.",
      "Colons à 1 case(s) de l'objectif.",
      "La ville est fondée sur la case prévue.",
    ]);
  });

  /**
   * Un dirigeant qui change d'avis n'est pas une anomalie : le chapitre se
   * referme sur le dernier état connu, et un nouveau s'ouvre.
   */
  it("referme un plan abandonné et en ouvre un autre", () => {
    const abandoned = plan({
      progress: 0.4,
      detail: "Colons à 2 case(s) de l'objectif.",
    });
    const replacement = plan({
      kind: "research",
      targetTile: null,
      targetTech: "metallurgy",
      rationale: "La technologie d'abord.",
      startedAt: 8,
      detail: "Plan adopté.",
    });
    const chapters = planHistory(
      [at(3, 1, plan()), at(6, 2, abandoned), at(8, 3, replacement)],
      "amber",
    );

    expect(chapters).toHaveLength(2);
    expect(chapters[0]!.outcome).toBe("active");
    // Abandonne, pas conclu : on ne lui invente pas une fin.
    expect(chapters[0]!.endedAt).toBeNull();
    expect(chapters[1]!.kind).toBe("research");
    expect(chapters[1]!.rationale).toBe("La technologie d'abord.");
  });

  it("distingue deux plans de même visée adoptés à des tours différents", () => {
    const first = plan({ startedAt: 3 });
    const second = plan({ startedAt: 9, detail: "Plan adopté." });
    const chapters = planHistory([at(3, 1, first), at(9, 2, second)], "amber");
    expect(chapters).toHaveLength(2);
    expect(chapters.map((c) => c.startedAt)).toEqual([3, 9]);
  });

  it("ignore les états sans plan, et les autres civilisations", () => {
    expect(planHistory([at(1, 1, null), at(2, 2, null)], "amber")).toEqual([]);
    expect(
      planHistory([{ world: { tick: 1 }, plans: { azure: plan() } }], "amber"),
    ).toEqual([]);
  });

  it("compte ce qui a été tenu et ce qui a été laissé", () => {
    const chapters = planHistory(
      [
        at(3, 1, plan()),
        at(
          4,
          2,
          plan({
            status: "completed",
            progress: 1,
            detail: "La ville est fondée sur la case prévue.",
          }),
        ),
        at(
          6,
          3,
          plan({
            startedAt: 6,
            kind: "build",
            targetTile: null,
            targetCity: "city-amber",
            targetBuilding: "granary",
          }),
        ),
        at(
          7,
          4,
          plan({
            startedAt: 6,
            kind: "build",
            targetTile: null,
            targetCity: "city-amber",
            targetBuilding: "granary",
            status: "blocked",
            detail: "La ville cible n'est plus possédée.",
          }),
        ),
      ],
      "amber",
    );

    expect(planRecord(chapters)).toEqual({
      adopted: 2,
      completed: 1,
      blocked: 1,
      cancelled: 0,
      active: 0,
    });
  });
});

import { describe, expect, it } from "vitest";
import { newJournal, newWorld, type Journal } from "@abs/world";
import type { GeneralConfig } from "@abs/contracts";
import { liveWorld, type LiveNotice } from "../src/index.js";
import type { RulerProvider } from "../src/rule.js";

const IDS = ["crimson", "azure", "verdant", "amber"] as const;
const generals: GeneralConfig[] = IDS.map((id) => ({
  factionId: id,
  displayName: id,
  model: `test/${id}`,
  fallbacks: [],
}));

const answer = JSON.stringify({
  reasoning: "nourrir avant tout",
  creed: "la terre d'abord",
  farming: 7,
  forestry: 1,
  mining: 1,
  trade: 1,
  military: 0,
});

/** Answers everyone, always. */
const willing = (): RulerProvider => ({ ask: async () => answer });

/**
 * Refuses one civilisation for its first `failures` questions, then relents.
 * This is what a rate limit looks like from the inside.
 */
const throttling = (victim: string, failures: number): RulerProvider => {
  let seen = 0;
  return {
    ask: async (general) => {
      if (general.factionId !== victim) return answer;
      seen += 1;
      return seen <= failures ? null : answer;
    },
  };
};

const fresh = (): { journal: Journal } => ({ journal: newJournal(newWorld([...IDS], 42)) });

describe("le monde avance en pas verrouille", () => {
  it("toutes les civilisations vivent la meme annee", async () => {
    const { journal } = fresh();
    const result = await liveWorld(journal.origin, { journal, generals, provider: willing(), ticks: 60 });
    expect(result.world.tick).toBe(60);
    // Une seule horloge : aucune civilisation n'a d'annee a elle.
    expect(result.lived).toBe(60);
  });

  it("une decision est toujours rangee a l'annee ou elle a ete levee", async () => {
    const { journal } = fresh();
    await liveWorld(journal.origin, { journal, generals, provider: willing(), ticks: 60 });
    for (const r of journal.rulings) expect(r.tick).toBeLessThanOrEqual(60);
  });
});

describe("une decision qu'on ne peut pas servir est differee, jamais abandonnee", () => {
  it("la civilisation bridee finit par etre gouvernee", async () => {
    const { journal } = fresh();
    const result = await liveWorld(journal.origin, {
      journal,
      generals,
      provider: throttling("amber", 3),
      ticks: 120,
    });
    const amber = result.ledger.get("amber")!;
    expect(amber.deferred).toBeGreaterThanOrEqual(3);
    // Gouvernee en retard, pas pas du tout.
    expect(amber.answered).toBeGreaterThan(0);
    expect(journal.rulings.some((r) => r.civ === "amber")).toBe(true);
  });

  it("et le retard est inscrit dans le journal", async () => {
    const { journal } = fresh();
    await liveWorld(journal.origin, { journal, generals, provider: throttling("amber", 3), ticks: 120 });
    const late = journal.rulings.filter((r) => r.civ === "amber" && r.deferredBy > 0);
    expect(late.length).toBeGreaterThan(0);
  });

  it("une civilisation bridee n'est pas privee de decisions par rapport aux autres", async () => {
    const { journal } = fresh();
    const result = await liveWorld(journal.origin, {
      journal,
      generals,
      provider: throttling("amber", 3),
      ticks: 200,
    });
    // Le point de la regle : quelques refus initiaux ne doivent pas se traduire
    // par une civilisation durablement moins gouvernee que les autres.
    const amber = result.ledger.get("amber")!.answered;
    const others = IDS.filter((i) => i !== "amber").map((i) => result.ledger.get(i)!.answered);
    expect(amber).toBeGreaterThan(Math.min(...others) / 2);
  });
});

describe("le monde survit au silence total", () => {
  it("sans fournisseur, il vit quand meme et ne bloque pas", async () => {
    const { journal } = fresh();
    const result = await liveWorld(journal.origin, { journal, generals, provider: null, ticks: 80 });
    expect(result.world.tick).toBe(80);
    expect(journal.rulings).toHaveLength(0);
  });

  it("un modele qui ne repond jamais ne fait pas boucler le monde", async () => {
    const { journal } = fresh();
    const result = await liveWorld(journal.origin, {
      journal,
      generals,
      provider: { ask: async () => null },
      ticks: 80,
    });
    expect(result.world.tick).toBe(80);
    expect(result.ledger.get("crimson")!.answered).toBe(0);
  });
});

describe("ce que le monde raconte", () => {
  it("chaque decision retenue est annoncee avec sa raison", async () => {
    const { journal } = fresh();
    const notices: LiveNotice[] = [];
    await liveWorld(journal.origin, {
      journal,
      generals,
      provider: willing(),
      ticks: 60,
      notify: (n) => notices.push(n),
    });
    const ruled = notices.filter((n) => n.kind === "ruled");
    expect(ruled.length).toBe(journal.rulings.length);
    expect(ruled.every((n) => n.text.includes("nourrir avant tout"))).toBe(true);
  });

  it("le journal est propose a la sauvegarde apres chaque decision", async () => {
    const { journal } = fresh();
    let saves = 0;
    await liveWorld(journal.origin, {
      journal,
      generals,
      provider: willing(),
      ticks: 60,
      onRuling: () => (saves += 1),
    });
    // Une course interrompue ne doit jamais couter les annees deja vecues.
    expect(saves).toBe(journal.rulings.length);
    expect(saves).toBeGreaterThan(0);
  });
});

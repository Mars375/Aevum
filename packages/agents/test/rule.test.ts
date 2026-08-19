import { describe, expect, it } from "vitest";
import { newCiv, type DecisionPoint } from "@abs/world";
import type { GeneralConfig } from "@abs/contracts";
import { askRuler, RULING_JSON_SCHEMA, systemPromptWorld, userPromptWorld, type RulerProvider } from "../src/index.js";

const general: GeneralConfig = { factionId: "crimson", displayName: "Crimson", model: "test/model", fallbacks: [] };
const point: DecisionPoint = {
  tick: 12,
  civ: "crimson",
  kind: "FAMINE",
  urgency: 80,
  standing: false,
  evidence: ["2.1 tours de vivres restants", "340 habitants"],
};

const answering = (body: unknown): RulerProvider => ({
  ask: async () => (typeof body === "string" ? body : JSON.stringify(body)),
});

const valid = { reasoning: "nourrir avant tout", creed: "on ne meurt pas de faim ici", farming: 7, forestry: 1, mining: 1, trade: 1, military: 0 };

describe("un dirigeant est interroge avec ce qui l'a reveille", () => {
  it("le prompt porte les faits, pas seulement la question", () => {
    const usr = userPromptWorld(newCiv("crimson"), point);
    for (const fact of point.evidence) expect(usr).toContain(fact);
  });

  it("le prompt transmet la doctrine heritee quand elle existe", () => {
    const civ = { ...newCiv("crimson"), doctrine: { ...newCiv("crimson").doctrine, creed: "la terre avant l'acier" } };
    expect(userPromptWorld(civ, point)).toContain("la terre avant l'acier");
  });

  it("et dit clairement au premier dirigeant qu'il n'herite de rien", () => {
    expect(userPromptWorld(newCiv("crimson"), point)).toMatch(/first/i);
  });

  it("aucun secret ne part avec le prompt", () => {
    const text = systemPromptWorld() + userPromptWorld(newCiv("crimson"), point);
    expect(text).not.toMatch(/sk-|gsk_|nvapi-|api[_-]?key|\/home\//i);
  });
});

describe("le monde survit a un dirigeant qui ne repond pas", () => {
  const rejected = async (body: unknown) => askRuler(answering(body), general, newCiv("crimson"), point);

  it("modele injoignable", async () => {
    expect(await askRuler({ ask: async () => null }, general, newCiv("crimson"), point)).toBeNull();
  });

  it("reponse qui n'est pas du JSON", async () => expect(await rejected("desole, je ne sais pas")).toBeNull());
  it("champ manquant", async () => expect(await rejected({ reasoning: "x", creed: "y", farming: 1 })).toBeNull());
  it("part negative", async () => expect(await rejected({ ...valid, military: -3 })).toBeNull());
  it("doctrine qui n'emploie personne", async () => {
    expect(await rejected({ ...valid, farming: 0, forestry: 0, mining: 0, trade: 0, military: 0 })).toBeNull();
  });
});

describe("une reponse valide devient une decision", () => {
  it("porte les parts, la raison, le tour et le modele", async () => {
    const ruling = (await askRuler(answering(valid), general, newCiv("crimson"), point))!;
    expect(ruling.tick).toBe(12);
    expect(ruling.civ).toBe("crimson");
    expect(ruling.kind).toBe("FAMINE");
    expect(ruling.doctrine.farming).toBe(7);
    expect(ruling.reason).toBe("nourrir avant tout");
    expect(ruling.model).toBe("test/model");
  });

  it("un dirigeant qui n'ecrit pas de credo n'efface pas celui de ses predecesseurs", async () => {
    const ruling = (await askRuler(answering({ ...valid, creed: "   " }), general, newCiv("crimson"), point))!;
    expect(ruling.doctrine.creed).toBeUndefined();
  });
});

describe("le schema JSON et le schema zod ne divergent pas", () => {
  it("tout champ requis cote API existe cote validation", async () => {
    const required = RULING_JSON_SCHEMA.required as readonly string[];
    const sample: Record<string, unknown> = { ...valid, posture: "GUARD", claim: "plain" };
    const complete = Object.fromEntries(required.map((k) => [k, sample[k] ?? 1]));
    expect(await askRuler(answering(complete), general, newCiv("crimson"), point)).not.toBeNull();
  });

  it("chaque champ requis manquant fait echouer la validation", async () => {
    for (const key of RULING_JSON_SCHEMA.required as readonly string[]) {
      // Ces trois-la ont un defaut assume : un dirigeant reveille par une
      // famine n'a pas a rouvrir sa politique etrangere pour etre entendu.
      if (key === "reasoning" || key === "creed" || key === "posture" || key === "claim") continue;
      const partial = { ...valid, posture: "GUARD", claim: "plain" } as Record<string, unknown>;
      delete partial[key];
      expect(await askRuler(answering(partial), general, newCiv("crimson"), point)).toBeNull();
    }
  });
});

describe("les deux encodages des parts sont acceptes", () => {
  // Trouve en faisant vivre un vrai monde : trois modeles sur quatre imbriquent
  // les parts sous "shares", et neuf decisions de suite ont ete jetees pour ca.
  const nested = {
    reasoning: "semer avant de forger",
    creed: "la terre d'abord",
    shares: { farming: 50, forestry: 25, mining: 15, trade: 10, military: 0 },
  };

  it("imbrique sous shares", async () => {
    const ruling = (await askRuler(answering(nested), general, newCiv("crimson"), point))!;
    expect(ruling.doctrine.farming).toBe(50);
    expect(ruling.doctrine.military).toBe(0);
  });

  it("la raison et le credo survivent a l'aplatissement", async () => {
    const ruling = (await askRuler(answering(nested), general, newCiv("crimson"), point))!;
    expect(ruling.reason).toBe("semer avant de forger");
    expect(ruling.doctrine.creed).toBe("la terre d'abord");
  });

  it("un champ en trop ne fait pas echouer la lecture", async () => {
    expect(await askRuler(answering({ ...nested, year: 17 }), general, newCiv("crimson"), point)).not.toBeNull();
  });

  it("peu importe le nom de l'enveloppe : employment, allocation, autre", async () => {
    for (const key of ["employment", "allocation", "workforce"]) {
      const body = { reasoning: "r", creed: "c", [key]: { farming: 40, forestry: 20, mining: 20, trade: 15, military: 5 } };
      const ruling = await askRuler(answering(body), general, newCiv("crimson"), point);
      expect(ruling?.doctrine.farming, key).toBe(40);
    }
  });

  it("et l'encodage plat marche toujours", async () => {
    const ruling = (await askRuler(answering(valid), general, newCiv("crimson"), point))!;
    expect(ruling.doctrine.farming).toBe(7);
  });
});

describe("la posture envers les voisins", () => {
  it("est transmise quand le dirigeant en choisit une", async () => {
    const ruling = (await askRuler(answering({ ...valid, posture: "TRADE" }), general, newCiv("crimson"), point))!;
    expect(ruling.doctrine.posture).toBe("TRADE");
  });

  it("mais son absence ne fait pas jeter une bonne reponse", async () => {
    // Un dirigeant reveille par une famine n'a aucune raison de rouvrir sa
    // politique etrangere.
    const ruling = (await askRuler(answering(valid), general, newCiv("crimson"), point))!;
    expect(ruling.doctrine.posture).toBeUndefined();
    expect(ruling.doctrine.farming).toBe(7);
  });

  it("une posture inventee fait rejeter la reponse plutot que d'en inventer une", async () => {
    expect(await askRuler(answering({ ...valid, posture: "CONQUER" }), general, newCiv("crimson"), point)).toBeNull();
  });
});

describe("l'explication est lue quel que soit le mot employe", () => {
  // Cent ans de decisions sont revenus avec une raison vide : la consigne
  // finale du prompt ne demandait plus d'expliquer. Le prompt le redemande, et
  // comme le mot varie d'un modele a l'autre, les mots courants sont lus.
  const base = { creed: "c", farming: 4, forestry: 2, mining: 2, trade: 1, military: 1 };

  for (const key of ["reasoning", "reason", "rationale", "justification"]) {
    it(`"${key}"`, async () => {
      const ruling = await askRuler(answering({ ...base, [key]: "les greniers etaient vides" }), general, newCiv("crimson"), point);
      expect(ruling?.reason).toBe("les greniers etaient vides");
    });
  }

  it("le prompt demande explicitement d'expliquer", () => {
    expect(userPromptWorld(newCiv("crimson"), point)).toMatch(/why you are deciding/i);
  });

  it("une raison absente ne fait pas jeter la decision pour autant", async () => {
    const ruling = await askRuler(answering(base), general, newCiv("crimson"), point);
    expect(ruling?.reason).toBe("");
  });
});

describe("la terre convoitee", () => {
  it("est transmise quand le dirigeant en choisit une", async () => {
    const ruling = (await askRuler(answering({ ...valid, claim: "river" }), general, newCiv("crimson"), point))!;
    expect(ruling.doctrine.claim).toBe("river");
  });

  it("son absence ne fait pas jeter une bonne reponse", async () => {
    const ruling = (await askRuler(answering(valid), general, newCiv("crimson"), point))!;
    expect(ruling.doctrine.claim).toBeUndefined();
  });

  it("une terre inventee fait rejeter plutot que d'en choisir une au hasard", async () => {
    expect(await askRuler(answering({ ...valid, claim: "montagne" }), general, newCiv("crimson"), point)).toBeNull();
  });

  it("le dirigeant voit son sol", () => {
    const civ = { ...newCiv("crimson"), lands: { plain: 5, forest: 0, hill: 2, river: 1 } };
    expect(userPromptWorld(civ, point)).toContain("5 plain, 0 forest, 2 hill, 1 river");
  });
});

describe("un rapport sans affirmation datee n'est pas un rapport", () => {
  // 18 audits sur 20 n'ont rien pu mesurer parce que les rapports ne portaient
  // aucune affirmation verifiable — et rien n'enregistrait quel modele les
  // avait ecrits, donc rien ne permettait de savoir qui etait en cause.
  it("le schema du rapport porte desormais le modele qui l'a ecrit", async () => {
    const { BattleReportSchema } = await import("@abs/contracts");
    const parsed = BattleReportSchema.parse({ factionId: "crimson", summary: "x", claims: [] });
    expect(parsed.model).toBeNull();
    expect(BattleReportSchema.parse({ factionId: "crimson", summary: "x", claims: [], model: "a/b" }).model).toBe("a/b");
  });
});

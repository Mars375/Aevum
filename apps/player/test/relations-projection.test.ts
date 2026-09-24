import { describe, expect, it } from "vitest";
import type { FactionId } from "@abs/contracts";
import {
  projectRelations,
  type RelationsWorld,
} from "../src/three/relations-projection";

/**
 * Un plateau 3×3 lisible à l'œil :
 *
 *   amber  amber  azure
 *   amber  .      azure
 *   crimson crimson verdant
 */
function world(
  relations: { a: FactionId; b: FactionId; status: string }[],
  owners: (FactionId | null)[] = [
    "amber",
    "amber",
    "azure",
    "amber",
    null,
    "azure",
    "crimson",
    "crimson",
    "verdant",
  ],
): RelationsWorld {
  return {
    size: 3,
    board: owners.map((owner) => ({ owner })),
    civs: [
      { id: "amber", capital: 0, fellOnTick: null },
      { id: "azure", capital: 2, fellOnTick: null },
      { id: "crimson", capital: 6, fellOnTick: null },
      { id: "verdant", capital: 8, fellOnTick: null },
    ],
    simulation: { relations },
  };
}

describe("les relations sur la carte", () => {
  it("relie les capitales d'un pacte, qui l'emporte sur le commerce", () => {
    const projection = projectRelations(
      world([{ a: "amber", b: "azure", status: "trade" }]),
      [{ a: "azure", b: "amber" }],
    );
    expect(projection.links).toEqual([
      { a: "azure", b: "amber", kind: "pact", from: [1, -1], to: [-1, -1] },
    ]);
  });

  it("ne laisse jamais un pacte masquer une guerre", () => {
    const { links } = projectRelations(
      world([{ a: "azure", b: "verdant", status: "war" }]),
      [{ a: "azure", b: "verdant" }],
    );
    // Azur et Sylve se touchent : la guerre se lit sur le front, pas d'arc.
    expect(links).toEqual([]);
  });

  it("allume la frontière commune de deux civilisations en guerre", () => {
    const { fronts, links } = projectRelations(
      world([{ a: "amber", b: "crimson", status: "war" }]),
      [],
    );
    // Ambre (case 3) touche Pourpre (case 6) par le sud : une arête.
    expect(fronts).toEqual([{ x1: -1.5, z1: 0.5, x2: -0.5, z2: 0.5 }]);
    expect(links).toEqual([]);
  });

  it("relie par un arc une guerre sans frontière commune", () => {
    const { links, fronts } = projectRelations(
      world([{ a: "amber", b: "verdant", status: "war" }]),
      [],
    );
    expect(fronts).toEqual([]);
    expect(links.map((l) => l.kind)).toEqual(["war"]);
  });

  it("montre une case qui change de maître, et dit si c'était une capitale", () => {
    const before = world([]);
    const after = world(
      [],
      [
        "amber",
        "amber",
        "azure",
        "amber",
        null,
        "azure",
        "amber",
        "crimson",
        "verdant",
      ],
    );
    expect(projectRelations(after, [], before).conquests).toEqual([
      { x: -1, z: 1, by: "amber", from: "crimson", capital: true },
    ]);
    // Une case neutre prise n'est pas une conquête.
    const settled = world(
      [],
      [
        "amber",
        "amber",
        "azure",
        "amber",
        "amber",
        "azure",
        "crimson",
        "crimson",
        "verdant",
      ],
    );
    expect(projectRelations(settled, [], before).conquests).toEqual([]);
  });

  it("oublie les civilisations tombées", () => {
    const fallen = world([{ a: "amber", b: "azure", status: "trade" }]);
    (fallen.civs[1] as { fellOnTick: number | null }).fellOnTick = 12;
    expect(projectRelations(fallen, []).links).toEqual([]);
  });

  it("marque un nouvel âge à la capitale, et une ville nouvelle là où elle naît", () => {
    const before = world([]);
    before.simulation!.cities = [
      { id: "city-amber", owner: "amber", position: 0 },
    ];
    const after = world([]);
    after.simulation!.cities = [
      { id: "city-amber", owner: "amber", position: 0 },
      { id: "city-amber-4", owner: "amber", position: 4 },
    ];
    const { moments } = projectRelations(after, [], before, ["azure"]);
    expect(moments).toEqual([
      { kind: "age", x: 1, z: -1, civ: "azure" },
      { kind: "founded", x: 0, z: 0, civ: "amber" },
    ]);
    // Sans tour précédent, aucune fondation inventée.
    expect(projectRelations(after, [], null).moments).toEqual([]);
  });
});

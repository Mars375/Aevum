import { describe, expect, it } from "vitest";
import { newCivilizationWorld, type Year } from "@abs/world";
import type { Age } from "../../../packages/world/src/ages";
import type { WorldUnit } from "../../../packages/world/src/civilization-state";
import { CIVILIAN_ASSETS, CIVILIAN_ROLES } from "../src/three/civilian-assets";
import { INFRASTRUCTURE_ASSETS } from "../src/three/infrastructure-assets";
import {
  WORLD_ASSETS,
  projectWorld,
  unitAsset,
} from "../src/three/world-projection";

/**
 * Le colon était dessiné en marchand.
 *
 * `UNIT_NAMES` n'a pas de clé `settler` : la projection repliait donc le rôle
 * sur `merchant` pour se typer, et ce repli, fait pour le texte, avait débordé
 * sur le visuel. L'étiquette disait « Colons » pendant que la silhouette
 * disait autre chose. Ces bornes fixent qui décide de quoi.
 */
const yearOf = (): Year => ({
  tick: 0,
  world: newCivilizationWorld(["crimson", "azure"], 42),
  events: [],
  rulings: [],
});

/** Une unité de chaque rôle, posée sur la même case, pour tout observer. */
function withOneOfEachRole(year: Year, position: number): Year {
  const roles: WorldUnit["role"][] = [...CIVILIAN_ROLES, "soldier"];
  year.world.simulation!.units = roles.map((role, index) => ({
    id: `u-${role}`,
    owner: "crimson" as const,
    role,
    position,
    previous: position,
    target: null,
    strength: index + 1,
    cooldown: 0,
    task: "idle" as const,
  }));
  return year;
}

const unitsOn = (parcels: ReturnType<typeof projectWorld>, position: number) =>
  parcels[position]!.assets.filter((placement) => !!placement.unitId);

const assetOf = (
  parcels: ReturnType<typeof projectWorld>,
  position: number,
  role: string,
) => unitsOn(parcels, position).find((p) => p.unitId === `u-${role}`)?.asset;

describe("les civils portent leur âge, et un colon reste un colon", () => {
  const ages: Record<string, Age> = { crimson: "medieval", azure: "bronze" };

  it("donne à chaque rôle civil la silhouette de son âge", () => {
    const year = withOneOfEachRole(yearOf(), 0);
    const parcels = projectWorld(year, [year], ages);
    for (const role of CIVILIAN_ROLES)
      expect(assetOf(parcels, 0, role)).toBe(`civilian_medieval_${role}`);
  });

  it("ne dessine plus un colon en marchand", () => {
    const year = withOneOfEachRole(yearOf(), 0);
    const parcels = projectWorld(year, [year], ages);
    expect(assetOf(parcels, 0, "settler")).toBe("civilian_medieval_settler");
    expect(assetOf(parcels, 0, "settler")).not.toBe(
      assetOf(parcels, 0, "merchant"),
    );
  });

  it("laisse aux soldats leur silhouette d'âge", () => {
    const year = withOneOfEachRole(yearOf(), 0);
    const parcels = projectWorld(year, [year], ages);
    expect(assetOf(parcels, 0, "soldier")).toBe("medieval_soldier");
  });

  it("suit l'âge de chaque civilisation, pas un âge commun", () => {
    expect(unitAsset("farmer", "future")).toBe("civilian_future_farmer");
    expect(unitAsset("farmer", "bronze")).toBe("civilian_bronze_farmer");
  });

  /**
   * Une vue sans contexte d'âge doit rendre exactement ce qu'elle rendait :
   * les projections archivées ne se réécrivent pas parce qu'on a ajouté des
   * modèles. Le vieux repli colon → marchand y survit, à dessein.
   */
  it("ne change rien quand aucun âge n'est fourni", () => {
    const year = withOneOfEachRole(yearOf(), 0);
    const parcels = projectWorld(year, [year]);
    expect(assetOf(parcels, 0, "farmer")).toBe("farmer");
    expect(assetOf(parcels, 0, "soldier")).toBe("soldier");
    expect(assetOf(parcels, 0, "settler")).toBe("merchant");
  });

  /**
   * La garde qui compte.
   *
   * `world-scene` route `infra_` puis les âges, et tombe sinon sur un
   * chargement GLTF. Un nom que la projection produit mais que le catalogue
   * ignore ne se voit donc pas à la compilation : il part chercher un fichier
   * absent et fait échouer tout le chargement de la scène, d'un coup.
   */
  it("ne produit jamais un nom absent du catalogue chargeable", () => {
    const loadable = new Set<string>([
      ...WORLD_ASSETS,
      ...INFRASTRUCTURE_ASSETS,
      ...CIVILIAN_ASSETS,
    ]);
    const ageList: Age[] = [
      "bronze",
      "classical",
      "medieval",
      "industrial",
      "modern",
      "future",
    ];
    const produced = new Set<string>();
    for (const age of [...ageList, undefined])
      for (const role of [...CIVILIAN_ROLES, "soldier"] as const)
        produced.add(unitAsset(role, age));

    expect([...produced].filter((asset) => !loadable.has(asset))).toEqual([]);
    // Et la projection complète, pas seulement le helper.
    const year = withOneOfEachRole(yearOf(), 0);
    for (const age of ageList) {
      const parcels = projectWorld(year, [year], {
        crimson: age,
        azure: age,
      });
      for (const placement of parcels.flatMap((parcel) => parcel.assets))
        expect(loadable.has(placement.asset), placement.asset).toBe(true);
    }
  });

  it("ne mute pas le monde qu'on lui donne", () => {
    const year = withOneOfEachRole(yearOf(), 0);
    const before = structuredClone(year);
    projectWorld(year, [year], ages);
    expect(year).toEqual(before);
  });
});

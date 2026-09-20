import { describe, it, expect } from "vitest";
import { councilOptions } from "../src/council-options.js";
import { activeCiv, newSpectator } from "../../world/src/spectator.js";
import { planIssue } from "../../world/src/strategic-plans.js";

/**
 * Ce que le conseil annonce doit passer le validateur qui le jugera.
 *
 * Deux tirages distants sur la graine 17 ont echoue sur une cible de plan de
 * fondation, avec deux motifs differents : « Aucun colon ne peut atteindre ce
 * site », puis « Le site de fondation est occupe ou trop proche d'une ville ».
 * Les deux sont des refus du validateur de plan, et `f79fcf3` avait justement
 * ajoute `settlementPlanSites` pour que cela n'arrive plus.
 *
 * La lecture du code dit que `foundationTiles` applique exactement les memes
 * regles que `planIssue` — case libre, hors riviere, a trois cases au moins de
 * toute ville. Une lecture n'est pas une garantie : ce test la rend executable,
 * de sorte qu'un futur assouplissement d'un cote fasse echouer ici plutot que
 * chez un dirigeant, un appel distant plus tard.
 *
 * S'il reste vert et que le refus persiste en campagne, la conclusion est
 * inverse et interessante : le modele choisit hors de ce qu'on lui annonce, et
 * le moteur a raison de le refuser.
 */
describe("les sites de fondation annonces sont ceux que le validateur accepte", () => {
  for (const seed of [42, 7, 17, 314]) {
    it(`graine ${seed}`, () => {
      const state = newSpectator(seed, "spectator-9");
      const civ = activeCiv(state)!;
      const options = councilOptions(state, civ) as {
        settlementPlanSites?: number[];
      };
      const sites = options.settlementPlanSites ?? [];
      expect(Array.isArray(sites)).toBe(true);

      const refused = sites.filter(
        (target) =>
          planIssue(state.world, civ, {
            kind: "settle",
            targetTile: target,
            targetCity: null,
            targetTech: null,
            targetBuilding: null,
            rationale: "site annonce par le conseil",
          }) !== null,
      );
      expect(refused).toEqual([]);
    });
  }

  it("n'annonce jamais un site a un dirigeant sans colon", () => {
    const state = newSpectator(42, "spectator-9");
    const civ = activeCiv(state)!;
    // Remove every settler: the list is derived from settlers, so it must empty.
    state.world.simulation!.units = state.world.simulation!.units.filter(
      (unit) => !(unit.owner === civ && unit.role === "settler"),
    );
    const options = councilOptions(state, civ) as {
      settlementPlanSites?: number[];
    };
    expect(options.settlementPlanSites).toEqual([]);
  });
});

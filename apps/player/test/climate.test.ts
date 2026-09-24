import { describe, expect, it } from "vitest";
import { incidentFor } from "../../../packages/world/src/spectator";
import { climateKind, climateTint } from "../src/three/climate";

describe("le climat sur la carte", () => {
  /**
   * Le titre est la seule clé : si le moteur renomme un épisode, la carte doit
   * cesser de le montrer plutôt que d'en montrer un autre. On vérifie donc
   * que chaque épisode que le moteur peut produire est reconnu.
   */
  it("reconnaît chaque épisode que le moteur produit", () => {
    const titles = new Set<string>();
    for (let seed = 0; seed < 40; seed++)
      for (let turn = 0; turn < 300; turn++) {
        const incident = incidentFor(seed, turn);
        if (incident) titles.add(incident.title);
      }
    expect(titles.size).toBe(3);
    for (const title of titles) expect(climateKind({ title })).not.toBeNull();
    expect(climateKind(null)).toBeNull();
  });

  it("teinte sans jamais cacher à qui est la case", () => {
    for (const kind of ["winter", "drought", "harvest"] as const)
      for (const land of ["plain", "forest", "hill", "river"] as const) {
        const tint = climateTint(kind, land);
        if (tint) expect(tint.amount).toBeLessThanOrEqual(0.45);
      }
    // Une récolte ne dore que les terres cultivables.
    expect(climateTint("harvest", "forest")).toBeNull();
    expect(climateTint("harvest", "plain")).not.toBeNull();
    expect(climateTint(null, "plain")).toBeNull();
  });
});

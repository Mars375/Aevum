import { describe, expect, it } from "vitest";
import { addressForMode, modeFromSearch, slugOfMode, wants3d, type ViewMode } from "../src/view-address.js";

const MODES: ViewMode[] = ["world", "battle", "rules", "reports"];

describe("l'adresse des vues", () => {
  it("nomme chaque vue et la relit à l'identique", () => {
    for (const mode of MODES) {
      expect(modeFromSearch(`?mode=${slugOfMode(mode)}`)).toBe(mode);
    }
  });

  it("laisse la chronique hors de l'adresse, puisqu'elle est le défaut", () => {
    expect(addressForMode("https://exemple.test/?mode=regles", "world")).toBe("https://exemple.test/");
  });

  it("écrit la vue sans emporter le reste de l'adresse", () => {
    const from = "https://exemple.test/?world=worlds/aevum-season-1/era-0001.json&turn=12";
    const to = addressForMode(from, "rules");
    const params = new URLSearchParams(new URL(to).search);
    expect(params.get("mode")).toBe("regles");
    expect(params.get("world")).toBe("worlds/aevum-season-1/era-0001.json");
    expect(params.get("turn")).toBe("12");
  });

  it("relit les anciennes orthographes, parce que des liens les portent déjà", () => {
    expect(modeFromSearch("?mode=rapports")).toBe("reports");
    expect(modeFromSearch("?rapport=board-noise")).toBe("reports");
  });

  it("ouvre les archives quand l'adresse désigne un rejeu ou un tour", () => {
    expect(modeFromSearch("?replay=replays/reference.json")).toBe("battle");
    expect(modeFromSearch("?turn=4")).toBe("battle");
  });

  it("ne nomme aucune vue quand l'adresse n'en demande pas", () => {
    expect(modeFromSearch("")).toBeNull();
    expect(modeFromSearch("?view=crimson")).toBeNull();
  });

  /**
   * `mode=3d` est antérieur aux vues nommées. Le lire comme un nom de vue
   * enverrait le lecteur ailleurs que là où son lien pointe.
   */
  it("ne confond pas le drapeau 3D avec un nom de vue", () => {
    expect(modeFromSearch("?mode=3d")).toBeNull();
    expect(wants3d("?mode=3d")).toBe(true);
    expect(wants3d("?3d=1")).toBe(true);
    expect(wants3d("?mode=regles")).toBe(false);
  });
});

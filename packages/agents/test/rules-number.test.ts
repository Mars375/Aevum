import { describe, expect, it } from "vitest";
import { rulesNumber, requestCouncil } from "../src/council.js";
import { newSpectator } from "../../world/src/spectator.js";

/**
 * Une version à deux chiffres ne doit pas mentir sur la provenance.
 *
 * La provenance annoncée venait de `state.rules.slice(-1)`, ce qui marchait
 * tant que les versions tenaient sur un chiffre. « spectator-10 » aurait rendu
 * « 0 » : un conseil v10 se serait présenté comme un conseil v0, dans le seul
 * champ qui dit d'où vient une décision. La passation signalait ce piège avant
 * d'écrire v10 ; il était déjà armé.
 */
describe("le numero de regles se lit apres le tiret", () => {
  it("rend le nombre entier, pas son dernier chiffre", () => {
    expect(rulesNumber("spectator-9")).toBe("9");
    expect(rulesNumber("spectator-10")).toBe("10");
    expect(rulesNumber("spectator-123")).toBe("123");
  });

  it("rend la chaine telle quelle quand elle ne porte aucun numero", () => {
    expect(rulesNumber("spectator")).toBe("spectator");
    expect(rulesNumber("")).toBe("");
  });

  it("annonce la provenance reelle d'un conseil local", async () => {
    const state = newSpectator();
    const answer = await requestCouncil(state, "amber", "local", "");
    expect(answer.source).toBe("local");
    expect(answer.model).toBe(
      `local/deterministic-council-v${rulesNumber(state.rules)}`,
    );
    // Et jamais un numero fabrique a partir du dernier caractere.
    expect(answer.model).not.toMatch(/-v0$/);
  });
});

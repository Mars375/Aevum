import { describe, expect, it } from "vitest";
import {
  DEFAULT_COUNCIL_MODEL,
  STABLE_FREE_MODELS,
  NATIVE_SCHEMA_MODELS,
  canCall,
  isFreeRef,
} from "@abs/agents";
import { REASONING_OFF_MODELS } from "../src/roster.js";
import { defaultCouncilModels } from "../src/default-models.js";

/**
 * Seuls les modèles retenus gouvernent nos tests.
 *
 * Le défaut a longtemps été `longcat-2.0`, qui perd un tour sur sept en durée :
 * il suffisait d'une ligne pour y revenir sans que personne le voie. Ces
 * vérifications rendent ce retour bruyant.
 */
describe("la sélection des modèles gratuits stables", () => {
  it("fournit le défaut des quatre dirigeants", () => {
    expect(DEFAULT_COUNCIL_MODEL).toBe(STABLE_FREE_MODELS[0]!.ref);
    const refs = STABLE_FREE_MODELS.map((model) => model.ref);
    for (const model of Object.values(defaultCouncilModels({})))
      expect(refs).toContain(model);
  });

  /**
   * Un modèle retenu l'a été dans des conditions précises : gratuit, sans
   * clé, sortie structurée native, raisonnement bridé. Le servir autrement,
   * c'est servir un modèle qui n'a pas été mesuré.
   */
  it("est servi comme il a été mesuré", () => {
    for (const { ref, evidence } of STABLE_FREE_MODELS) {
      expect(isFreeRef(ref), ref).toBe(true);
      expect(canCall(ref, {}), `${ref} sans clé`).toBe(true);
      expect(NATIVE_SCHEMA_MODELS.has(ref), ref).toBe(true);
      expect(REASONING_OFF_MODELS.has(ref), ref).toBe(true);
      expect(
        evidence.length,
        `${ref} : la mesure qui le justifie`,
      ).toBeGreaterThan(20);
    }
  });
});

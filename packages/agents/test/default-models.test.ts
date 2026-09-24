import { expect, it } from "vitest";
import { defaultCouncilModels } from "../src/default-models.js";
import { DEFAULT_COUNCIL_MODEL } from "../src/stable-models.js";

it("preselects one consistent model, the selected stable one, for all four rulers", () => {
  expect(new Set(Object.values(defaultCouncilModels({})))).toEqual(
    new Set([DEFAULT_COUNCIL_MODEL]),
  );
  // Un ancien réglage ne ramène pas un modèle écarté : NOUS_MODEL désignait
  // longcat-2.0 sur la machine de développement, et l'observatoire le proposait.
  expect(
    defaultCouncilModels({ NOUS_MODEL: "meituan/longcat-2.0:free" }).amber,
  ).toBe(DEFAULT_COUNCIL_MODEL);
  expect(
    defaultCouncilModels({ AEVUM_COUNCIL_MODEL: " nous:custom:free " }).azure,
  ).toBe("nous:custom:free");
});

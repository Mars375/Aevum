import { expect, it } from "vitest";
import { defaultCouncilModels } from "../src/default-models.js";
import { DEFAULT_COUNCIL_MODEL } from "../src/stable-models.js";

it("preselects one consistent model, the selected stable one, for all four rulers", () => {
  expect(new Set(Object.values(defaultCouncilModels({})))).toEqual(
    new Set([DEFAULT_COUNCIL_MODEL]),
  );
  expect(defaultCouncilModels({ NOUS_MODEL: "nous:custom:free" }).amber).toBe(
    "nous:custom:free",
  );
  expect(defaultCouncilModels({ NOUS_MODEL: " custom:free " }).azure).toBe(
    "nous:custom:free",
  );
});

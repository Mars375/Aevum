import { expect, it } from "vitest";
import { defaultCouncilModels } from "../src/default-models.js";

it("preselects a consistent Nous model without inventing different providers", () => {
  expect(new Set(Object.values(defaultCouncilModels({})))).toEqual(
    new Set(["nous:meituan/longcat-2.0:free"]),
  );
  expect(defaultCouncilModels({ NOUS_MODEL: "nous:custom:free" }).amber).toBe(
    "nous:custom:free",
  );
  expect(defaultCouncilModels({ NOUS_MODEL: " custom:free " }).azure).toBe(
    "nous:custom:free",
  );
});

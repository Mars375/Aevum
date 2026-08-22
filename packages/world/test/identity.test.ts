import { describe, expect, it } from "vitest";
import { CivSchema, newCiv } from "../src/index.js";

describe("identite persistante", () => {
  it("derive un nom stable de l'identifiant pour une ancienne civilisation", () => {
    const old = { ...newCiv("verdant") } as Record<string, unknown>;
    delete old.identity;
    expect(CivSchema.parse(old).identity).toEqual({ displayName: "Verdant", values: [], origin: "" });
  });

  it("conserve une identite declaree", () => {
    const civ = newCiv("azure");
    const identity = { displayName: "The Azure Reach", values: ["curiosity", "mutual aid"], origin: "Founded beside the river." };
    expect(CivSchema.parse({ ...civ, identity }).identity).toEqual(identity);
  });
});

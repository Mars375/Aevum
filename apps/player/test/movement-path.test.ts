import { expect, it } from "vitest";
import { pathOffset, sampleOffset } from "../src/three/movement-path";

it("follows each cardinal segment rather than cutting a corner", () => {
  const offset = pathOffset([0, 1, 11, 12], 0, 12, 10)!;
  expect(sampleOffset(offset, 0)).toEqual({ dx: -2, dz: -1 });
  expect(sampleOffset(offset, 1 / 3)).toEqual({ dx: -1, dz: -1 });
  expect(sampleOffset(offset, 2 / 3)).toEqual({ dx: -1, dz: 0 });
  expect(sampleOffset(offset, 1)).toEqual({ dx: 0, dz: 0 });
});
it("rejects non-adjacent paths and paths from a different displayed state", () => {
  expect(pathOffset([0, 12], 0, 12, 10)).toBeNull();
  expect(pathOffset([9, 10], 9, 10, 10)).toBeNull();
  expect(pathOffset([0, 1, 2], 5, 2, 10)).toBeNull();
  expect(pathOffset([0, 1, 2], 0, 3, 10)).toBeNull();
});

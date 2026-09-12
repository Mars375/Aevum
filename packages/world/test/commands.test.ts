import { describe, expect, it } from "vitest";
import { newCivilizationWorld } from "../src/civilization.js";
import { resolveCommands } from "../src/commands.js";

function setup() {
  const world = newCivilizationWorld(["amber", "azure"], 42);
  for (const tile of world.board) {
    tile.owner = null;
    tile.kind = "plain";
  }
  const amber = world.simulation!.units.find(
    (u) => u.owner === "amber" && u.role === "soldier",
  )!;
  const azure = world.simulation!.units.find(
    (u) => u.owner === "azure" && u.role === "soldier",
  )!;
  world.simulation!.units = [amber, azure];
  amber.position = amber.previous = 14;
  azure.position = azure.previous = 16;
  return { world, amber, azure };
}
const batch = (
  civ: "amber" | "azure",
  unit: string,
  target: number,
  turn = 0,
) => ({
  civ,
  turn,
  orders: [{ unit, target, action: "move", reason: "Rejoindre la frontière" }],
});

describe("simultaneous command phase", () => {
  it("blocks opposing arrivals independently of submission order", () => {
    const { world, amber, azure } = setup();
    const orders = [batch("amber", amber.id, 15), batch("azure", azure.id, 15)];
    const before = structuredClone(world);
    const result = resolveCommands(world, [], orders);
    expect(result).toEqual(resolveCommands(world, [], [...orders].reverse()));
    expect(result.world.simulation!.units.map((u) => u.position)).toEqual([
      14, 16,
    ]);
    expect(result.missions.every((m) => m.status === "blocked")).toBe(true);
    expect(world).toEqual(before);
  });
  it("continues a mission without another AI call and completes on arrival", () => {
    const { world, amber } = setup();
    const first = resolveCommands(world, [], [batch("amber", amber.id, 40)]);
    expect(first.world.simulation!.units[0]!.position).toBe(27);
    const second = resolveCommands(
      { ...first.world, tick: 1 },
      first.missions,
      [],
    );
    expect(second.world.simulation!.units[0]!.position).toBe(40);
    expect(second.missions[0]!.status).toBe("completed");
    expect(first.missions[0]!.status).toBe("active");
  });
  it("rejects foreign units, stale turns and out-of-map targets", () => {
    const { world, amber, azure } = setup();
    for (const order of [
      batch("amber", azure.id, 15),
      batch("amber", amber.id, 15, 1),
      batch("amber", amber.id, 999),
    ]) {
      const result = resolveCommands(world, [], [order]);
      expect(result.rejected).toHaveLength(1);
      expect(result.missions).toEqual([]);
    }
  });
  it("rejects duplicate submissions instead of accepting the last response", () => {
    const { world, amber } = setup();
    const result = resolveCommands(
      world,
      [],
      [batch("amber", amber.id, 15), batch("amber", amber.id, 27)],
    );
    expect(result.rejected).toHaveLength(2);
    expect(result.missions).toEqual([]);
  });
  it("keeps a defense mission active at its destination", () => {
    const { world, amber } = setup();
    const order = batch("amber", amber.id, 14);
    const result = resolveCommands(
      world,
      [],
      [{ ...order, orders: [{ ...order.orders[0], action: "defend" }] }],
    );
    expect(result.missions[0]!.status).toBe("active");
    expect(result.world.simulation!.units[0]!.task).toBe("guard");
  });
  it("continues an escort when the protected unit moves", () => {
    const { world, amber } = setup();
    const protectedUnit = {
      ...amber,
      id: "protected",
      role: "settler" as const,
      position: 27,
      previous: 27,
    };
    world.simulation!.units.push(protectedUnit);
    const first = resolveCommands(
      world,
      [],
      [
        {
          civ: "amber",
          turn: 0,
          orders: [
            {
              unit: amber.id,
              action: "escort",
              target: 27,
              escort: "protected",
              reason: "Protéger le colon",
            },
          ],
        },
      ],
    );
    expect(first.missions[0]!.status).toBe("active");
    first.world.simulation!.units.find((u) => u.id === "protected")!.position =
      40;
    const next = resolveCommands(first.world, first.missions, []);
    expect(
      next.world.simulation!.units.find((u) => u.id === amber.id)!.position,
    ).toBe(40);
  });
});

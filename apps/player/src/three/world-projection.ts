import type { Age } from "../../../../packages/world/src/ages";
import type { FactionId } from "@abs/contracts";
import type { Year } from "@abs/world";

export const WORLD_ASSETS = [
  "bronze_city",
  "classical_city",
  "medieval_city",
  "industrial_city",
  "modern_city",
  "future_city",
  "bronze_soldier",
  "classical_soldier",
  "medieval_soldier",
  "industrial_soldier",
  "modern_soldier",
  "future_soldier",
  "pine",
  "tree",
  "rock",
  "hamlet",
  "town",
  "citadel",
  "farm",
  "mine",
  "ruins",
  "soldier",
  "farmer",
  "lumberjack",
  "miner",
  "merchant",
] as const;
export type WorldAsset = (typeof WORLD_ASSETS)[number];
export const CIV_COLORS: Record<FactionId, string> = {
  amber: "#e0b45c",
  azure: "#78b6ee",
  crimson: "#e58d83",
  verdant: "#83ba91",
};
export const LAND_NAMES = {
  plain: "Prairie",
  forest: "Forêt",
  hill: "Collines",
  river: "Rivière",
} as const;
export interface Placement {
  asset: WorldAsset;
  x: number;
  z: number;
  scale: number;
  angle: number;
  faction?: FactionId;
  unitId?: string;
  previousPosition?: number;
  movementPath?: number[];
}
export const UNIT_NAMES = {
  soldier: "Soldats",
  farmer: "Paysans",
  lumberjack: "Bûcherons",
  miner: "Mineurs",
  merchant: "Marchands",
} as const;
export type UnitRole = keyof typeof UNIT_NAMES;

/** Stable parcel detail: seeking backwards must not randomly regrow a forest. */
export function detailNoise(seed: number, index: number, salt: number): number {
  let h =
    Math.imul(seed ^ (index + 1), 0x45d9f3b) ^ Math.imul(salt + 1, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h >>> 0) / 4294967296;
}

export function projectWorld(
  year: Year,
  history: readonly Year[],
  ages?: Record<string, Age>,
) {
  const { world } = year;
  const formerSeats = new Set<number>();
  for (const past of history) {
    if (past.tick > year.tick) break;
    for (const civ of past.world.civs)
      if (civ.capital !== null) formerSeats.add(civ.capital);
  }
  const parcels = world.board.map((place, index) => {
    const civ = world.civs.find((c) => c.id === place.owner);
    const capital = !!civ && civ.fellOnTick === null && civ.capital === index;
    const ruins = place.owner === null && formerSeats.has(index);
    const noise = (salt: number) => detailNoise(world.seed, index, salt);
    const assets: Placement[] = [];
    const add = (asset: WorldAsset, x = 0, z = 0, scale = 1, angle = 0) =>
      assets.push({ asset, x, z, scale, angle });
    const city = world.simulation?.cities.find((c) => c.position === index);
    if (city) {
      add(
        ages?.[city.owner]
          ? (`${ages[city.owner]}_city` as WorldAsset)
          : city.buildings.includes("walls") && city.buildings.length >= 4
            ? "citadel"
            : city.buildings.length >= 2
              ? "town"
              : "hamlet",
        0,
        0,
        0.92,
      );
    } else if (capital) {
      add(
        civ.population >= 450 && civ.advances.length >= 3
          ? "citadel"
          : civ.population >= 180
            ? "town"
            : "hamlet",
        0,
        0,
        0.92,
      );
    } else if (ruins) {
      add("ruins", 0, 0, 0.9);
    } else if (place.kind === "forest") {
      for (let n = 0; n < 5; n++)
        add(
          n % 3 ? "pine" : "tree",
          (noise(n * 3) - 0.5) * 0.7,
          (noise(n * 3 + 1) - 0.5) * 0.7,
          0.65 + noise(n * 3 + 2) * 0.45,
          noise(n + 23) * Math.PI * 2,
        );
    } else if (place.kind === "hill") {
      add("rock", -0.05, 0.02, 1.1 + noise(3) * 0.35, noise(1) * 6);
      if (civ && civ.doctrine.mining > 0) add("mine", 0.25, 0.27, 0.48);
    } else if (place.kind === "plain") {
      if (civ && civ.doctrine.farming > 0 && noise(6) > 0.5)
        add("farm", 0, 0, 0.76, noise(7) > 0.5 ? Math.PI / 2 : 0);
      else if (
        civ &&
        civ.population / Math.max(1, civ.territory) > 18 &&
        noise(8) > 0.65
      )
        add("hamlet", 0.03, 0, 0.6, Math.PI / 2);
      else if (noise(4) > 0.45) add("tree", 0.15, -0.1, 0.6 + noise(5) * 0.3);
    }
    return {
      index,
      place,
      civ,
      capital,
      city,
      ruins,
      assets,
      units: [] as UnitRole[],
      unitDetails: [] as string[],
      x: (index % world.size) - (world.size - 1) / 2,
      z: Math.floor(index / world.size) - (world.size - 1) / 2,
    };
  });
  if (world.simulation) {
    for (const unit of world.simulation.units) {
      const parcel = parcels[unit.position];
      if (!parcel) continue;
      const role = unit.role === "settler" ? "merchant" : unit.role;
      const slot = parcel.units.length;
      parcel.units.push(role);
      parcel.unitDetails.push(
        `${unit.owner} · ${unit.role === "settler" ? "Colons" : UNIT_NAMES[role]}${unit.role === "soldier" ? ` (${unit.strength})` : ""} · ${unit.task}`,
      );
      parcel.assets.push({
        asset:
          role === "soldier" && ages?.[unit.owner]
            ? (`${ages[unit.owner]}_soldier` as WorldAsset)
            : role,
        faction: unit.owner,
        unitId: unit.id,
        previousPosition: unit.previous,
        x: -0.34 + (slot % 3) * 0.25,
        z: 0.36 - Math.floor(slot / 3) * 0.22,
        scale: 0.72,
        angle: -0.35,
      });
    }
    return parcels;
  }
  // Representative figures, never individual tactical positions. Cap density so
  // a late-game population cannot flood the board or multiply draw calls.
  for (const civ of world.civs) {
    if (civ.fellOnTick !== null || civ.population <= 0) continue;
    const owned = parcels.filter(
      (p) => p.place.owner === civ.id && p.place.kind !== "river",
    );
    const total =
      civ.doctrine.farming +
      civ.doctrine.forestry +
      civ.doctrine.mining +
      civ.doctrine.trade +
      civ.doctrine.military;
    const roles: [UnitRole, number, string][] = [
      [
        "soldier",
        Math.min(6, Math.ceil(Math.max(0, civ.soldiers) / 10)),
        "plain",
      ],
      ["farmer", civ.doctrine.farming, "plain"],
      ["lumberjack", civ.doctrine.forestry, "forest"],
      ["miner", civ.doctrine.mining, "hill"],
      ["merchant", civ.doctrine.trade, "plain"],
    ];
    for (const [role, amount, land] of roles) {
      const count =
        role === "soldier"
          ? amount
          : Math.min(
              2,
              Math.ceil((civ.population * amount) / Math.max(1, total) / 60),
            );
      const candidates = [...owned].sort((a, b) => {
        const rank = (p: typeof a) =>
          role === "soldier" || role === "merchant"
            ? p.capital
              ? 0
              : 1
            : p.place.kind === land && !p.capital
              ? 0
              : 1;
        return rank(a) - rank(b) || a.index - b.index;
      });
      for (let n = 0; n < count; n++) {
        const parcel = candidates.find(
          (p) =>
            p.units.length < 4 &&
            (role !== "soldier" ||
              p.units.filter((u) => u === "soldier").length < 2),
        );
        if (!parcel) break;
        const slot = parcel.units.length;
        parcel.units.push(role);
        parcel.assets.push({
          asset: role,
          faction: civ.id,
          x: -0.36 + slot * 0.235,
          z: 0.39,
          scale: 0.72,
          angle: -0.35,
        });
      }
    }
  }
  return parcels;
}
export type WorldParcel = ReturnType<typeof projectWorld>[number];

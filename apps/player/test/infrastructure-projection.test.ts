import { describe, expect, it } from "vitest";
import { newCivilizationWorld, type Year } from "@abs/world";
import {
  INFRASTRUCTURE_ASSETS,
  type InfrastructureKind,
} from "../src/three/infrastructure-models";
import { projectWorld } from "../src/three/world-projection";

type SiteInput = { city: string; kind: InfrastructureKind };

const kind = (
  asset: (typeof INFRASTRUCTURE_ASSETS)[number],
): InfrastructureKind => asset.slice("infra_".length) as InfrastructureKind;

const yearOf = (): Year => ({
  tick: 0,
  world: newCivilizationWorld(["crimson", "azure"], 42),
  events: [],
  rulings: [],
});

const infraAssets = (parcels: ReturnType<typeof projectWorld>) =>
  parcels.flatMap((parcel) =>
    parcel.assets.filter((asset) => asset.asset.startsWith("infra_")),
  );

describe("infrastructure projection (v9)", () => {
  it("places all six kinds on the matching city in canonical order", () => {
    const year = yearOf();
    const [host, other] = year.world.simulation!.cities;
    const sites: SiteInput[] = INFRASTRUCTURE_ASSETS.map((asset) => ({
      city: host!.id,
      kind: kind(asset),
    }));
    const parcels = projectWorld(year, [year], undefined, sites);
    const placed = infraAssets(parcels);
    expect(placed.map((asset) => asset.asset)).toEqual([
      ...INFRASTRUCTURE_ASSETS,
    ]);
    expect(placed.every((asset) => asset.scale === 0.24)).toBe(true);
    expect(
      placed.every(
        (asset) => Math.abs(asset.x) <= 0.5 && Math.abs(asset.z) <= 0.5,
      ),
    ).toBe(true);
    expect(new Set(placed.map((asset) => `${asset.x}:${asset.z}`)).size).toBe(6);
    expect(
      infraAssets(parcels.filter((p) => p.index !== host!.position)),
    ).toEqual([]);
    expect(other!.position).toBeGreaterThanOrEqual(0);
  });

  it("never mutates the year snapshot or the site list", () => {
    const year = yearOf();
    const city = year.world.simulation!.cities[0]!;
    const sites: SiteInput[] = [
      { city: city.id, kind: kind("infra_foundry") },
      { city: city.id, kind: kind("infra_spaceport") },
    ];
    const beforeYear = structuredClone(year);
    const beforeSites = structuredClone(sites);
    projectWorld(year, [year], undefined, sites);
    expect(year).toEqual(beforeYear);
    expect(sites).toEqual(beforeSites);
  });

  it("orders sites canonically and deduplicates repeated kinds", () => {
    const year = yearOf();
    const city = year.world.simulation!.cities[0]!;
    const shuffled: SiteInput[] = [
      { city: city.id, kind: kind("infra_spaceport") },
      { city: city.id, kind: kind("infra_foundry") },
      { city: city.id, kind: kind("infra_research_center") },
      { city: city.id, kind: kind("infra_foundry") },
    ];
    const canonical = projectWorld(year, [year], undefined, shuffled);
    const reversed = projectWorld(
      year,
      [year],
      undefined,
      [...shuffled].reverse(),
    );
    const names = (parcels: ReturnType<typeof projectWorld>) =>
      parcels[city.position]!.assets
        .filter((asset) => asset.asset.startsWith("infra_"))
        .map((asset) => asset.asset);
    expect(names(canonical)).toEqual([
      "infra_foundry",
      "infra_research_center",
      "infra_spaceport",
    ]);
    expect(names(reversed)).toEqual(names(canonical));
  });

  it("reproduces the archived projection exactly without sites", () => {
    const year = yearOf();
    const reference = projectWorld(year, [year]);
    expect(projectWorld(year, [year], undefined, [])).toEqual(reference);
    expect(
      projectWorld(year, [year], undefined, [
        { city: "city-does-not-exist", kind: kind("infra_foundry") },
      ]),
    ).toEqual(reference);
  });

  it("ignores unknown cities and sites whose city only appears later", () => {
    const world = newCivilizationWorld(["crimson", "azure"], 42);
    const first: Year = { tick: 0, world, events: [], rulings: [] };
    const later = structuredClone(first);
    later.tick = later.world.tick = 10;
    const crimson = later.world.civs.find((c) => c.id === "crimson")!;
    const seat = crimson.capital!;
    let seat2 = later.world.board.findIndex(
      (place, index) =>
        index !== seat && place.owner === "crimson" && place.kind !== "river",
    );
    if (seat2 === -1)
      seat2 = later.world.board.findIndex(
        (place, index) => index !== seat && place.owner === null,
      );
    expect(seat2).toBeGreaterThan(-1);
    later.world.simulation!.cities.push({
      id: "city-future",
      owner: "crimson",
      position: seat2,
      founded: 10,
      buildings: [],
      queue: null,
    });
    const sites: SiteInput[] = [
      { city: "city-absent", kind: kind("infra_foundry") },
      { city: "city-future", kind: kind("infra_spaceport") },
    ];
    const history = [first, later];
    expect(infraAssets(projectWorld(first, history, undefined, sites))).toEqual(
      [],
    );
    const laterParcels = projectWorld(later, history, undefined, sites);
    expect(
      laterParcels[seat2]!.assets.some(
        (asset) => asset.asset === "infra_spaceport",
      ),
    ).toBe(true);
  });

  it("shrinks the city model only on cities hosting infrastructure", () => {
    const year = yearOf();
    const [host, other] = year.world.simulation!.cities;
    const base = projectWorld(year, [year]);
    expect(base[host!.position]!.assets[0]!.scale).toBe(0.92);
    expect(base[other!.position]!.assets[0]!.scale).toBe(0.92);
    const withSite = projectWorld(year, [year], undefined, [
      { city: host!.id, kind: kind("infra_foundry") },
    ]);
    expect(withSite[host!.position]!.assets[0]!.scale).toBeLessThan(0.92);
    expect(withSite[other!.position]!.assets[0]!.scale).toBe(0.92);
  });
});
import { describe, expect, it } from "vitest";
import { newCivilizationWorld, tickWorld, census, fingerprint, newJournal, JournalSchema, replay, chronicle, applyRuling, type World } from "../src/index.js";
import { unitPath } from "../src/units.js";

const ids = ["crimson","azure","verdant","amber"] as const;
const fresh = (seed = 42) => newCivilizationWorld([...ids],seed);
function assertWorld(world: World) {
  const sim = world.simulation!;
  expect(new Set(sim.units.map(u => u.id)).size).toBe(sim.units.length);
  for (const civ of world.civs) {
    expect(civ.population).toBeGreaterThanOrEqual(0);
    expect(civ.soldiers).toBeGreaterThanOrEqual(0);
    expect(civ.soldiers).toBeLessThanOrEqual(civ.population);
    for (const amount of Object.values(civ.stock)) expect(Number.isFinite(amount) && amount >= 0).toBe(true);
    expect(civ.territory).toBe(world.board.filter(p => p.owner === civ.id).length);
    expect(sim.units.filter(u => u.owner === civ.id && u.role === "soldier").reduce((s,u) => s+u.strength,0)).toBe(civ.soldiers);
    if (civ.fellOnTick !== null) {
      expect(civ.territory).toBe(0); expect(civ.capital).toBeNull();
      expect(sim.units.some(u => u.owner === civ.id)).toBe(false);
    } else expect(world.board[civ.capital!]!.owner).toBe(civ.id);
  }
  for (const unit of sim.units) {
    expect(world.board[unit.position]).toBeDefined();
    const delta = Math.abs(unit.position % world.size-unit.previous % world.size)+Math.abs(Math.floor(unit.position/world.size)-Math.floor(unit.previous/world.size));
    expect(delta).toBeLessThanOrEqual(1);
  }
  for (const city of sim.cities) expect(world.board[city.position]!.owner).toBe(city.owner);
}

describe("w10 civilization engine", () => {
  it("rejects a pending barrier with missing or duplicate decisions", () => {
    const journal = newJournal(fresh());
    journal.scheduler = { pending: [], remaining: ["azure"], sources: {} };
    expect(JournalSchema.safeParse(journal).success).toBe(false);
  });
  it("makes a foodless non-farming economy starve without negative stocks", () => {
    const world = fresh();
    for (const civ of world.civs) {
      civ.stock.food = 0;
      civ.doctrine.farming = 0;
      civ.doctrine.forestry = 1;
      civ.doctrine.mining = civ.doctrine.trade = civ.doctrine.military = 0;
    }
    const result = tickWorld(world);
    expect(result.events.some(e => e.kind === "STARVED")).toBe(true);
    expect(result.world.civs[0]!.population).toBeLessThan(world.civs[0]!.population);
    assertWorld(result.world);
  });
  it("runs 300 years without mutating input, teleporting or losing soldiers", () => {
    let world = fresh();
    const start = structuredClone(world);
    const counts = new Map<string,number>();
    for (let i=0;i<300;i++) {
      const next = tickWorld(world); world=next.world;
      assertWorld(world);
      for (const e of next.events) counts.set(e.kind,(counts.get(e.kind)??0)+1);
    }
    expect(fresh()).toEqual(start);
    expect(world.civs.filter(c => c.fellOnTick === null).length).toBeGreaterThanOrEqual(2);
    expect(counts.get("EXPANDED")).toBeGreaterThan(0);
    expect(counts.get("BUILT")).toBeGreaterThan(0);
    expect(world.civs.some(c => c.advances.includes("engineering"))).toBe(true);
  });
  it("is deterministic under civilization reordering and replays JSON journals exactly", () => {
    const world=fresh(), reverse={...world,civs:[...world.civs].reverse()};
    expect(tickWorld(reverse)).toEqual(tickWorld(world));
    const before=structuredClone(world); tickWorld(world); expect(world).toEqual(before);
    const journal=newJournal(world);
    journal.rulings.push({tick:20,civ:"azure",kind:"DRIFT",doctrine:{focus:"science",posture:"TRADE"},reason:"research",model:null,deferredBy:0});
    journal.livedTo=100;
    const result=replay(world,journal.rulings,100).world;
    journal.fingerprint=fingerprint(result);
    const parsed=JournalSchema.parse(JSON.parse(JSON.stringify(journal)));
    expect(fingerprint(chronicle(parsed).at(-1)!.world)).toBe(journal.fingerprint);
    expect(fingerprint(replay(world,journal.rulings,101).world)).not.toBe(journal.fingerprint);
  });
  it("pays construction up front and completes it after several years", () => {
    const origin=fresh();
    const civ=origin.civs[0]!;
    civ.stock={food:1000,timber:35,ore:0,wealth:100};
    civ.doctrine={...civ.doctrine,farming:1,forestry:0,mining:0,trade:0,military:0};
    const first=tickWorld(origin).world;
    expect(first.civs[0]!.stock.timber).toBe(0);
    expect(first.simulation!.cities[0]!.queue?.building).toBe("granary");
    expect(first.simulation!.cities[0]!.buildings).toEqual([]);
    let world=first;
    for(let i=0;i<4;i++) world=tickWorld(world).world;
    expect(world.simulation!.cities[0]!.buildings).toContain("granary");
  });
  it("applies research effects and declines invalid origins", () => {
    const world=fresh(), advanced=structuredClone(world);
    advanced.civs[0]!.advances=["irrigation"];
    expect(tickWorld(advanced).world.civs[0]!.stock.food).toBeGreaterThan(tickWorld(world).world.civs[0]!.stock.food);
    expect(() => newCivilizationWorld(["azure","azure"],42)).toThrow();
    expect(() => newCivilizationWorld([...ids],42,2)).toThrow();
  });
  it("cleans up extinct armies and cities", () => {
    let world=tickWorld(fresh()).world;
    world.civs[0]!.population=0;
    world=tickWorld(world).world;
    assertWorld(world);
    expect(world.civs[0]!.fellOnTick).toBe(2);
  });
  it("cannot path through a peaceful foreign border", () => {
    const world=tickWorld(fresh()).world;
    const unit=world.simulation!.units[0]!;
    const target=unit.position+1;
    world.board[target]!.owner=world.civs.find(c => c.id!==unit.owner)!.id;
    expect(unitPath(world,unit,target)).toEqual([]);
  });
  it("executes local combat and observes a truce", () => {
    let world=newCivilizationWorld(["amber","azure"],12,7);
    for (const [i,p] of world.board.entries()) {p.owner=i%7<3?"amber":"azure";p.kind="plain";}
    world.civs[0]!.capital=23;world.civs[1]!.capital=24;
    world.simulation!.cities[0]!.position=23;world.simulation!.cities[1]!.position=24;
    world.civs[0]!.soldiers=30;world.civs[1]!.soldiers=0;
    world.civs[0]!.doctrine.posture="PRESSURE";
    world=census(world);
    const first=tickWorld(world);
    expect(first.world.simulation!.relations[0]!.status).toBe("war");
    expect(first.events.some(e=>e.kind==="SEIZED")).toBe(true);
    assertWorld(first.world);
    world=applyRuling(first.world,{tick:1,civ:"amber",kind:"DRIFT",doctrine:{posture:"GUARD"},model:null,reason:"peace",deferredBy:0});
    world=tickWorld(world).world;
    expect(world.simulation!.relations[0]!.status).toBe("peace");
    expect(world.simulation!.relations[0]!.truceUntil).toBeGreaterThan(world.tick);
  });
});

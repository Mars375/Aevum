import type { Civ } from "./state.js";

/**
 * Everything the world rolls, and nothing it decides.
 *
 * Seasons, bandits and disasters all come from the same place: a pure function
 * of the seed and the year. Gathering them here makes the rule visible that
 * each of them separately has to obey — no clock, no Math.random, nothing a
 * replay could not reproduce.
 */
/**
 * Years are not alike.
 *
 * A world where the harvest is the same every tick has no history — the first
 * measurement showed exactly that: 79% of the wake-ups were "nothing has
 * happened for forty ticks". Adversity has to come from somewhere, and it must
 * not come from Math.random(), which would break replay.
 *
 * So the season is a pure function of (seed, tick): the same world lives the
 * same years, every time it is replayed, while no ruler can predict them from
 * the doctrine it wrote.
 */
export function season(seed: number, tick: number): number {
  // xorshift-style mix over the two integers. Cheap, deterministic, and good
  // enough for "was this a hard year" — it is not being used for cryptography.
  let h = (seed * 0x9e3779b1) ^ (tick * 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35);
  h ^= h >>> 13;
  const unit = (h >>> 0) / 0x100000000;
  // Famine years are rarer than good ones, and harsher: 0.55x to 1.35x.
  return 0.55 + unit ** 0.7 * 0.8;
}

/**
 * A raw unit value from (seed, tick, salt). Same mix as `season`, different
 * salt, so the harvest and the bandits are not the same die rolled twice.
 */
function noise(seed: number, tick: number, salt: number): number {
  let h = (seed * 0x27d4eb2d) ^ (tick * 0x165667b1) ^ (salt * 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h ^= h >>> 15;
  return (h >>> 0) / 0x100000000;
}

/** Civilisation ids are names, not numbers; this makes one a salt. */
const saltOf = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

/**
 * Bandits.
 *
 * A world with no pressure but its own harvest settles into a long calm, and a
 * calm world is one nobody watches. Bandits keep it moving without any
 * civilisation having to be the aggressor.
 *
 * Two rules make them a pressure rather than a guillotine:
 *   - they are drawn to wealth. A rich, unguarded civilisation is raided often;
 *     a poor one is left alone, so raids do not simply finish off whoever is
 *     already losing.
 *   - what they take is a share of what is there, never a fixed amount. A
 *     village loses a village's worth and survives it; the same raid on an
 *     empire takes an empire's worth. Nothing is ever destroyed at a stroke.
 */

export interface Raid {
  /** 0 when the bandits never came. */
  strength: number;
  repelled: boolean;
}

/**
 * How much harder the world presses as an era ages.
 *
 * Without this, three civilisations settle into a guarded equilibrium and hold
 * it for a thousand years — measured, not guessed: an era that never resolves
 * is an era nobody finishes watching. Pressure rises slowly and then stops
 * rising, so a young world is survivable and an old one is not comfortable.
 */
export const pressure = (tick: number): number => 1 + Math.min(1.5, tick / 400);

export function raidOn(civ: Civ, seed: number, tick: number): Raid {
  const draw = noise(seed, tick, saltOf(civ.id));
  // Wealth per head is what attracts them: a large poor civilisation is not a
  // more tempting target than a small rich one.
  const perHead = civ.stock.wealth / Math.max(1, civ.population);
  // Bandits do not ride out for nothing. A civilisation with no surplus is left
  // alone — without this the pressure ground every civilisation down to twenty
  // souls and held them there forever, which is a worse stagnation than the one
  // it was meant to cure.
  if (perHead < 0.3) return { strength: 0, repelled: false };

  const chance = Math.min(0.35, (0.03 + perHead * 0.02) * pressure(tick));
  if (draw > chance) return { strength: 0, repelled: false };

  // Age raises how often they come, never how much they take in one visit: the
  // ceilings below are absolute, so a village always loses a village's share
  // and survives it.
  const strength = 0.35 + noise(seed, tick, saltOf(civ.id) ^ 0x5bf03635) * 0.65;
  const guard = civ.doctrine.posture === "GUARD" ? 1.6 : 1;
  const defence = (civ.soldiers * guard) / Math.max(1, civ.population / 20);
  return { strength, repelled: defence >= strength };
}


/**
 * Disasters.
 *
 * Bandits already keep a world from settling, but they only ever take what is
 * portable, so the land itself carried no risk — a civilisation that seized
 * every river was simply better off, with nothing to weigh against it. Each
 * disaster is tied to the ground that invites it, which is what turns "which
 * land do we covet" from an optimisation into a bet.
 *
 * Pure functions of (seed, tick, civ) like the seasons and the bandits, and
 * proportional like them: a share of what is there, never a fixed amount, so a
 * village loses a village's worth.
 */
export const DISASTERS = [
  {
    kind: "flood",
    label: "crue",
    // Rivers feed you and drown you. The scarcest, most contested land is also
    // the only one that can take a year's grain in a night.
    invites: (c: Civ) => c.lands.river,
    strike: (c: Civ) => ({ food: -0.35, population: -0.03, timber: -0.15 }),
  },
  {
    kind: "plague",
    label: "peste",
    // Crowding, not size: a large civilisation on ample land is no more exposed
    // than a small one.
    invites: (c: Civ) => Math.max(0, c.population / Math.max(1, c.territory) / 25 - 1) * 4,
    strike: () => ({ population: -0.12, food: 0, timber: 0 }),
  },
  {
    kind: "fire",
    label: "incendie",
    invites: (c: Civ) => c.lands.forest * 0.6,
    strike: () => ({ timber: -0.5, population: -0.01, food: -0.05 }),
  },
] as const;

export interface Disaster {
  kind: string;
  label: string;
  severity: number;
  strike: { food: number; population: number; timber: number };
}

export function disasterOn(civ: Civ, seed: number, tick: number): Disaster | null {
  const draw = noise(seed, tick, saltOf(civ.id) ^ 0x1b873593);
  let floor = 0;
  for (const d of DISASTERS) {
    // Exposure buys likelihood, and nothing else: the severity of a flood does
    // not grow with the number of rivers, or holding many would be fatal rather
    // than risky.
    const chance = Math.min(0.05, d.invites(civ) * 0.004);
    if (draw >= floor && draw < floor + chance) {
      const severity = 0.4 + noise(seed, tick, saltOf(civ.id) ^ 0x27d4eb2f) * 0.6;
      const s = d.strike(civ);
      return { kind: d.kind, label: d.label, severity, strike: s };
    }
    floor += chance;
  }
  return null;
}


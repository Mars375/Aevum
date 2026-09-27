/**
 * Les chocs régionaux de spectator-12.
 *
 * Mesuré avant eux (pourquoi-pas-de-guerre.md) : quatre parties de 1 200
 * actions finissent presque toutes au même équilibre — deux villes, six cases,
 * 387 habitants — et n'en bougent plus pendant des centaines d'actions. Le
 * seul choc du moteur était un multiplicateur de récolte commun à tous
 * (0,65 à 1,35, trois manches), divisé par deux par l'irrigation ou un
 * grenier : il ne coûtait rien.
 *
 * Un choc frappe **une** civilisation, pas le monde : c'est ce qui sépare les
 * destins. Il est tiré d'un hachage pur de (graine, bloc), comme la météo,
 * annoncé trois manches avant à tous les dirigeants, et le moteur ne choisit
 * rien pour personne — il dit ce qui arrive, chacun s'y prépare ou non.
 *
 * - Sécheresse : récoltes à 20 % pendant huit manches ; l'irrigation ou un
 *   grenier la ramènent à 60 %. Des réserves la traversent ; pas l'imprévoyance.
 * - Épidémie : tue jusqu'au quart de la population, selon l'entassement
 *   (population / logement, au carré). Une civilisation au plafond perd le
 *   quart ; une à moitié de son logement, le seizième.
 * - Pillards : une bande de force croissante avec le temps. Assez de soldats,
 *   elle est repoussée ; sinon elle emporte un tiers des réserves.
 * - Incendie : la ville la mieux bâtie perd un bâtiment.
 */
import type { FactionId } from "@abs/contracts";
import type { World } from "./state.js";

export type ShockKind = "drought" | "epidemic" | "raid" | "fire";

export interface RegionalShock {
  id: string;
  kind: ShockKind;
  title: string;
  description: string;
  target: FactionId;
  start: number;
  end: number;
  /** Pillards seulement : les soldats qu'il faut pour les repousser. */
  strength: number;
}

export const SHOCKS = {
  block: 8,
  droughtFood: 0.2,
  droughtRounds: 8,
  epidemicMax: 0.25,
  raidLoss: 1 / 3,
  raidBase: 2,
  raidGrowthRounds: 40,
} as const;

const DESCRIPTIONS: Record<ShockKind, [string, string]> = {
  drought: [
    "Sécheresse régionale",
    "Huit manches de récoltes à 20 %. L'irrigation ou un grenier les ramènent à 60 %.",
  ],
  epidemic: [
    "Épidémie",
    "Tue jusqu'au quart de la population, d'autant plus que les villes sont pleines.",
  ],
  raid: [
    "Pillards",
    "Une bande attaque. Assez de soldats la repoussent ; sinon elle emporte un tiers des réserves.",
  ],
  fire: ["Incendie", "La ville la mieux bâtie perd un bâtiment."],
};

function hash(seed: number, block: number, salt: number): number {
  let n = Math.imul(seed ^ Math.imul(block, 0x9e3779b1) ^ salt, 0x45d9f3b);
  n = (n ^ (n >>> 16)) >>> 0;
  n = Math.imul(n, 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

/** Le choc de la manche `round`, s'il y en a un en cours. `civs` : les vivantes. */
export function shockFor(
  seed: number,
  round: number,
  civs: readonly FactionId[],
): RegionalShock | null {
  const block = Math.floor(round / SHOCKS.block);
  // Le premier bloc laisse aux civilisations le temps de naître.
  if (block < 2 || civs.length === 0) return null;
  const h = hash(seed, block, 0x5f3759df);
  const start = block * SHOCKS.block + (h % 3);
  const kinds: ShockKind[] = ["drought", "epidemic", "raid", "raid", "fire"];
  const kind = kinds[(h >>> 3) % kinds.length]!;
  const end = start + (kind === "drought" ? SHOCKS.droughtRounds - 1 : 0);
  if (round < start || round > end) return null;
  const sorted = [...civs].sort();
  const target = sorted[(h >>> 7) % sorted.length]!;
  const [title, description] = DESCRIPTIONS[kind];
  return {
    id: `${seed}-${block}-${kind}`,
    kind,
    title,
    description,
    target,
    start,
    end,
    strength:
      kind === "raid"
        ? SHOCKS.raidBase + Math.floor(start / SHOCKS.raidGrowthRounds)
        : 0,
  };
}

/** Annoncé à tous, trois manches avant : on s'y prépare, ou non. */
export function shockForecast(
  seed: number,
  round: number,
  civs: readonly FactionId[],
): RegionalShock | null {
  for (let ahead = 1; ahead <= 3; ahead++) {
    const shock = shockFor(seed, round + ahead, civs);
    if (shock && shock.start > round) return shock;
  }
  return null;
}

/** Le multiplicateur de récolte d'une sécheresse, pour la civilisation visée. */
export function droughtMultiplier(world: World, shock: RegionalShock): number {
  const civ = world.civs.find((c) => c.id === shock.target)!;
  const prepared =
    civ.advances.includes("irrigation") ||
    world.simulation!.cities.some(
      (c) => c.owner === civ.id && c.buildings.includes("granary"),
    );
  return prepared ? 0.6 : SHOCKS.droughtFood;
}

export type ShockOutcome = {
  kind: "RAIDED" | "REPELLED" | "DISASTER";
  detail: string;
};

/**
 * Les chocs d'un seul coup, appliqués à la manche où ils commencent et au tour
 * de la civilisation visée — une fois, donc, puisque chacune joue une fois par
 * manche. `capacity` : son logement, calculé par l'appelant.
 */
export function applyShock(
  world: World,
  shock: RegionalShock,
  capacity: number,
): ShockOutcome | null {
  const civ = world.civs.find((c) => c.id === shock.target);
  if (!civ || civ.fellOnTick !== null) return null;
  if (shock.kind === "epidemic") {
    const crowding = Math.min(1, civ.population / Math.max(1, capacity));
    const dead = Math.floor(
      civ.population * SHOCKS.epidemicMax * crowding * crowding,
    );
    civ.population = Math.max(1, civ.population - dead);
    return { kind: "DISASTER", detail: `Épidémie : ${dead} morts` };
  }
  if (shock.kind === "raid") {
    if (civ.soldiers >= shock.strength)
      return {
        kind: "REPELLED",
        detail: `Pillards repoussés (${shock.strength} contre ${civ.soldiers} soldats)`,
      };
    const lost = {
      food: Math.floor(civ.stock.food * SHOCKS.raidLoss),
      timber: Math.floor(civ.stock.timber * SHOCKS.raidLoss),
      ore: Math.floor(civ.stock.ore * SHOCKS.raidLoss),
      wealth: Math.floor(civ.stock.wealth * SHOCKS.raidLoss),
    };
    civ.stock.food -= lost.food;
    civ.stock.timber -= lost.timber;
    civ.stock.ore -= lost.ore;
    civ.stock.wealth -= lost.wealth;
    return {
      kind: "RAIDED",
      detail: `Pillards (${shock.strength} contre ${civ.soldiers} soldats) : ${lost.food} vivres et ${lost.wealth} richesse emportés`,
    };
  }
  if (shock.kind === "fire") {
    const cities = world
      .simulation!.cities.filter((c) => c.owner === civ.id)
      .sort(
        (a, b) =>
          b.buildings.length - a.buildings.length || a.id.localeCompare(b.id),
      );
    const city = cities[0];
    if (!city || city.buildings.length === 0)
      return { kind: "DISASTER", detail: "Incendie, sans bâtiment à détruire" };
    const lost =
      city.buildings[
        hash(world.seed, shock.start, 0x2545f491) % city.buildings.length
      ]!;
    city.buildings = city.buildings.filter((b) => b !== lost);
    return {
      kind: "DISASTER",
      detail: `Incendie à ${city.id} : ${lost} détruit`,
    };
  }
  return null;
}

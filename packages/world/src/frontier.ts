/**
 * Les frontières qui poussent d'elles-mêmes, en spectator-13.
 *
 * Mesuré avant (pourquoi-pas-de-guerre.md) : sept parties de 1 200 actions,
 * trois versions de règles, deux consignes, et le monde finit presque toujours
 * au même point — deux villes, six cases, 387 habitants, aucune frontière
 * commune. Le territoire ne grandissait que par une ville fondée, et les
 * modèles n'en fondent presque pas (un colon en 7 200 conseils, hors la partie
 * où Azur s'est étendue). Les chocs de spectator-12 mordent mais sont absorbés.
 *
 * Le monde continu (w8) laisse une population à l'étroit repousser sa
 * frontière d'une case (`tick.ts`) : c'est un comportement du moteur, pas une
 * décision de dirigeant, et le principe du projet autorise à le corriger ici.
 * Deux règles propres au spectateur :
 *
 * - portée : une case à au plus `radius` d'une ville de la civilisation. Plus
 *   loin, il faut fonder — ou prendre ;
 * - besoin : d'abord le type de terre qu'elle n'a pas du tout. Ambre a passé
 *   une partie entière à 10 de bois, sans forêt, bloquée sur un atelier.
 *
 * La terre libre s'épuise : les frontières finissent par se toucher, et fonder
 * devient une course. Ce qui suit — commerce, pacte ou guerre — reste aux
 * dirigeants.
 */
import type { World } from "./state.js";
import { neighbours } from "./state.js";

export const FRONTIER = {
  /**
   * Distance de Manhattan maximale entre la case prise et une ville. Mesuré sur
   * quatre graines : deux capitales voisines sont à 9 à 11 cases. À 3, les
   * frontières ne se touchaient jamais (dirigeant passif, 1 200 actions) ; à 5,
   * deux voisins se rejoignent au milieu.
   */
  radius: 5,
  /** Vivres consommés par les familles qui partent défricher. */
  foodCost: 60,
  /** La frontière pousse quand la population est à moins de `slack` du logement. */
  slack: 5,
} as const;

const KINDS = ["forest", "hill", "plain", "river"] as const;

function manhattan(size: number, a: number, b: number): number {
  return (
    Math.abs((a % size) - (b % size)) +
    Math.abs(Math.floor(a / size) - Math.floor(b / size))
  );
}

/**
 * La case que la frontière prendrait, ou `null` si aucune n'est à portée.
 * Ordre : un type de terre que la civilisation n'a pas, puis la plus proche
 * d'une de ses villes, puis le plus petit indice — jamais l'ordre du tableau.
 */
export function frontierTarget(world: World, civId: string): number | null {
  const { board, size } = world;
  const cities = world
    .simulation!.cities.filter((c) => c.owner === civId)
    .map((c) => c.position);
  if (cities.length === 0) return null;
  const owned = new Set<string>();
  const edge = new Set<number>();
  board.forEach((tile, i) => {
    if (tile.owner !== civId) return;
    owned.add(tile.kind);
    for (const n of neighbours(size, i))
      if (board[n]!.owner === null) edge.add(n);
  });
  const nearest = (i: number) =>
    Math.min(...cities.map((c) => manhattan(size, c, i)));
  const candidates = [...edge].filter((i) => nearest(i) <= FRONTIER.radius);
  if (candidates.length === 0) return null;
  const missing = new Set(KINDS.filter((k) => !owned.has(k)));
  candidates.sort(
    (a, b) =>
      Number(missing.has(board[b]!.kind)) -
        Number(missing.has(board[a]!.kind)) ||
      nearest(a) - nearest(b) ||
      a - b,
  );
  return candidates[0]!;
}

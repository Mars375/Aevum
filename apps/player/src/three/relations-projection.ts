/**
 * Ce qui lie et ce qui oppose les civilisations, projeté sur la carte.
 *
 * La vue 3D montrait des territoires, des villes et des unités, mais rien des
 * relations : un pacte de douze manches, un commerce, une guerre étaient dans
 * les panneaux et nulle part sur le monde. Or ce sont des décisions des
 * dirigeants, et la carte est ce qu'on regarde.
 *
 * Tout vient de l'état rejoué, rien d'une interprétation :
 *
 *  - un **pacte** en vigueur relie les deux capitales ;
 *  - un **commerce** (relation \`trade\`) les relie aussi, plus discrètement ;
 *  - une **guerre** allume les frontières communes, ou relie les capitales
 *    quand les deux civilisations ne se touchent pas ;
 *  - une **conquête** se lit dans la différence entre deux tours : une case
 *    qui change de maître. Les noms de lieux ne sont pas uniques, et un
 *    événement ne porte pas sa case : la différence, elle, est exacte.
 *
 * Métadonnées seules, sans Three : ce module est sur le chemin immédiat de
 * l'interface.
 */
import type { FactionId } from "@abs/contracts";

export type LinkKind = "pact" | "trade" | "war";

export interface RelationLink {
  a: FactionId;
  b: FactionId;
  kind: LinkKind;
  from: readonly [number, number];
  to: readonly [number, number];
}
export interface FrontSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}
export interface Conquest {
  x: number;
  z: number;
  by: FactionId;
  from: FactionId;
  /** La case était une capitale : un siège, pas un champ. */
  capital: boolean;
}
export interface RelationsProjection {
  links: RelationLink[];
  fronts: FrontSegment[];
  conquests: Conquest[];
}

/** Ce que la projection lit du monde : de quoi l'éprouver sans un monde entier. */
export interface RelationsWorld {
  size: number;
  board: readonly { owner: FactionId | null }[];
  civs: readonly {
    id: FactionId;
    capital: number | null;
    fellOnTick: number | null;
  }[];
  simulation?: {
    relations: readonly { a: FactionId; b: FactionId; status: string }[];
  };
}

const at = (size: number, index: number) =>
  [
    (index % size) - (size - 1) / 2,
    Math.floor(index / size) - (size - 1) / 2,
  ] as const;
const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function projectRelations(
  world: RelationsWorld,
  pacts: readonly { a: FactionId; b: FactionId }[],
  previous?: RelationsWorld | null,
): RelationsProjection {
  const { size } = world;
  const alive = new Map(
    world.civs
      .filter((civ) => civ.fellOnTick === null && civ.capital !== null)
      .map((civ) => [civ.id, civ.capital!]),
  );
  const kinds = new Map<
    string,
    { a: FactionId; b: FactionId; kind: LinkKind }
  >();
  for (const relation of world.simulation?.relations ?? [])
    if (relation.status === "war" || relation.status === "trade")
      kinds.set(pair(relation.a, relation.b), {
        a: relation.a,
        b: relation.b,
        kind: relation.status,
      });
  // Un pacte l'emporte sur le commerce ; jamais sur une guerre, qui le rompt.
  for (const pact of pacts) {
    const key = pair(pact.a, pact.b);
    if (kinds.get(key)?.kind !== "war")
      kinds.set(key, { a: pact.a, b: pact.b, kind: "pact" });
  }

  const fronts: FrontSegment[] = [];
  const warring = new Set(
    [...kinds.values()]
      .filter((l) => l.kind === "war")
      .map((l) => pair(l.a, l.b)),
  );
  const touching = new Set<string>();
  for (let index = 0; index < world.board.length; index++) {
    const owner = world.board[index]!.owner;
    if (!owner) continue;
    const col = index % size;
    const [x, z] = at(size, index);
    // Chaque arête une seule fois : vers l'est et vers le sud.
    for (const [next, east] of [
      [col + 1 < size ? index + 1 : -1, true],
      [index + size < world.board.length ? index + size : -1, false],
    ] as const) {
      if (next < 0) continue;
      const other = world.board[next]!.owner;
      if (!other || other === owner || !warring.has(pair(owner, other)))
        continue;
      touching.add(pair(owner, other));
      fronts.push(
        east
          ? { x1: x + 0.5, z1: z - 0.5, x2: x + 0.5, z2: z + 0.5 }
          : { x1: x - 0.5, z1: z + 0.5, x2: x + 0.5, z2: z + 0.5 },
      );
    }
  }

  const links: RelationLink[] = [];
  for (const link of kinds.values()) {
    const from = alive.get(link.a),
      to = alive.get(link.b);
    if (from === undefined || to === undefined) continue;
    // Une guerre qui a un front se lit sur le front ; l'arc la redoublerait.
    if (link.kind === "war" && touching.has(pair(link.a, link.b))) continue;
    links.push({ ...link, from: at(size, from), to: at(size, to) });
  }

  const conquests: Conquest[] = [];
  if (previous && previous.board.length === world.board.length) {
    const capitals = new Set(
      previous.civs.flatMap((civ) =>
        civ.capital === null ? [] : [civ.capital],
      ),
    );
    world.board.forEach((place, index) => {
      const before = previous.board[index]!.owner;
      if (!before || !place.owner || before === place.owner) return;
      const [x, z] = at(size, index);
      conquests.push({
        x,
        z,
        by: place.owner,
        from: before,
        capital: capitals.has(index),
      });
    });
  }
  links.sort((l, r) => pair(l.a, l.b).localeCompare(pair(r.a, r.b)));
  return { links, fronts, conquests };
}

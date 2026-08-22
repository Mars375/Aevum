import type { Year } from "./chronicle.js";

/**
 * Ce qui, dans la vie d'un monde, mérite une date.
 *
 * Défini une seule fois parce que deux lecteurs s'en servent : la chronique
 * écrite et la frise du lecteur. Deux définitions de « tournant » finiraient
 * par diverger, et la page dirait autre chose que le texte.
 *
 * Détectés, jamais choisis : chacun est la première occurrence d'un fait que le
 * moteur a produit.
 */
export interface Turning {
  tick: number;
  kind: "BOARD_FULL" | "FIRST_WAR" | "CAPITAL" | "EXTINCTION" | "LEAD";
  civ: string | null;
  text: string;
  /** Stable engine evidence when this turning comes from an event. */
  sourceEventId?: string;
}

/** Un meneur n'en est un qu'avec une avance nette : un lieu d'ecart est du bruit. */
export const LEAD_MARGIN = 3;

export function turningPoints(years: Year[]): Turning[] {
  const out: Turning[] = [];
  let boardFull = false;
  let firstWar = false;
  let leader = "";

  for (const y of years) {
    if (!boardFull && y.world.board.length > 0 && y.world.board.every((p) => p.owner !== null)) {
      boardFull = true;
      out.push({
        tick: y.tick,
        kind: "BOARD_FULL",
        civ: null,
        text: "Le dernier lieu libre est pris. À partir d'ici, s'étendre est prendre.",
      });
    }

    for (const e of y.events) {
      if (e.kind === "SEIZED" && !firstWar) {
        firstWar = true;
        out.push({ tick: y.tick, kind: "FIRST_WAR", civ: e.civ, text: `Première conquête du monde : ${e.detail}, par ${e.civ}.`, sourceEventId: e.id });
      }
      if (e.kind === "CAPITAL_LOST") out.push({ tick: y.tick, kind: "CAPITAL", civ: e.civ, text: `${e.civ} perd son siège — ${e.detail}`, sourceEventId: e.id });
      if (e.kind === "COLLAPSED") out.push({ tick: y.tick, kind: "EXTINCTION", civ: e.civ, text: `${e.civ} s'éteint.`, sourceEventId: e.id });
    }

    const [top, second] = [...y.world.civs].sort((a, b) => b.territory - a.territory || a.id.localeCompare(b.id));
    if (top && second && top.territory - second.territory >= LEAD_MARGIN && top.id !== leader) {
      if (leader) out.push({ tick: y.tick, kind: "LEAD", civ: top.id, text: `${top.id} passe devant ${leader} et mène le monde.` });
      leader = top.id;
    }
  }

  return out.sort((a, b) => a.tick - b.tick);
}

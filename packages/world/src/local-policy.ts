import { shares } from "./tick.js";
import type { Civ, World } from "./state.js";
import type { Ruling } from "./journal.js";

/** Reproducible baseline governor for development; never represented as a remote model. */
export function localPolicy(world: World, civ: Civ): Ruling {
  const hungry = civ.stock.food < civ.population * 3;
  const personality = civ.id === "crimson" ? "military" : civ.id === "azure" ? "science" : civ.id === "amber" ? "industry" : "growth";
  const war = world.simulation!.relations.some(r => r.status === "war" && (r.a === civ.id || r.b === civ.id));
  const farming = hungry ? .70 : .52;
  const military = hungry ? .03 : war || personality === "military" ? .20 : .06;
  const claim = civ.lands.plain < Math.max(2,civ.territory*.4) ? "plain" : civ.lands.forest===0 ? "forest" : civ.lands.hill===0 ? "hill" : civ.lands.river===0 ? "river" : "plain";
  const doctrine = {
    ...civ.doctrine, farming,forestry:hungry?.08:.14,mining:hungry?.03:.10,trade:hungry?.16:.18,military,
    claim,
    focus: hungry ? "growth" : personality,
    posture: hungry ? "GUARD" : personality === "military" && civ.stock.food > civ.population*5 ? "PRESSURE" : "TRADE",
  } as const;
  return {tick:world.tick,civ:civ.id,kind:hungry?"FAMINE":"DRIFT",doctrine:{...doctrine,...shares(doctrine)},reason:hungry?"Renforcer les récoltes pour reconstituer trois années de réserves.":`Développer les ${claim} et donner priorité à ${personality}.`,model:"local/deterministic-policy-v1",deferredBy:0,service:null,context:[`${civ.population} habitants`,`${civ.stock.food} vivres`,`${civ.territory} lieux`],consequenceRef:null};
}

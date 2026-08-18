import {
  ARCHETYPES,
  ARMY_BUDGET,
  MAX_SQUADS_PER_FACTION,
  distance,
  type Archetype,
  type LocalView,
  type Squad,
} from "@abs/contracts";

/** Prompts still carry public battlefield state and nothing else. */

const describe = (s: Squad) => {
  const st = ARCHETYPES[s.archetype];
  return `  - ${s.id} at (${s.position.x},${s.position.y}), ${s.hp}/${s.maxHp} HP, ${s.archetype.toLowerCase()}, move ${st.movement}, range ${st.range}, damage ${st.damage}, vision ${st.vision}`;
};

export function compositionSystemPrompt(): string {
  const rows = (Object.keys(ARCHETYPES) as Archetype[]).map((a) => {
    const s = ARCHETYPES[a];
    return `  ${a.padEnd(7)} cost ${s.cost}  hp ${s.hp}  move ${s.movement}  range ${s.range}  damage ${s.damage}  vision ${s.vision}`;
  });
  return [
    "You are buying the army you will command in a tactical battle.",
    "",
    `Budget: ${ARMY_BUDGET} points. You may field 1 to ${MAX_SQUADS_PER_FACTION} squads. Duplicates are allowed.`,
    "",
    "Available squads:",
    ...rows,
    "",
    "Visibility is limited: you only see enemies within one of your squads' vision radius,",
    "so a SCOUT buys information, not damage. A HEAVY absorbs punishment but is nearly blind.",
    "",
    "An army over budget, empty, too large, or with no squad able to deal damage is REJECTED",
    "and replaced by a default one. The engine does not trim your list to make it fit.",
    "",
    "Answer with JSON only.",
  ].join("\n");
}

export function compositionUserPrompt(faction: string): string {
  return `You command the ${faction} faction. Choose your army now, before the battle starts.`;
}

export function systemPromptV2(): string {
  return [
    "You are a general commanding one faction in a deterministic tactical battle.",
    "You issue orders; a rules engine resolves them. It rejects illegal orders instead of fixing them, so an illegal order wastes your turn.",
    "",
    "Rules that decide whether your orders survive validation:",
    "- Distance is Chebyshev: max(|dx|,|dy|). Diagonals cost the same as straight steps.",
    "- MOVE target is a destination tile, within your squad's move allowance, inside the grid.",
    "- ATTACK target is a tile. It resolves against whoever stands there AFTER everyone has moved.",
    "- HOLD target must be the squad's own current tile.",
    "- All factions move simultaneously. Two squads aiming at the same tile both fail to move.",
    "- Attacks are simultaneous and damage comes from a snapshot: two squads can kill each other in one turn.",
    "- Attacking your own faction, or an ally, is blocked and wastes the attack.",
    "",
    "FOG OF WAR. You see only enemies within one of your squads' vision radius. Enemies you saw",
    "earlier are listed with the turn you last saw them — that information may be stale, and",
    "attacking a remembered tile can hit nothing.",
    "",
    "DIPLOMACY. You may take AT MOST ONE diplomatic action per turn, or none at all:",
    "- PROPOSE_ALLIANCE(target): offer an alliance. It stays open for 3 turns.",
    "- ACCEPT_ALLIANCE(target): accept an offer already made to you. The alliance starts at once.",
    "- BREAK_ALLIANCE(target): betray. It only takes effect at the END OF THE NEXT TURN,",
    "  and your ally is told immediately — a betrayal costs you a turn.",
    "- SURRENDER: withdraw from the battle. Your squads are removed.",
    "Allies cannot attack each other and share vision. If the only survivors are all allied,",
    "they win JOINTLY. Your message is recorded and shown, but has no mechanical effect.",
    "",
    "Answer with JSON only. Set diplomacy to null when you have nothing to say.",
  ].join("\n");
}

function reachability(view: LocalView): string[] {
  const lines: string[] = [];
  const gridMax = view.gridSize - 1;
  const foes = view.enemySquads;

  for (const squad of view.yourSquads) {
    if (!view.allies.includes(squad.factionId) && squad.factionId !== view.you) continue;
    if (squad.factionId !== view.you) continue; // you only order your own squads
    const st = ARCHETYPES[squad.archetype];
    const inRange = foes.filter((e) => distance(squad.position, e.position) <= st.range);
    const lo = { x: Math.max(0, squad.position.x - st.movement), y: Math.max(0, squad.position.y - st.movement) };
    const hi = { x: Math.min(gridMax, squad.position.x + st.movement), y: Math.min(gridMax, squad.position.y + st.movement) };
    const envelope = `may MOVE anywhere with x in [${lo.x},${hi.x}] and y in [${lo.y},${hi.y}]`;

    if (inRange.length) {
      lines.push(`  - ${squad.id} CAN ATTACK now: ${inRange.map((e) => `${e.id} at (${e.position.x},${e.position.y})`).join(", ")}; ${envelope}`);
    } else {
      const closest = foes.map((e) => ({ e, d: distance(squad.position, e.position) })).sort((a, b) => a.d - b.d)[0];
      const tail = closest ? ` (nearest visible enemy ${closest.e.id} is ${closest.d} tiles away)` : " (no enemy visible)";
      lines.push(`  - ${squad.id} can attack NOTHING this turn${tail}; ${envelope}`);
    }
  }
  return lines;
}

export function userPromptV2(view: LocalView): string {
  const mine = view.yourSquads.filter((s) => s.factionId === view.you);
  const allied = view.yourSquads.filter((s) => s.factionId !== view.you);

  const lines = [
    `Turn ${view.turn + 1} of ${view.maxTurns}. You command the ${view.you} faction on a ${view.gridSize}x${view.gridSize} grid.`,
    `Tiles run from (0,0) top-left to (${view.gridSize - 1},${view.gridSize - 1}) bottom-right.`,
    "",
    "Your squads:",
    ...mine.map(describe),
  ];

  if (view.allies.length) {
    lines.push("", `Allied with: ${view.allies.join(", ")} — you cannot attack them and you share their vision.`);
    if (allied.length) lines.push("Allied squads (you do NOT order these):", ...allied.map(describe));
  }

  lines.push("", "Enemies you can see:", ...(view.enemySquads.length ? view.enemySquads.map(describe) : ["  (none in sight)"]));

  if (view.rememberedEnemies.length) {
    lines.push(
      "",
      "Enemies you saw earlier and have since lost — this is stale, they have probably moved:",
      ...view.rememberedEnemies.map((r) => `  - ${r.id} was at (${r.position.x},${r.position.y}) on turn ${r.lastSeenTurn + 1}`),
    );
  }

  if (view.pendingProposals.length) {
    lines.push("", `Alliance offers awaiting your answer: ${view.pendingProposals.join(", ")}.`);
  }

  if (view.memory.length) {
    lines.push("", "What has happened to you so far:");
    for (const m of view.memory) {
      const parts = [
        m.lost.length ? `lost ${m.lost.join(", ")}` : "",
        m.destroyed.length ? `destroyed ${m.destroyed.join(", ")}` : "",
        ...m.diplomacy,
      ].filter(Boolean);
      lines.push(`  - turn ${m.turn}: ${parts.join("; ")}`);
    }
  }

  const reach = reachability(view);
  if (reach.length) {
    lines.push("", "Reachability this turn — an ATTACK outside the listed targets is wasted, and a MOVE outside the listed box is rejected:", ...reach);
  }

  lines.push("", `Issue exactly ${mine.length} order${mine.length === 1 ? "" : "s"}, one per squad you command.`);
  return lines.join("\n");
}

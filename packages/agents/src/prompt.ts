import { ARCHETYPES, distance, type LocalView, type Squad } from "@abs/contracts";

/**
 * Prompts carry public battlefield state and nothing else. No key, no path, no
 * environment value ever reaches a remote model.
 */

const describe = (s: Squad) => {
  const stats = ARCHETYPES[s.archetype];
  return `  - ${s.id} at (${s.position.x},${s.position.y}), ${s.hp}/${s.maxHp} HP, ${s.archetype.toLowerCase()}, move ${stats.movement}, range ${stats.range}, damage ${stats.damage}`;
};

export function systemPrompt(): string {
  return [
    "You are a general commanding one faction in a deterministic tactical battle.",
    "You issue orders; a rules engine resolves them. The engine rejects illegal orders instead of fixing them, so an illegal order wastes your turn.",
    "",
    "Rules that decide whether your orders survive validation:",
    "- Distance is Chebyshev: max(|dx|,|dy|). Diagonals cost the same as straight steps.",
    "- MOVE target is a destination tile, within your squad's move allowance, inside the grid.",
    "- ATTACK target is a tile. It resolves against whoever stands there AFTER everyone has moved, so a target that walks away is missed.",
    "- HOLD target must be the squad's own current tile.",
    "- All factions move simultaneously. Two squads aiming at the same tile both fail to move; neither gets priority.",
    "- Attacks are simultaneous too, and damage is read from a snapshot: two squads can kill each other in the same turn.",
    "- Friendly fire is blocked and simply wastes the attack.",
    "",
    "Answer with JSON only, matching the provided schema: exactly one order per squad you command.",
  ].join("\n");
}

/** Appended for models with no server-side schema enforcement. */
export function jsonModeInstruction(): string {
  return [
    "OUTPUT FORMAT — this is strict:",
    'Reply with a single JSON object and nothing else. No prose, no markdown fence, no explanation around it.',
    'Shape: {"reasoning": "<one or two sentences>", "orders": [{"squadId": "<id>", "action": "MOVE"|"ATTACK"|"HOLD", "target": {"x": <integer>, "y": <integer>}}]}',
    "Every squadId must be one you command. x and y must be integers, never decimals or strings.",
  ].join("\n");
}

/**
 * Per-squad reachability, spelled out.
 *
 * The reference battle produced 18 out-of-range attacks against 11 hits — the
 * orders were legal, they just wasted the turn. Range appeared once in the
 * system prompt as a general rule and was never restated for the squad giving
 * the order. Enumerating what each squad can actually hit turns a rule the
 * model has to apply into a fact it only has to read (QA defect D2).
 */
function reachability(view: LocalView): string[] {
  const lines: string[] = [];
  const gridMax = view.gridSize - 1;
  for (const squad of view.yourSquads) {
    const stats = ARCHETYPES[squad.archetype];
    const inRange = view.enemySquads.filter((e) => distance(squad.position, e.position) <= stats.range);
    const closest = view.enemySquads
      .map((e) => ({ e, d: distance(squad.position, e.position) }))
      .sort((a, b) => a.d - b.d)[0];

    // The legal move envelope, stated as a box rather than as an allowance the
    // model has to apply. Listing attackable targets removed every out-of-range
    // attack; movement kept producing MOVE_TOO_FAR for the same reason.
    const lo = { x: Math.max(0, squad.position.x - stats.movement), y: Math.max(0, squad.position.y - stats.movement) };
    const hi = {
      x: Math.min(gridMax, squad.position.x + stats.movement),
      y: Math.min(gridMax, squad.position.y + stats.movement),
    };
    const envelope = `may MOVE anywhere with x in [${lo.x},${hi.x}] and y in [${lo.y},${hi.y}]`;

    if (inRange.length) {
      const targets = inRange.map((e) => `${e.id} at (${e.position.x},${e.position.y})`).join(", ");
      lines.push(`  - ${squad.id} CAN ATTACK now: ${targets}; ${envelope}`);
    } else if (closest) {
      lines.push(
        `  - ${squad.id} can attack NOTHING this turn (range ${stats.range}; nearest enemy ${closest.e.id} is ${closest.d} tiles away); ${envelope}`,
      );
    } else {
      lines.push(`  - ${squad.id} ${envelope}`);
    }
  }
  return lines;
}

export function userPrompt(view: LocalView): string {
  const reach = reachability(view);
  const lines = [
    `Turn ${view.turn + 1} of ${view.maxTurns}. You command the ${view.you} faction on a ${view.gridSize}x${view.gridSize} grid.`,
    `Tiles run from (0,0) top-left to (${view.gridSize - 1},${view.gridSize - 1}) bottom-right.`,
    "",
    "Your squads:",
    ...view.yourSquads.map(describe),
    "",
    "Enemy squads:",
    ...(view.enemySquads.length ? view.enemySquads.map(describe) : ["  (none visible)"]),
  ];

  if (reach.length) {
    lines.push("", "Reachability this turn — an ATTACK outside the listed targets is wasted, and a MOVE outside the listed box is rejected:", ...reach);
  }

  lines.push(
    "",
    `Issue exactly ${view.yourSquads.length} order${view.yourSquads.length === 1 ? "" : "s"}, one per squad listed above.`,
  );
  return lines.join("\n");
}

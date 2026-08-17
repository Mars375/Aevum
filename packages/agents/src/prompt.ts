import { ARCHETYPES, type LocalView, type Squad } from "@abs/contracts";

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

export function userPrompt(view: LocalView): string {
  const lines = [
    `Turn ${view.turn + 1} of ${view.maxTurns}. You command the ${view.you} faction on a ${view.gridSize}x${view.gridSize} grid.`,
    `Tiles run from (0,0) top-left to (${view.gridSize - 1},${view.gridSize - 1}) bottom-right.`,
    "",
    "Your squads:",
    ...view.yourSquads.map(describe),
    "",
    "Enemy squads:",
    ...(view.enemySquads.length ? view.enemySquads.map(describe) : ["  (none visible)"]),
    "",
    `Issue exactly ${view.yourSquads.length} order${view.yourSquads.length === 1 ? "" : "s"}, one per squad listed above.`,
  ];
  return lines.join("\n");
}

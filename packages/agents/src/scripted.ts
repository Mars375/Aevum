import type { Decision, GeneralConfig, LocalView, Vec2 } from "@abs/contracts";
import type { OrderProvider, ProviderResult } from "./openrouter.js";

/**
 * Deterministic stand-in for tests and offline demos. Touches no network, so
 * the whole battle loop can be exercised in CI without a key or a quota.
 */
export class ScriptedProvider implements OrderProvider {
  constructor(private readonly script: (view: LocalView, general: GeneralConfig) => Decision | null) {}

  async decide(view: LocalView, general: GeneralConfig): Promise<ProviderResult> {
    const decision = this.script(view, general);
    return {
      decision,
      telemetry: {
        factionId: general.factionId,
        requestedModel: general.model,
        servedModel: decision ? "scripted" : null,
        fellBack: false,
        attempts: 1,
        latencyMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        error: decision ? null : "scripted refusal",
      },
    };
  }
}

const cheb = (a: Vec2, b: Vec2) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * Walks each squad toward the closest enemy, attacking once in range.
 *
 * Destinations are reserved as they are assigned. Without that, both squads of
 * a faction routinely pick the same tile — they start adjacent and chase the
 * same enemy — and the contested-tile rule then blocks both of them, every
 * turn, forever. The engine is right to block them; a baseline that walks into
 * that deadlock is simply a bad baseline.
 */
export function chargeNearest(view: LocalView, _general: GeneralConfig): Decision {
  const claimed = new Set<string>();
  const key = (p: Vec2) => `${p.x},${p.y}`;
  const occupied = new Set([...view.yourSquads, ...view.enemySquads].map((s) => key(s.position)));

  const orders = view.yourSquads.map((squad) => {
    const hold = { squadId: squad.id, action: "HOLD" as const, target: { ...squad.position } };

    const target = view.enemySquads.slice().sort((a, b) => cheb(a.position, squad.position) - cheb(b.position, squad.position))[0];
    if (!target) return hold;

    const range = squad.archetype === "MELEE" ? 1 : 4;
    if (cheb(target.position, squad.position) <= range) {
      return { squadId: squad.id, action: "ATTACK" as const, target: { ...target.position } };
    }

    const step = squad.archetype === "MELEE" ? 2 : 1;
    const clamp = (d: number) => Math.max(-step, Math.min(step, d));
    const ideal = {
      x: squad.position.x + clamp(target.position.x - squad.position.x),
      y: squad.position.y + clamp(target.position.y - squad.position.y),
    };

    // Try the straight line first, then nearby tiles that still close distance.
    const candidates = [ideal, { x: ideal.x, y: squad.position.y }, { x: squad.position.x, y: ideal.y }];
    for (const candidate of candidates) {
      const k = key(candidate);
      if (claimed.has(k)) continue;
      if (k !== key(squad.position) && occupied.has(k)) continue;
      if (candidate.x < 0 || candidate.y < 0 || candidate.x >= view.gridSize || candidate.y >= view.gridSize) continue;
      if (cheb(candidate, squad.position) > step) continue;
      claimed.add(k);
      return { squadId: squad.id, action: "MOVE" as const, target: candidate };
    }

    claimed.add(key(squad.position));
    return hold;
  });

  return { reasoning: "Scripted baseline: close on the nearest enemy, strike once in range.", orders };
}

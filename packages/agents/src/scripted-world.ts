import type { GeneralConfig } from "@abs/contracts";
import type { RulerProvider } from "./rule.js";

export interface ScriptedRuling {
  reasoning: string;
  creed: string;
  posture: "TRADE" | "GUARD" | "PRESSURE";
  claim: "plain" | "forest" | "hill" | "river";
  vowMetric: "food" | "soldiers" | "territory" | "population" | "none";
  vowFloor: number;
  farming: number;
  forestry: number;
  mining: number;
  trade: number;
  military: number;
}

export interface ScriptedDecision {
  tick: number;
}

/** Deterministic local rulings for fixtures and reproducible campaigns. */
export class ScriptedRulerProvider implements RulerProvider {
  constructor(
    private readonly decide: (general: GeneralConfig, point: ScriptedDecision, prompt: string) => ScriptedRuling,
  ) {}

  async ask(general: GeneralConfig, _system: string, prompt: string): Promise<string> {
    const tick = Number(/^Year (\d+)\./m.exec(prompt)?.[1]);
    if (!Number.isInteger(tick)) throw new Error("scripted world prompt has no year");
    return JSON.stringify(this.decide(general, { tick }, prompt));
  }

  lastModel(): string {
    return "scripted/no-remote-model";
  }
}

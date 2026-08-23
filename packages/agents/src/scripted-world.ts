import { z } from "zod";
import type { GeneralConfig } from "@abs/contracts";
import { FixtureDigestSchema, type ExecutionProvenance } from "@abs/world";
import type { ProvenancedRulerProvider } from "./rule.js";

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

const ScriptedRulingSchema = z.object({
  reasoning: z.string(),
  creed: z.string(),
  posture: z.enum(["TRADE", "GUARD", "PRESSURE"]),
  claim: z.enum(["plain", "forest", "hill", "river"]),
  vowMetric: z.enum(["food", "soldiers", "territory", "population", "none"]),
  vowFloor: z.number().min(0),
  farming: z.number().min(0),
  forestry: z.number().min(0),
  mining: z.number().min(0),
  trade: z.number().min(0),
  military: z.number().min(0),
});

export const ScriptedCampaignSchema = z.object({
  seed: z.number().int().min(0),
  ticks: z.number().int().min(0),
  transitionTick: z.number().int().min(0),
  survivor: z.enum(["crimson", "azure", "verdant", "amber"]),
  beforeTransition: ScriptedRulingSchema,
  survivorDoctrine: ScriptedRulingSchema,
  afterTransition: ScriptedRulingSchema,
});
export type ScriptedCampaign = z.infer<typeof ScriptedCampaignSchema>;

/** Deterministic local rulings for fixtures and reproducible campaigns. */
export class ScriptedRulerProvider implements ProvenancedRulerProvider {
  readonly execution: ExecutionProvenance;

  constructor(
    private readonly decide: (general: GeneralConfig, point: ScriptedDecision, prompt: string) => ScriptedRuling,
    fixtureDigest: string,
  ) {
    this.execution = {
      mode: "SCRIPTED_NO_REMOTE_MODEL",
      fixtureDigest: FixtureDigestSchema.parse(fixtureDigest),
    };
  }

  async ask(general: GeneralConfig, _system: string, prompt: string): Promise<string> {
    const tick = Number(/^Year (\d+)\./m.exec(prompt)?.[1]);
    if (!Number.isInteger(tick)) throw new Error("scripted world prompt has no year");
    return JSON.stringify(this.decide(general, { tick }, prompt));
  }

  lastModel(): string {
    return "scripted/no-remote-model";
  }
}

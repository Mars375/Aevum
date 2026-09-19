import {
  ModernizationSchema,
  ModernizationProjectSchema,
  MODERNIZATION,
  startModernization,
  modernizationIssue,
  modernizationProduction,
} from "./modernization.js";
import {
  CivilizationAgeSchema,
  AgeTransitionSchema,
  ageProgress,
  ageAllows,
  BUILDING_AGE,
  TECHNOLOGY_AGE,
} from "./ages.js";
import { militaryProfile } from "./military.js";
import { z } from "zod";
import { CityLedgerSchema, deriveCityEconomy } from "./city-economy.js";
import { FactionIdSchema } from "@abs/contracts";
import { census, neighbours, WorldSchema, type World } from "./state.js";
import { newCivilizationWorld, cleanup } from "./civilization.js";
import { BuildingSchema, FocusSchema } from "./civilization-state.js";
import {
  CommandBatchSchema,
  UnitCommandSchema,
  resolveCommands,
  type Mission,
} from "./commands.js";
import {
  develop,
  BUILDING_RULES,
  TECHNOLOGIES,
  affordable,
  pay,
  round,
} from "./development.js";
import { initializeUnits, unitPath } from "./units.js";
import type { TickEvent } from "./events.js";
import {
  StrategicPlanSchema,
  TrackedPlanSchema,
  planIssue,
  startPlan,
  advancePlan,
} from "./strategic-plans.js";
export {
  StrategicPlanSchema,
  TrackedPlanSchema,
  type StrategicPlan,
  type TrackedPlan,
} from "./strategic-plans.js";
export { MOVEMENT_BUDGET, movementCost } from "./commands.js";

export const CouncilDecisionSchema = CommandBatchSchema.extend({
  modernization: ModernizationProjectSchema.nullable().optional(),
  objective: z.string().max(1000),
  focus: FocusSchema,
  research: z
    .enum([
      "irrigation",
      "masonry",
      "metallurgy",
      "coinage",
      "engineering",
      "scholarship",
    ])
    .nullable(),
  construction: z
    .array(
      z
        .object({ city: z.string().max(120), building: BuildingSchema })
        .strict(),
    )
    .max(16),
  diplomacy: z
    .array(
      z
        .object({
          target: FactionIdSchema,
          proposal: z.enum(["peace", "trade", "war"]),
        })
        .strict(),
    )
    .max(3),
  recruitSettler: z.boolean(),
  plan: StrategicPlanSchema.nullable().optional(),
}).strict();
export type CouncilDecision = z.infer<typeof CouncilDecisionSchema>;
const MissionSchema = UnitCommandSchema.extend({
  civ: FactionIdSchema,
  issuedAt: z.number().int().nonnegative(),
  status: z.enum(["active", "completed", "blocked", "interrupted"]),
  route: z.array(z.number().int().nonnegative()),
  detail: z.string(),
});
export const SpectatorStateSchema = z
  .object({
    rules: z.enum([
      "spectator-1",
      "spectator-2",
      "spectator-3",
      "spectator-4",
      "spectator-5",
      "spectator-6",
      "spectator-7",

      "spectator-8",
    ]),
    modernization: z.record(ModernizationSchema).optional(),
    ages: z.record(CivilizationAgeSchema).optional(),
    ageTransitions: z.array(AgeTransitionSchema).optional(),
    sequence: z
      .object({ activeCiv: FactionIdSchema, round: z.number().int().min(1) })
      .optional(),
    diplomacyOffers: z
      .array(
        z.object({
          from: FactionIdSchema,
          to: FactionIdSchema,
          proposal: z.enum(["peace", "trade"]),
          round: z.number().int().min(1),
        }),
      )
      .max(12)
      .optional(),
    movement: z
      .array(
        z.object({
          unit: z.string(),
          budget: z.number().nonnegative(),
          spent: z.number().nonnegative(),
          remaining: z.number().nonnegative(),
          path: z.array(z.number().int().nonnegative()),
          attackReady: z.boolean(),
        }),
      )
      .optional(),
    plans: z.record(TrackedPlanSchema).optional(),
    world: WorldSchema,
    economy: z.array(CityLedgerSchema).optional(),
    caravans: z.record(z.string()).optional(),
    missions: z.array(MissionSchema).max(4096),
    objectives: z.record(z.string()),
    research: z.record(z.string().nullable()),
    memory: z.record(z.array(z.string().max(1200)).max(12)).default({}),
  })
  .refine(
    (s) => s.world.worldVersion === "w10" && !!s.world.simulation,
    "Spectator state requires the civilization data format",
  )
  .refine(
    (s) =>
      !["spectator-5", "spectator-6", "spectator-7", "spectator-8"].includes(s.rules) ||
      (!!s.sequence && s.world.civs.every((c) => !!s.ages?.[c.id])),
    "Age rules require a sequence and an age for every civilization",
  )
  .refine(
    (s) =>
      !["spectator-6", "spectator-7", "spectator-8"].includes(s.rules) ||
      s.world.civs.every((c) => !!s.modernization?.[c.id]),
    "Modern rules require a modernization state for every civilization",
  );
export type SpectatorState = z.infer<typeof SpectatorStateSchema>;
export function activeCiv(state: SpectatorState) {
  return ["spectator-4", "spectator-5", "spectator-6", "spectator-7", "spectator-8"].includes(state.rules)
    ? (state.sequence?.activeCiv ??
        state.world.civs
          .filter((c) => c.fellOnTick === null && c.population > 0)
          .sort((a, b) => a.id.localeCompare(b.id))[0]?.id ??
        null)
    : null;
}
export interface WorldIncident {
  id: string;
  title: string;
  description: string;
  start: number;
  end: number;
  foodMultiplier: number;
}

/** One shared bulletin, known before orders. No wall clock or hidden RNG. */
export function incidentFor(seed: number, turn: number): WorldIncident | null {
  const block = Math.floor(turn / 12);
  if (block < 1) return null;
  let n = Math.imul(seed ^ block, 0x45d9f3b);
  n = (n ^ (n >>> 16)) >>> 0;
  const start = block * 12 + (n % 4);
  if (turn < start || turn >= start + 3) return null;
  const choices = [
    {
      title: "Sécheresse",
      description: "Les récoltes diminuent. L'irrigation atténue la pénurie.",
      foodMultiplier: 0.65,
    },
    {
      title: "Récolte exceptionnelle",
      description: "Trois tours d'abondance pour constituer des réserves.",
      foodMultiplier: 1.35,
    },
    {
      title: "Hiver rigoureux",
      description:
        "Les récoltes diminuent. Les greniers protègent une partie de la production.",
      foodMultiplier: 0.75,
    },
  ];
  return {
    id: `${seed}-${block}`,
    ...choices[(n >>> 4) % choices.length]!,
    start,
    end: start + 2,
  };
}
/** Public forecast, shared by every ruler in a round, including block boundaries. */
export function forecastFor(seed: number, turn: number): WorldIncident | null {
  for (let ahead = 1; ahead <= 3; ahead++) {
    const event = incidentFor(seed, turn + ahead);
    if (event && event.start > turn) return event;
  }
  return null;
}
export function newSpectator(
  seed = 42,
  rules: SpectatorState["rules"] = "spectator-1",
): SpectatorState {
  const world = newCivilizationWorld(
    ["amber", "azure", "crimson", "verdant"],
    seed,
  );
  for (const civ of world.civs) {
    world.simulation!.units.push({
      id: `${civ.id}-${world.simulation!.nextUnit++}`,
      owner: civ.id,
      role: "settler",
      position: civ.capital!,
      previous: civ.capital!,
      target: null,
      strength: 1,
      cooldown: 0,
      task: "idle",
    });
  }
  return {
    ...(["spectator-5", "spectator-6", "spectator-7", "spectator-8"].includes(rules)
      ? {
          ages: Object.fromEntries(
            world.civs.map((c) => [
              c.id,
              {
                current: "bronze" as const,
                enteredAt: 0,
                history: [{ age: "bronze" as const, turn: 0 }],
              },
            ]),
          ),
          ageTransitions: [],
        }
      : {}),
    ...(["spectator-6", "spectator-7", "spectator-8"].includes(rules)
      ? {
          modernization: Object.fromEntries(
            world.civs.map((c) => [c.id, { completed: [], active: null }]),
          ),
        }
      : {}),
    rules,
    world,
    ...(["spectator-3", "spectator-4", "spectator-5", "spectator-6", "spectator-7", "spectator-8"].includes(
      rules,
    )
      ? { plans: {} }
      : {}),
    ...(["spectator-4", "spectator-5", "spectator-6", "spectator-7", "spectator-8"].includes(rules)
      ? {
          sequence: { activeCiv: world.civs[0]!.id, round: 1 },
          diplomacyOffers: [],
          movement: [],
        }
      : {}),
    ...(rules !== "spectator-1"
      ? {
          economy: [],
          caravans: Object.fromEntries(
            world
              .simulation!.units.filter((u) => u.role === "merchant")
              .flatMap((u) => {
                const city = world.simulation!.cities.find(
                  (c) => c.owner === u.owner && c.position === u.position,
                );
                return city ? [[u.id, city.id]] : [];
              }),
          ),
        }
      : {}),
    missions: [],
    objectives: {},
    research: {},
    memory: {},
  };
}
const distance = (w: World, a: number, b: number) =>
  Math.abs((a % w.size) - (b % w.size)) +
  Math.abs(Math.floor(a / w.size) - Math.floor(b / w.size));

/** New ruleset: never dispatches through the archived w10 tick. */
export function resolveCouncil(
  input: SpectatorState,
  submissions: readonly unknown[],
) {
  const state = SpectatorStateSchema.parse(input);
  let world = state.world;
  const actor = activeCiv(state);
  const sequential = ["spectator-4", "spectator-5", "spectator-6", "spectator-7", "spectator-8"].includes(
    state.rules,
  );
  const roundNumber = state.sequence?.round ?? 1;
  if (
    sequential &&
    (!actor ||
      (submissions.length > 0 &&
        (submissions.length !== 1 ||
          !CouncilDecisionSchema.safeParse(submissions[0]).success ||
          CouncilDecisionSchema.parse(submissions[0]).civ !== actor ||
          CouncilDecisionSchema.parse(submissions[0]).turn !== world.tick)))
  ) {
    return {
      state,
      events: [] as TickEvent[],
      rejected: [
        {
          civ: actor ?? "unknown",
          unit: null as string | null,
          detail: "Seul le dirigeant actif peut jouer ce tour.",
        },
      ],
      incident: incidentFor(world.seed, roundNumber - 1),
    };
  }
  const rejected: { civ: string; unit: string | null; detail: string }[] = [];
  const valid: CouncilDecision[] = [];
  const parsed = submissions.map((s) => CouncilDecisionSchema.safeParse(s));
  const candidates = parsed.flatMap((p) => (p.success ? [p.data] : []));
  for (const p of parsed)
    if (!p.success)
      rejected.push({
        civ: "unknown",
        unit: null,
        detail: "Décision invalide",
      });
  for (const d of candidates.sort((a, b) => a.civ.localeCompare(b.civ))) {
    if (
      d.turn !== world.tick ||
      !world.civs.some((c) => c.id === d.civ && c.fellOnTick === null) ||
      candidates.filter((c) => c.civ === d.civ).length !== 1
    ) {
      rejected.push({
        civ: d.civ,
        unit: null,
        detail: "Tour périmé, dirigeant absent ou décision en double",
      });
      continue;
    }
    valid.push(d);
  }
  const events: TickEvent[] = [];
  const say = (
    civ: CouncilDecision["civ"],
    kind: TickEvent["kind"],
    detail: string,
  ) => events.push({ tick: world.tick + 1, civ, kind, detail });
  for (const d of valid) {
    const civ = world.civs.find((c) => c.id === d.civ)!;
    if (
      ["spectator-3", "spectator-4", "spectator-5", "spectator-6", "spectator-7", "spectator-8"].includes(
        state.rules,
      ) &&
      d.plan !== undefined
    ) {
      state.plans ??= {};
      if (d.plan === null) {
        const previous = state.plans[civ.id];
        if (previous)
          state.plans[civ.id] = {
            ...previous,
            status: "cancelled",
            updatedAt: world.tick,
            detail: "Plan annulé explicitement par le dirigeant.",
          };
      } else {
        const issue = planIssue(world, civ.id, d.plan);
        if (issue) rejected.push({ civ: civ.id, unit: null, detail: issue });
        else {
          const previous = state.plans[civ.id];
          const same =
            previous &&
            previous.kind === d.plan.kind &&
            previous.targetTile === d.plan.targetTile &&
            previous.targetCity === d.plan.targetCity &&
            previous.targetTech === d.plan.targetTech &&
            previous.targetBuilding === d.plan.targetBuilding;
          if (!same || previous.status === "cancelled")
            state.plans[civ.id] = startPlan(d.plan, world.tick);
        }
      }
    }
    if (["spectator-6", "spectator-7", "spectator-8"].includes(state.rules) && d.modernization) {
      const issue = startModernization(
        world,
        civ.id,
        state.ages![civ.id]!.current,
        state.modernization![civ.id]!,
        d.modernization,
      );
      if (issue) rejected.push({ civ: civ.id, unit: null, detail: issue });
      else
        say(
          civ.id,
          "BUILT",
          `Programme lance : ${MODERNIZATION[d.modernization].name}`,
        );
    }
    state.objectives[civ.id] = d.objective;
    if (
      ["spectator-5", "spectator-6", "spectator-7", "spectator-8"].includes(state.rules) &&
      d.research &&
      !ageAllows(
        state.ages?.[civ.id]?.current ?? "bronze",
        TECHNOLOGY_AGE[d.research]!,
      )
    ) {
      rejected.push({
        civ: civ.id,
        unit: null,
        detail: `Research locked by age: ${d.research}`,
      });
    } else state.research[civ.id] = d.research;
    civ.doctrine.focus = d.focus;
    // Policy changes remain bounded; tactical orders are handled independently.
    const allocations =
      d.focus === "military"
        ? [0.52, 0.12, 0.14, 0.06, 0.16]
        : d.focus === "industry"
          ? [0.55, 0.18, 0.12, 0.11, 0.04]
          : [0.62, 0.12, 0.08, 0.14, 0.04];
    [
      civ.doctrine.farming,
      civ.doctrine.forestry,
      civ.doctrine.mining,
      civ.doctrine.trade,
      civ.doctrine.military,
    ] = allocations as [number, number, number, number, number];
    for (const build of d.construction) {
      const city = world.simulation!.cities.find(
        (c) => c.id === build.city && c.owner === civ.id,
      );
      const { years, ...cost } = BUILDING_RULES[build.building];
      if (
        (["spectator-5", "spectator-6", "spectator-7", "spectator-8"].includes(state.rules) &&
          !ageAllows(
            state.ages?.[civ.id]?.current ?? "bronze",
            BUILDING_AGE[build.building],
          )) ||
        !city ||
        city.queue ||
        city.buildings.includes(build.building) ||
        !affordable(civ.stock, cost)
      ) {
        rejected.push({
          civ: civ.id,
          unit: null,
          detail: `Construction refusée : ${build.city} / ${build.building}`,
        });
        continue;
      }
      pay(civ.stock, cost);
      city.queue = { building: build.building, remaining: years };
      say(civ.id, "BUILT", `Chantier lancé : ${build.building}`);
    }
    if (d.recruitSettler) {
      const cost = { food: 50, timber: 60, wealth: 20 };
      if (
        civ.capital !== null &&
        affordable(civ.stock, cost) &&
        world.simulation!.units.filter(
          (u) => u.owner === civ.id && u.role === "settler",
        ).length < 2
      ) {
        pay(civ.stock, cost);
        world.simulation!.units.push({
          id: `${civ.id}-${world.simulation!.nextUnit++}`,
          owner: civ.id,
          role: "settler",
          position: civ.capital,
          previous: civ.capital,
          target: null,
          strength: 1,
          cooldown: 0,
          task: "idle",
        });
      } else
        rejected.push({
          civ: civ.id,
          unit: null,
          detail:
            "Recrutement du colon refusé : réserves insuffisantes ou limite atteinte",
        });
    }
  }
  if (sequential) {
    state.diplomacyOffers = (state.diplomacyOffers ?? []).filter(
      (o) => roundNumber - o.round < 8,
    );
    for (const proposal of valid[0]?.diplomacy ?? []) {
      const r = world.simulation!.relations.find(
        (r) =>
          [r.a, r.b].includes(actor!) && [r.a, r.b].includes(proposal.target),
      );
      if (!r || proposal.target === actor) continue;
      state.diplomacyOffers = state.diplomacyOffers.filter(
        (o) => !(o.from === actor && o.to === proposal.target),
      );
      if (proposal.proposal === "war") {
        if (roundNumber >= r.truceUntil) {
          r.status = "war";
          r.since = world.tick;
          say(actor!, "WAR", `Guerre avec ${proposal.target}`);
          state.diplomacyOffers = state.diplomacyOffers.filter(
            (o) => !(o.from === proposal.target && o.to === actor),
          );
        }
      } else {
        const matching = state.diplomacyOffers.some(
          (o) =>
            o.from === proposal.target &&
            o.to === actor &&
            o.proposal === proposal.proposal,
        );
        if (matching && (proposal.proposal === "peace" || r.status !== "war")) {
          if (r.status === "war") r.truceUntil = roundNumber + 8;
          r.status = proposal.proposal;
          r.since = world.tick;
          state.diplomacyOffers = state.diplomacyOffers.filter(
            (o) => !(o.from === proposal.target && o.to === actor),
          );
          say(
            actor!,
            "PEACE",
            `Accord de ${proposal.proposal} avec ${proposal.target}`,
          );
        } else
          state.diplomacyOffers.push({
            from: actor!,
            to: proposal.target,
            proposal: proposal.proposal,
            round: roundNumber,
          });
      }
    }
  }
  for (const r of world.simulation!.relations) {
    if (sequential) {
      if (r.status === "trade" && [r.a, r.b].includes(actor!)) {
        const civ = world.civs.find((c) => c.id === actor)!;
        civ.stock.wealth = round(
          civ.stock.wealth + Math.min(15, civ.population * 0.025),
        );
      }
      continue;
    }
    const proposal = (a: string, b: string) =>
      valid.find((d) => d.civ === a)?.diplomacy.find((p) => p.target === b)
        ?.proposal;
    const a = proposal(r.a, r.b),
      b = proposal(r.b, r.a);
    if ((a === "war" || b === "war") && world.tick >= r.truceUntil) {
      if (r.status !== "war") say(r.a, "WAR", `Guerre avec ${r.b}`);
      r.status = "war";
    } else if (a === "peace" && b === "peace") {
      if (r.status === "war") {
        r.truceUntil = world.tick + 8;
        say(r.a, "PEACE", `Trêve avec ${r.b}`);
      }
      r.status = "peace";
    } else if (a === "trade" && b === "trade" && r.status !== "war")
      r.status = "trade";
    if (
      r.status !==
      input.world.simulation!.relations.find(
        (old) => old.a === r.a && old.b === r.b,
      )?.status
    )
      r.since = world.tick;
    if (r.status === "trade")
      for (const id of [r.a, r.b]) {
        const civ = world.civs.find((c) => c.id === id)!;
        if (civ.fellOnTick === null)
          civ.stock.wealth = round(
            civ.stock.wealth + Math.min(15, civ.population * 0.025),
          );
      }
  }
  const moved = resolveCommands(
    world,
    state.missions,
    valid.map(({ civ, turn, orders }) => ({ civ, turn, orders })),
    actor ?? undefined,
  );
  world = moved.world;
  state.missions = moved.missions;
  if (sequential) state.movement = moved.movement;
  rejected.push(...moved.rejected);
  // Combat damage is accumulated from one snapshot and applied simultaneously.
  const losses = new Map<string, number>();
  const assaults = new Map<number, Mission[]>();
  for (const m of state.missions) {
    const u = world.simulation!.units.find((u) => u.id === m.unit);
    const before = input.world.simulation!.units.find(
      (old) => old.id === m.unit,
    );
    if (
      m.action !== "attack" ||
      (sequential &&
        (m.civ !== actor ||
          !moved.movement.some(
            (trace) => trace.unit === m.unit && trace.attackReady,
          ))) ||
      !u ||
      !before ||
      before.cooldown > 0 ||
      (!sequential && distance(world, before.position, m.target) !== 1) ||
      m.status === "interrupted" ||
      m.status === "completed" ||
      distance(world, u.position, m.target) !== 1
    )
      continue;
    const owner = world.board[m.target]!.owner;
    if (
      !owner ||
      owner === u.owner ||
      !world.simulation!.relations.some(
        (r) =>
          r.status === "war" &&
          [r.a, r.b].includes(owner) &&
          [r.a, r.b].includes(u.owner),
      )
    )
      continue;
    assaults.set(m.target, [...(assaults.get(m.target) ?? []), m]);
  }
  for (const [target, missions] of assaults) {
    const owner = world.board[target]!.owner!;
    const defenders = world.simulation!.units.filter(
      (u) => u.owner === owner && u.role === "soldier" && u.position === target,
    );
    const city = world.simulation!.cities.find((c) => c.position === target);
    const ownerCiv = world.civs.find((c) => c.id === owner)!;
    const defenceProfile =
      ["spectator-7", "spectator-8"].includes(state.rules)
        ? militaryProfile(
            state.ages![owner]!.current,
            ownerCiv.advances,
            state.modernization![owner]!.completed,
          )
        : null;
    const structural =
      (city ? 3 : 1) *
      (city?.buildings.includes("walls") ? 1.5 : 1) *
      (world.board[target]!.kind === "hill" ? 1.2 : 1);
    const defence =
      (defenceProfile ? structural * defenceProfile.resilience : structural) +
      defenders.reduce((n, u) => n + u.strength, 0);
    for (const m of missions) {
      const attacker = world.simulation!.units.find((u) => u.id === m.unit)!;
      losses.set(
        attacker.id,
        (losses.get(attacker.id) ?? 0) +
          Math.ceil((defence * 0.3) / missions.length),
      );
      const attackerCiv = world.civs.find((c) => c.id === attacker.owner)!;
      const attackProfile =
        ["spectator-7", "spectator-8"].includes(state.rules)
          ? militaryProfile(
              state.ages![attacker.owner]!.current,
              attackerCiv.advances,
              state.modernization![attacker.owner]!.completed,
            )
          : null;
      const power =
        attacker.strength *
        (attackProfile
          ? attackProfile.power
          : attackerCiv.advances.includes("metallurgy")
            ? 1.2
            : 1);
      for (const defender of defenders)
        losses.set(
          defender.id,
          (losses.get(defender.id) ?? 0) +
            Math.ceil((power * 0.35) / Math.max(1, defenders.length)),
        );
      say(attacker.owner, "ROUTED", `Combat pour ${world.board[target]!.name}`);
    }
  }
  for (const unit of world.simulation!.units) {
    const lost = Math.min(unit.strength, losses.get(unit.id) ?? 0);
    unit.strength -= lost;
    const civ = world.civs.find((c) => c.id === unit.owner)!;
    civ.soldiers -= lost;
    civ.population -= lost;
  }
  world.simulation!.units = world.simulation!.units.filter(
    (u) => u.strength > 0,
  );
  for (const [target, missions] of assaults) {
    const owner = world.board[target]!.owner!;
    const survivors = missions.flatMap((m) =>
      world.simulation!.units.filter((u) => u.id === m.unit),
    );
    // Multiple hostile claimants cannot win by iteration order.
    if (
      new Set(survivors.map((u) => u.owner)).size !== 1 ||
      !survivors.length ||
      world.simulation!.units.some(
        (u) =>
          u.position === target && u.owner === owner && u.role === "soldier",
      )
    )
      continue;
    const city = world.simulation!.cities.find((c) => c.position === target);
    if (survivors.reduce((n, u) => n + u.strength, 0) < (city ? 3 : 1))
      continue;
    const winner = survivors[0]!.owner;
    world.board[target]!.owner = winner;
    if (city) {
      city.owner = winner;
      city.queue = null;
    }
    world.simulation!.units = world.simulation!.units.filter(
      (u) =>
        !(u.position === target && u.owner === owner && u.role !== "soldier"),
    );
    for (const u of survivors) {
      u.position = target;
      if (sequential) {
        const trace = moved.movement.find((movement) => movement.unit === u.id);
        if (trace && trace.path.at(-1) !== target) trace.path.push(target);
      }
      if (sequential)
        moved.movement.find((trace) => trace.unit === u.id)?.path.push(target);
      const m = state.missions.find((m) => m.unit === u.id)!;
      m.status = "completed";
      m.detail = "Territoire conquis";
      m.route = [target];
    }
    say(winner, "SEIZED", `${world.board[target]!.name} conquise sur ${owner}`);
  }
  const foundations = state.missions.filter(
    (m) =>
      m.action === "settle" &&
      (!sequential || m.civ === actor) &&
      m.status === "completed" &&
      world.simulation!.units.some(
        (u) =>
          u.id === m.unit && u.role === "settler" && u.position === m.target,
      ),
  );
  for (const m of state.missions) {
    if (sequential && m.civ !== actor) continue;
    const unit = world.simulation!.units.find((u) => u.id === m.unit);
    if (!unit) {
      m.status = "interrupted";
      m.detail = "Unité disparue";
      continue;
    }
    if (
      m.action !== "settle" ||
      unit.role !== "settler" ||
      unit.position !== m.target ||
      m.status !== "completed"
    )
      continue;
    if (
      world.board[m.target]!.owner !== null ||
      world.simulation!.cities.some(
        (c) => distance(world, c.position, m.target) < 3,
      ) ||
      foundations.some(
        (other) =>
          other.unit !== m.unit && distance(world, other.target, m.target) < 3,
      )
    ) {
      m.status = "blocked";
      m.detail = "Fondation trop proche, concurrente ou territoire occupé";
      continue;
    }
    const civ = world.civs.find((c) => c.id === unit.owner)!;
    world.simulation!.cities.push({
      id: `city-${unit.id}`,
      owner: unit.owner,
      position: m.target,
      founded: world.tick + 1,
      buildings: [],
      queue: null,
    });
    for (const i of [m.target, ...neighbours(world.size, m.target)])
      if (world.board[i]!.owner === null) world.board[i]!.owner = unit.owner;
    world.simulation!.units = world.simulation!.units.filter(
      (u) => u.id !== unit.id,
    );
    m.detail = "Ville fondée";
    say(civ.id, "FOUNDED", `Ville fondée à ${world.board[m.target]!.name}`);
  }
  // Long operations beyond friendly land need a supply line. Attrition is
  // explicit and bounded, with a turn of grace between checks.
  if ((sequential ? roundNumber : world.tick + 1) % 3 === 0)
    for (const unit of world.simulation!.units)
      if (unit.role === "soldier" && (!sequential || unit.owner === actor)) {
        const supplied = world.board.some(
          (p, i) =>
            p.owner === unit.owner && distance(world, i, unit.position) <= 3,
        );
        if (!supplied && unit.strength > 1) {
          unit.strength--;
          const c = world.civs.find((c) => c.id === unit.owner)!;
          c.soldiers--;
          c.population--;
          say(
            c.id,
            "SHORTAGE",
            `${unit.id} perd un soldat loin du ravitaillement`,
          );
        }
      }
  world.tick++;
  world = census(world);
  const incident = incidentFor(
    world.seed,
    sequential ? roundNumber - 1 : input.world.tick,
  );
  const economyWorld = sequential
    ? {
        ...world,
        simulation: {
          ...world.simulation!,
          units: world.simulation!.units.map((unit) => {
            const path = moved.movement.find(
              (trace) => trace.unit === unit.id,
            )?.path;
            return path && path.length > 1
              ? { ...unit, previous: path[path.length - 2]! }
              : unit;
          }),
        },
      }
    : world;
  if (state.rules !== "spectator-1")
    state.economy = world.civs.flatMap((c) =>
      sequential && c.id !== actor
        ? (state.economy ?? []).filter((l) =>
            world.simulation!.cities.some(
              (city) => city.id === l.city && city.owner === c.id,
            ),
          )
        : deriveCityEconomy(economyWorld, c.id, state.caravans),
    );
  if (["spectator-6", "spectator-7", "spectator-8"].includes(state.rules) && actor) {
    const owned = new Set(
      world
        .simulation!.cities.filter((c) => c.owner === actor)
        .map((c) => c.id),
    );
    state.economy = state.economy!.map((l) =>
      owned.has(l.city)
        ? {
            ...l,
            production: modernizationProduction(
              l.production,
              state.modernization![actor]!,
            ),
          }
        : l,
    );
  }
  for (const civ of world.civs)
    if (civ.fellOnTick === null && (!sequential || civ.id === actor)) {
      let multiplier = incident?.foodMultiplier ?? 1;
      if (
        multiplier < 1 &&
        (civ.advances.includes("irrigation") ||
          world.simulation!.cities.some(
            (c) => c.owner === civ.id && c.buildings.includes("granary"),
          ))
      )
        multiplier = (1 + multiplier) / 2;
      develop(world, civ, events, {
        manual: true,
        foodMultiplier: multiplier,
        research: state.research[civ.id] ?? null,
        ...(sequential ? { seasonTick: roundNumber } : {}),
        ...(state.rules !== "spectator-1"
          ? {
              production: (state.economy ?? [])
                .filter((l) =>
                  world.simulation!.cities.some(
                    (c) => c.id === l.city && c.owner === civ.id,
                  ),
                )
                .reduce(
                  (sum, l) => ({
                    food: sum.food + l.production.food,
                    timber: sum.timber + l.production.timber,
                    ore: sum.ore + l.production.ore,
                    wealth: sum.wealth + l.production.wealth,
                  }),
                  { food: 0, timber: 0, ore: 0, wealth: 0 },
                ),
            }
          : {}),
      });
    }
  if (["spectator-6", "spectator-7", "spectator-8"].includes(state.rules) && actor) {
    const civ = world.civs.find((c) => c.id === actor)!;
    const owned = world.simulation!.cities.filter((c) => c.owner === actor);
    const programs = state.modernization![actor]!;
    if (civ.fellOnTick === null && civ.population > 0 && owned.length) {
      civ.science =
        (civ.science ?? 0) +
        owned.length *
          (Number(programs.completed.includes("computing")) +
            Number(programs.completed.includes("orbital_network")));
      if (
        programs.active &&
        owned.some((c) => c.buildings.includes("academy"))
      ) {
        programs.active.remaining--;
        if (programs.active.remaining <= 0) {
          programs.completed.push(programs.active.project);
          events.push({
            tick: world.tick,
            civ: actor,
            kind: "ADVANCE",
            detail: `Programme achevé : ${MODERNIZATION[programs.active.project].name}`,
          });
          programs.active = null;
        }
      }
    }
  }
  world = cleanup(world, events);
  initializeUnits(world, false, actor ?? undefined);
  world = cleanup(world, events);
  if (state.rules !== "spectator-1") {
    state.caravans = Object.fromEntries(
      world
        .simulation!.units.filter((u) => u.role === "merchant")
        .flatMap((u) => {
          const city = world.simulation!.cities.find(
            (c) => c.owner === u.owner && c.position === u.position,
          );
          const last = city?.id ?? state.caravans?.[u.id];
          return last ? [[u.id, last]] : [];
        }),
    );
  }
  // Retain only extant missions plus the last turn's terminal records.
  state.missions = state.missions
    .filter(
      (m) =>
        world.simulation!.units.some((u) => u.id === m.unit) ||
        (m.status === "completed" && m.detail === "Ville fondée"),
    )
    .slice(-1024);
  state.world = world;
  if (["spectator-5", "spectator-6", "spectator-7", "spectator-8"].includes(state.rules)) {
    state.ageTransitions = [];
    const age = actor ? state.ages?.[actor] : undefined;
    if (age && actor) {
      const progress = ageProgress(
        world,
        actor,
        age.current,
        ["spectator-6", "spectator-7", "spectator-8"].includes(state.rules)
          ? state.modernization![actor]!.completed
          : undefined,
      );
      if (progress.ready && progress.next) {
        state.ageTransitions.push({
          civ: actor,
          from: age.current,
          to: progress.next,
          turn: world.tick,
        });
        age.current = progress.next;
        age.enteredAt = world.tick;
        age.history.push({ age: progress.next, turn: world.tick });
      }
    }
  }
  if (
    ["spectator-3", "spectator-4", "spectator-5", "spectator-6", "spectator-7", "spectator-8"].includes(
      state.rules,
    )
  ) {
    state.plans ??= {};
    for (const [civ, plan] of Object.entries(state.plans))
      if (!sequential || civ === actor)
        state.plans[civ] = advancePlan(
          plan,
          world,
          civ,
          state.economy ?? [],
          state.research[civ] ?? null,
        );
  }
  if (sequential) {
    const alive = world.civs
      .filter((c) => c.fellOnTick === null && c.population > 0)
      .sort((a, b) => a.id.localeCompare(b.id));
    const next = alive.find((c) => c.id > actor!);
    state.sequence = {
      activeCiv: next?.id ?? alive[0]?.id ?? actor!,
      round: roundNumber + (next ? 0 : 1),
    };
  }
  for (const civ of world.civs)
    state.memory[civ.id] = [
      ...(state.memory[civ.id] ?? []),
      ...events
        .filter((e) => e.civ === civ.id && e.kind !== "GREW")
        .map((e) => `Tour ${e.tick} : ${e.detail}`),
      ...rejected
        .filter((r) => r.civ === civ.id)
        .map((r) => `Tour ${world.tick} : ${r.detail}`),
    ].slice(-12);
  return { state, events, rejected, incident };
}

/** Offline baseline; explicitly labelled as scripted, never as a remote model. */
export function localCouncil(
  state: SpectatorState,
  civId: CouncilDecision["civ"],
): CouncilDecision {
  const w = state.world,
    civ = w.civs.find((c) => c.id === civId)!;
  const climate = state.rules === "spectator-8"
    ? incidentFor(w.seed, state.sequence!.round - 1) ??
      forecastFor(w.seed, state.sequence!.round - 1)
    : null;
  const preparing = !!climate && climate.foodMultiplier < 1 &&
    civ.stock.food < civ.population * 4;
  const focus = preparing ? "growth" :
    civId === "crimson"
      ? "military"
      : civId === "azure"
        ? "science"
        : civId === "amber"
          ? "industry"
          : "growth";
  const militaryStrength = (id: string) =>
    ["spectator-7", "spectator-8"].includes(state.rules)
      ? militaryProfile(
          state.ages?.[id]?.current ?? "bronze",
          w.civs.find((x) => x.id === id)!.advances,
          state.modernization?.[id]?.completed ?? [],
        ).power
      : 1;
  const orders: CouncilDecision["orders"] = [];
  const neutral = w.board
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p, i }) =>
        p.owner === null &&
        p.kind !== "river" &&
        !w.simulation!.cities.some((c) => distance(w, c.position, i) < 3),
    );
  for (const u of w.simulation!.units.filter((u) => u.owner === civId)) {
    const existing = state.missions.find(
      (m) =>
        m.unit === u.id && (m.status === "active" || m.status === "blocked"),
    );
    if (
      existing &&
      existing.status === "active" &&
      existing.action !== "defend"
    )
      continue;
    if (u.role === "settler") {
      const target = [...neutral]
        .sort(
          (a, b) =>
            distance(w, u.position, a.i) - distance(w, u.position, b.i) ||
            a.i - b.i,
        )
        .find((t) => unitPath(w, u, t.i).length);
      if (target)
        orders.push({
          unit: u.id,
          action: "settle",
          target: target.i,
          reason: "Fonder une ville sur une terre disponible",
        });
    } else if (u.role === "soldier") {
      const enemy = w.board
        .map((p, i) => ({ p, i }))
        .filter(
          ({ p }) =>
            p.owner &&
            p.owner !== civId &&
            w.simulation!.relations.some(
              (r) =>
                r.status === "war" &&
                [r.a, r.b].includes(civId) &&
                [r.a, r.b].includes(p.owner!),
            ),
        )
        .sort(
          (a, b) => distance(w, u.position, a.i) - distance(w, u.position, b.i),
        )
        .find((t) => unitPath(w, u, t.i).length);
      const refuge = unitPath(w, u, civ.capital!).length
        ? civ.capital!
        : w.board.findIndex(
            (p, i) => p.owner === civId && unitPath(w, u, i).length > 0,
          );
      if (enemy || refuge >= 0)
        orders.push({
          unit: u.id,
          action: enemy ? "attack" : "defend",
          target: enemy?.i ?? refuge,
          reason: enemy ? "Avancer vers le front" : "Protéger nos terres",
        });
    } else if (state.rules !== "spectator-1" && u.role === "merchant") {
      const target = w
        .simulation!.cities.filter(
          (c) => c.owner === civId && c.id !== state.caravans?.[u.id],
        )
        .map((c) => ({ city: c, path: unitPath(w, u, c.position) }))
        .filter((c) => c.path.length > 0)
        .sort(
          (a, b) =>
            a.path.length - b.path.length || a.city.id.localeCompare(b.city.id),
        )[0];
      if (target)
        orders.push({
          unit: u.id,
          action: "move",
          target: target.city.position,
          reason: "Relier nos villes et livrer les marchandises",
        });
    } else {
      const kind =
        u.role === "miner"
          ? "hill"
          : u.role === "lumberjack"
            ? "forest"
            : "plain";
      const target = w.board.findIndex(
        (p, i) =>
          p.owner === civId && p.kind === kind && unitPath(w, u, i).length > 0,
      );
      if (target >= 0)
        orders.push({
          unit: u.id,
          action: "move",
          target,
          reason: "Rejoindre les terres de travail",
        });
    }
  }
  const modernization =
    ["spectator-6", "spectator-7", "spectator-8"].includes(state.rules)
      ? (ModernizationProjectSchema.options.find(
          (p) =>
            !modernizationIssue(
              w,
              civId,
              state.ages![civId]!.current,
              state.modernization![civId]!,
              p,
            ),
        ) ?? null)
      : null;
  const technology = TECHNOLOGIES.find(
    (t) =>
      (!["spectator-5", "spectator-6", "spectator-7", "spectator-8"].includes(state.rules) ||
        ageAllows(
          state.ages?.[civId]?.current ?? "bronze",
          TECHNOLOGY_AGE[t.name]!,
        )) &&
      !civ.advances.includes(t.name) &&
      t.requires.every((p) => civ.advances.includes(p)),
  );
  const construction: CouncilDecision["construction"] = [];
  const budget = { ...civ.stock };
  if (modernization) pay(budget, MODERNIZATION[modernization].cost);
  for (const city of w.simulation!.cities.filter(
    (c) => c.owner === civId && !c.queue,
  )) {
    const building = (
      [
        focus === "science" &&
        !["spectator-5", "spectator-6", "spectator-7", "spectator-8"].includes(state.rules)
          ? "academy"
          : "granary",
        "market",
        "workshop",
        "walls",
        "academy",
      ] as const
    ).find((b) => {
      const { years: _, ...cost } = BUILDING_RULES[b];
      return (
        (!["spectator-5", "spectator-6", "spectator-7", "spectator-8"].includes(state.rules) ||
          ageAllows(
            state.ages?.[civId]?.current ?? "bronze",
            BUILDING_AGE[b],
          )) &&
        !city.buildings.includes(b) &&
        affordable(budget, cost)
      );
    });
    if (building) {
      const { years: _, ...cost } = BUILDING_RULES[building];
      pay(budget, cost);
      construction.push({ city: city.id, building });
    }
  }
  return {
    ...(["spectator-6", "spectator-7", "spectator-8"].includes(state.rules) ? { modernization } : {}),
    civ: civId,
    turn: w.tick,
    objective:
      preparing
        ? `Préparer les réserves alimentaires face à ${climate!.title.toLowerCase()}`
        : focus === "military"
        ? "Développer les frontières et protéger nos intérêts"
        : "Fonder des villes et assurer la prospérité",
    focus,
    research: technology?.name ?? null,
    ...(["spectator-3", "spectator-4", "spectator-5", "spectator-6", "spectator-7", "spectator-8"].includes(
      state.rules,
    ) && state.plans?.[civId]?.status !== "active"
      ? {
          plan: (() => {
            const founding = orders.find((order) => order.action === "settle");
            const base = {
              targetTile: null,
              targetCity: null,
              targetTech: null,
              targetBuilding: null,
            };
            if (founding)
              return {
                ...base,
                kind: "settle" as const,
                targetTile: founding.target,
                rationale:
                  "Étendre notre réseau de villes sur le site choisi par les colons.",
              };
            if (construction[0])
              return {
                ...base,
                kind: "build" as const,
                targetCity: construction[0].city,
                targetBuilding: construction[0].building,
                rationale:
                  "Achever l'infrastructure prioritaire engagée dans cette ville.",
              };
            if (technology)
              return {
                ...base,
                kind: "research" as const,
                targetTech: technology.name,
                rationale: "Acquérir la prochaine technologie disponible.",
              };
            return undefined;
          })(),
        }
      : {}),
    construction: construction.slice(0, 16),
    orders: orders.slice(0, 64),
    recruitSettler:
      !preparing && civ.stock.food > civ.population * 4 &&
      w.simulation!.cities.filter((c) => c.owner === civId).length < 6 &&
      w.simulation!.units.filter(
        (u) => u.owner === civId && u.role === "settler",
      ).length < 2 &&
      affordable(budget, { food: 50, timber: 60, wealth: 20 }),
    diplomacy: w.civs
      .filter((c) => c.id !== civId && c.fellOnTick === null)
      .map((c) => ({
        target: c.id,
        proposal:
          focus === "military" &&
          w.tick > 40 &&
          civ.soldiers * militaryStrength(civ.id) >
            c.soldiers * 1.5 * militaryStrength(c.id)
            ? "war"
            : "trade",
      })),
  };
}

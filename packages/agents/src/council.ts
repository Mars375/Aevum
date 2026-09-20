import { ageProgress } from "../../world/src/ages.js";
import { planIssue } from "../../world/src/strategic-plans.js";
import {
  councilOptions,
  INFRASTRUCTURE_REASONS,
} from "./council-options.js";
import {
  INFRASTRUCTURE,
  INFRASTRUCTURE_KINDS,
  energyReport,
  infrastructureIssue,
} from "../../world/src/infrastructure.js";
import { ZodError } from "zod";
import type { GeneralConfig } from "@abs/contracts";
import {
  CouncilDecisionSchema,
  incidentFor,
  forecastFor,
  localCouncil,
  type SpectatorState,
} from "../../world/src/spectator.js";
import type { CouncilAnswer } from "../../world/src/campaign.js";
import { RemoteProvider } from "./provider.js";
import { ENDPOINTS, type ProviderName } from "./endpoints.js";
import { TECHNOLOGIES, BUILDING_RULES } from "../../world/src/development.js";
import { militaryProfile } from "../../world/src/military.js";
import {
  COUNCIL_JSON_SCHEMA,
  STRATEGIC_COUNCIL_JSON_SCHEMA,
  MODERN_COUNCIL_JSON_SCHEMA,
  INFRASTRUCTURE_COUNCIL_JSON_SCHEMA,
} from "./council-schema.js";

export function councilObservation(state: SpectatorState, civ: string) {
  const w = state.world;
  const profiles =
    ["spectator-7", "spectator-8", "spectator-9"].includes(state.rules)
      ? Object.fromEntries(
          w.civs.map((c) => [
            c.id,
            militaryProfile(
              state.ages![c.id]!.current,
              c.advances,
              state.modernization![c.id]!.completed,
            ),
          ]),
        )
      : null;
  return {
    ...(state.ages?.[civ]
      ? {
          age: state.ages[civ],
          ageProgress: ageProgress(
            w,
            civ,
            state.ages[civ]!.current,
            ["spectator-6", "spectator-7", "spectator-8", "spectator-9"].includes(state.rules)
              ? state.modernization![civ]!.completed
              : undefined,
          ),
          advancementRule:
            "Meet every requirement during your own turn. Ages unlock technologies and buildings; calendar time alone never advances your civilization.",
        }
      : {}),
    turn: w.tick,
    rules: state.rules,
    ...(["spectator-8", "spectator-9"].includes(state.rules) ? {
      forecast: forecastFor(w.seed, state.sequence!.round - 1),
      climatePreparation: "Forecast start/end are zero-based rounds; add 1 for displayed rounds. Forecasts appear three rounds before their start; remaining warning is forecast.start - (sequence.round - 1) own turns. Preserve food, consider growth focus, irrigation and granaries before poor harvests. Forecasts do not reduce production before their start. Stock changes also reflect trade, recruitment and consumption.",
    } : {}),
    ...(["spectator-4", "spectator-5", "spectator-6", "spectator-7", "spectator-8", "spectator-9"].includes(state.rules)
      ? {
          sequence: state.sequence,
          diplomacyOffers: state.diplomacyOffers?.filter(
            (offer) => offer.from === civ || offer.to === civ,
          ),
        }
      : {}),
    plan: state.plans?.[civ] ?? null,
    ...(["spectator-6", "spectator-7", "spectator-8", "spectator-9"].includes(state.rules) ? { currentPlanIssue: state.plans?.[civ] ? planIssue(w, civ, state.plans[civ]!) : null } : {}),
    ...(state.rules === "spectator-9"
      ? {
          energy: energyReport(
            {
              world: w,
              modernization: state.modernization,
              infrastructure: state.infrastructure,
            },
            civ,
          ),
          infrastructure: {
            queue: (state.infrastructure?.queues ?? []).filter(
              (queue) => queue.owner === civ,
            ),
            available: w.simulation!.cities
              .filter((city) => city.owner === civ)
              .flatMap((city) =>
                INFRASTRUCTURE_KINDS.map((kind) => {
                  const issue = infrastructureIssue(
                    {
                      world: w,
                      modernization: state.modernization,
                      infrastructure: state.infrastructure,
                    },
                    civ,
                    kind,
                    city.id,
                  );
                  const rule = INFRASTRUCTURE[kind];
                  return {
                    city: city.id,
                    kind,
                    cost: { ...rule.cost },
                    turns: rule.turns,
                    unlock: rule.unlock,
                    supply: rule.supply,
                    demand: rule.demand,
                    reason: INFRASTRUCTURE_REASONS[kind],
                    available: issue === null,
                    unavailableReason: issue,
                  };
                }),
              ),
          },
        }
      : {}),
    options: councilOptions(state, civ),
    economy: state.economy?.filter((l) =>
      w.simulation!.cities.some((c) => c.id === l.city && c.owner === civ),
    ),
    ruler: w.civs.find((c) => c.id === civ),
    objective: state.objectives[civ] ?? null,
    memory: state.memory[civ] ?? [],
    personality: (
      {
        amber: "Prudent merchant: prosper through trade and productive cities",
        azure: "Scholar: invest in knowledge and avoid unnecessary wars",
        crimson:
          "Ambitious strategist: protect supply lines and expand when advantageous",
        verdant: "Steward: protect food reserves, population and diplomacy",
      } as Record<string, string>
    )[civ],
    event: incidentFor(
      w.seed,
      ["spectator-4", "spectator-5", "spectator-6", "spectator-7", "spectator-8", "spectator-9"].includes(state.rules)
        ? (state.sequence?.round ?? 1) - 1
        : w.tick,
    ),
    size: w.size,
    // Public board and public census; rival orders and objectives stay private.
    board: w.board.map((p, index) => ({
      index,
      kind: p.kind,
      owner: p.owner,
      name: p.name,
    })),
    civilizations: w.civs.map((c) => ({
      ...(state.ages?.[c.id] ? { age: state.ages[c.id]!.current } : {}),
      ...(profiles
        ? {
            power: profiles[c.id]!.power,
            resilience: profiles[c.id]!.resilience,
          }
        : {}),
      id: c.id,
      population: c.population,
      soldiers: c.soldiers,
      alive: c.fellOnTick === null,
    })),
    units: w.simulation!.units.filter((u) => u.owner === civ),
    cities: w.simulation!.cities.filter((c) => c.owner === civ),
    relations: w.simulation!.relations.filter(
      (r) => r.a === civ || r.b === civ,
    ),
    missions: state.missions.filter((m) => m.civ === civ),
    technologies: TECHNOLOGIES,
    buildingCosts: BUILDING_RULES,
  };
}
const instructions = `You govern one civilization in a simultaneous turn strategy simulation. All rulers see the same start-of-turn world. Issue concrete orders to YOUR unit IDs. Explain your objective and each order briefly in French. Use options.units for allowed actions and reachable foundation sites, options.construction for currently available buildings, and options.research for eligible technologies. In spectator-2, workSites show owned productive tiles near cities; station each worker on its matching terrain. Merchants earn a bounded delivery payment when arriving at a different own city they actually travelled to; issue move to tradeDestinations. These options are possibilities, not commands: choose your own strategy. A settle order can target a listed remote site; the settler travels then founds automatically. Do not merely explore forever when your goal is a new city. Existing missions persist. Never invent units or resources. Movement is cardinal, one tile per turn. Foreign land needs attack by a soldier and declared war. Attacks resolve simultaneously. Founding requires a settler on neutral dry land at least 3 Manhattan tiles from any city; recruiting one costs 50 food, 60 timber, 20 wealth. Only soldiers can defend or escort; workers must use move/explore or keep their existing mission. Every order MUST include an integer target tile, including defend at the current position. Board coordinates are row=floor(index/size), column=index%size; neighbors differ by 1 in a row or by size in a column. Defend persists. Retreat and explore are movement orders. Construction is paid upfront and lasts several turns. Trade and peace require matching proposals; war is unilateral subject to an 8-turn truce. Global weather is known before you decide. Research needs listed prerequisites. Reply only JSON: {"civ":"YOUR_ID","turn":CURRENT_TURN,"objective":"...","focus":"balanced|growth|industry|science|military","research":null or technology name,"construction":[{"city":"ID","building":"granary|workshop|market|walls|academy"}],"diplomacy":[{"target":"FACTION","proposal":"peace|trade|war"}],"recruitSettler":false,"orders":[{"unit":"ID","action":"move|defend|attack|settle|explore|retreat","target":TILE_INDEX,"reason":"..."}]}. Empty arrays are valid. Plan reserves and logistics rather than pursuing conquest at any cost.`;

function zeroPrice(value: unknown): boolean {
  return (
    (typeof value === "number" ||
      (typeof value === "string" && value.trim() !== "")) &&
    Number.isFinite(Number(value)) &&
    Number(value) === 0
  );
}

/** Schema locations and codes only — never a provider value or body. */
function describeIssues(error: ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => {
      const path = issue.path
        .map((part) =>
          typeof part === "number"
            ? part
            : /^[a-zA-Z][a-zA-Z0-9]{0,30}$/.test(part)
              ? part
              : "field",
        )
        .join(".");
      return `${path || "decision"} (${issue.code})`;
    })
    .join(", ");
}

/**
 * A malformed strategic plan must not cost the whole council.
 *
 * Measured on a five-seed remote series: one council in five was discarded
 * whole because `plan.targetTech` carried a value outside its enum, while the
 * orders and the infrastructure choice in the same answer were perfectly legal.
 * The repo's own rule is that a field in another shape is not an error, and
 * that a good decision is not thrown away over a question of form.
 *
 * The plan is DROPPED, never invented and never nulled: `plan: null` means the
 * ruler cancels its standing plan, which is a decision it did not take.
 * Removing the key leaves the standing plan exactly where it was. Only issues
 * inside `plan` are forgiven — a malformed order still sinks the answer,
 * because an order is the thing the engine must be able to trust. The repair
 * is reported on the answer, so it is recorded rather than silent.
 */
function parseDecision(raw: unknown): {
  decision: ReturnType<typeof CouncilDecisionSchema.parse>;
  repaired: string | null;
} {
  const first = CouncilDecisionSchema.safeParse(raw);
  if (first.success) return { decision: first.data, repaired: null };
  const onlyPlan =
    first.error.issues.length > 0 &&
    first.error.issues.every((issue) => issue.path[0] === "plan");
  if (!onlyPlan || !raw || typeof raw !== "object" || !("plan" in raw))
    throw first.error;
  const { plan: _dropped, ...rest } = raw as Record<string, unknown>;
  return {
    decision: CouncilDecisionSchema.parse(rest),
    repaired: "Plan ignoré, ordres conservés : " + describeIssues(first.error),
  };
}

export async function requestCouncil(
  state: SpectatorState,
  civ: GeneralConfig["factionId"],
  mode: "local" | "remote",
  model: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
  correction?: { previousDecision: unknown; issues: string[] },
): Promise<CouncilAnswer> {
  const strategic =
    state.rules === "spectator-3" ||
    ["spectator-4", "spectator-5", "spectator-6", "spectator-7", "spectator-8", "spectator-9"].includes(state.rules);
  const schema =
    state.rules === "spectator-9"
      ? INFRASTRUCTURE_COUNCIL_JSON_SCHEMA
      : ["spectator-6", "spectator-7", "spectator-8"].includes(state.rules)
        ? MODERN_COUNCIL_JSON_SCHEMA
        : strategic
          ? STRATEGIC_COUNCIL_JSON_SCHEMA
          : COUNCIL_JSON_SCHEMA;
  const turnInstructions = [
    "spectator-4",
    "spectator-5",
    "spectator-6",
    "spectator-7",

    "spectator-8",
    "spectator-9",
  ].includes(state.rules)
    ? instructions
        .replace(
          "You govern one civilization in a simultaneous turn strategy simulation. All rulers see the same start-of-turn world.",
          "You govern the ACTIVE civilization in a sequential turn strategy simulation. Only you act now. The next ruler will observe your resolved actions. A round ends when all living civilizations have played.",
        )
        .replace(
          "Movement is cardinal, one tile per turn.",
          "Movement is cardinal and spends points: soldiers 3, merchants 4, other roles 2 each own turn. Forest, hill and river tiles cost 2 points; other tiles cost 1. Long routes persist across your turns, but movement stops when the budget is exhausted. No rival units move during your turn.",
        )
        .replace(
          "Attacks resolve simultaneously.",
          "Your attacks resolve during your turn; defenders can respond in combat but cannot march.",
        )
        .replace(
          "Trade and peace require matching proposals; war is unilateral subject to an 8-turn truce.",
          "Trade and peace require matching proposals saved across successive ruler turns; war is unilateral subject to a truce. Read incoming diplomacy before responding.",
        )
    : instructions;
  const systemInstructions =
    turnInstructions +
    (state.rules === "spectator-6"
      ? " In spectator-6 follow responseContract exactly, even when the provider does not enforce structured outputs. The observed plan contains engine metadata: NEVER copy status, startedAt, updatedAt, progress, detail or other metadata into your response plan. Its ONLY keys are kind, targetTile, targetCity, targetTech, targetBuilding, rationale. Modernization is a TOP-LEVEL field, never a plan field or a research technology. Include modernization: null or one project ID from options.modernization with available=true. Null keeps the current project running; it does not cancel it. Programs pay resources and science upfront and progress on your own turns while you own an academy. Their real production/science effects are described in the options. Budget modernization before construction and recruitment. Fulfil ageProgress requirements to advance independently through six ages; future age is not an automatic victory."
      : "") +
    (state.rules === "spectator-9"
      ? " In spectator-9 you may issue infrastructure: a single TOP-LEVEL command {city, kind} or null, never a plan field. Kinds come from options.infrastructure.available with available=true and must target an owned city. The cost is paid immediately from national stocks after modernization and before construction and recruitment. One queued site per civilization; it advances one personal turn each own turn and its bonuses apply from your NEXT own turn. When any energy component is deficient, prefer to build supply (clean solar_array when unlocked, otherwise thermal_plant); otherwise build useful consumers (foundry, research_center, automated_factory, spaceport) in powered cities. Never sacrifice food reserves to build. Only soldier units may defend, attack or escort. To leave a civilian idle, omit it from orders; omission preserves its current mission. There is no wait or hold action. During correction remove unsupported orders or choose an action listed for that exact unit in options.units. An optional settle plan target must come from options.settlementPlanSites; when it is empty, return plan:null or choose a different eligible plan. Civilian orders must use that unit's advertised moveTargets, workSites, tradeDestinations or foundationSites; otherwise omit that civilian order. Advertised destinations are possibilities, not guarantees: resolution may still block them."
      : "") +
    (strategic
      ? " In spectator-3 and spectator-4, maintain one concrete multi-turn plan. Return plan with kind settle/build/research/trade, targetTile, targetCity, targetTech, targetBuilding, rationale in French. Set irrelevant targets to null. Settle needs targetTile; build needs own targetCity and targetBuilding; research needs targetTech; trade needs own destination targetCity and is completed only by an actual caravan delivery. Repeat the current plan while pursuing it; do not replace it just because one turn passed. plan:null explicitly cancels it. The engine measures completion and stagnation; a plan does not execute orders: still issue the construction, research and unit orders needed. Revise a blocked plan using observed causes. Do not claim success before the engine confirms it. Choose achievable targets from options and maintain reserves."
      : "") +
    (["spectator-6", "spectator-7", "spectator-8", "spectator-9"].includes(state.rules)
      ? " For this v6 council, currentPlanIssue is authoritative: when non-null, do NOT repeat that invalid plan. Set plan:null to abandon it or choose a currently legal target from options. Modernization is independent of the strategic plan; do not invent a modernization plan kind. You may launch modernization while plan:null and orders:[] if no other action is useful."
      : "") +
    (["spectator-7", "spectator-8", "spectator-9"].includes(state.rules)
      ? " In spectator-7 and later follow the same responseContract rules as spectator-6, keeping plan metadata out of your response. Military capability follows technology: every civilization carries power and resilience multipliers (civilizations array) derived from its age, research and completed modernization programmes. Power multiplies your attack damage, resilience multiplies the defender fortifications. Compare multipliers together with your armies before declaring war and avoid assaulting a technologically superior civilization without a clear advantage."
      : "");
  if (mode === "local")
    return {
      civ,
      decision: localCouncil(state, civ),
      source: "local",
      model: `local/deterministic-council-v${state.rules.slice(-1)}`,
      service: null,
      error: null,
    };
  try {
    let text: string | null = null;
    let service: CouncilAnswer["service"] = null;
    if (model.startsWith("nous:")) {
      if (!env.NOUS_API_KEY) throw new Error("Clé Nous absente");
      // Verify zero pricing from the provider itself on every call; fail closed.
      const headers = {
        Authorization: `Bearer ${env.NOUS_API_KEY}`,
        "Content-Type": "application/json",
      };
      const catalog = await fetchImpl(
        "https://inference-api.nousresearch.com/v1/models",
        { headers, signal: AbortSignal.timeout(15000) },
      );
      if (!catalog.ok) throw new Error("Catalogue Nous indisponible");
      const data = (await catalog.json()) as {
        data?: Array<{
          id: string;
          pricing?: { prompt?: string; completion?: string };
          supported_parameters?: string[];
        }>;
      };
      const entry = data.data?.find((m) => m.id === model.slice(5));
      if (
        !entry?.pricing ||
        !zeroPrice(entry.pricing.prompt) ||
        !zeroPrice(entry.pricing.completion)
      )
        throw new Error(
          "Gratuité du modèle Nous non vérifiable : appel refusé",
        );
      const started = Date.now();
      const response = await fetchImpl(
        "https://inference-api.nousresearch.com/v1/chat/completions",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: entry.id,
            ...(entry.supported_parameters?.includes("structured_outputs")
              ? {
                  response_format: {
                    type: "json_schema",
                    json_schema: {
                      name: "council_decision",
                      strict: true,
                      schema,
                    },
                  },
                }
              : {}),
            messages: [
              {
                role: "system",
                content:
                  systemInstructions +
                  " For escort orders, include escort: FRIENDLY_UNIT_ID; otherwise escort: null. Armies more than 3 tiles from friendly land suffer attrition every third turn. Use your memory of previous results.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  ...councilObservation(state, civ),
                  ...(["spectator-6", "spectator-7", "spectator-8", "spectator-9"].includes(state.rules) ? { responseContract: schema } : {}),
                  ...(correction
                    ? {
                        correction: {
                          ...correction,
                          instruction:
                            "Return a complete corrected decision for the SAME ruler and turn. Fix the listed issues. Keep your strategy where legal. Never invent units or change the world state.",
                        },
                      }
                    : {}),
                }),
              },
            ],
            max_tokens: 6000,
            ...(entry.supported_parameters?.includes("reasoning")
              ? { reasoning: { effort: "none" } }
              : {}),
            temperature: 0.5,
          }),
          signal: AbortSignal.timeout(45000),
        },
      );
      if (!response.ok) throw new Error(`Nous HTTP ${response.status}`);
      const body = (await response.json()) as {
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
      };
      text = body.choices?.[0]?.message?.content ?? null;
      if (body.model)
        service = {
          requestedModel: model,
          servedModel: `nous:${body.model}`,
          provider: "nous",
          fallbackCount: 0,
          attempts: 1,
          latencyMs: Date.now() - started,
          servedByFallback: `nous:${body.model}` !== model,
        };
    } else {
      const apiKeys = Object.fromEntries(
        Object.entries(ENDPOINTS).flatMap(([name, e]) =>
          env[e.keyEnv] ? [[name, env[e.keyEnv]]] : [],
        ),
      ) as Partial<Record<ProviderName, string>>;
      const provider = new RemoteProvider({
        apiKeys,
        freeModelsOnly: true,
        attemptsPerModel: 1,
        timeoutMs: 45000,
        fetchImpl,
      });
      const response = await provider.askWithEvidence(
        { factionId: civ, displayName: civ, model, fallbacks: [] },
        systemInstructions +
          " For escort orders, include escort: FRIENDLY_UNIT_ID; otherwise escort: null. Escort follows that unit's recorded position. Armies more than 3 tiles from friendly land suffer attrition every third turn. Use your memory of previous results.",
        JSON.stringify({
          ...councilObservation(state, civ),
          ...(["spectator-6", "spectator-7", "spectator-8", "spectator-9"].includes(state.rules) ? { responseContract: schema } : {}),
          ...(correction
            ? {
                correction: {
                  ...correction,
                  instruction:
                    "Return a complete corrected decision for the SAME ruler and turn. Fix the listed issues. Keep your strategy where legal. Never invent units or change the world state.",
                },
              }
            : {}),
        }),
        schema,
      );
      text = response.text;
      service = response.service;
    }
    if (!text) throw new Error("Modèle indisponible ou réponse vide");
    const { decision, repaired } = parseDecision(
      JSON.parse(text.replace(/^```(?:json)?\s*/, " ").replace(/\s*```$/, "")),
    );
    if (decision.civ !== civ || decision.turn !== state.world.tick)
      throw new Error("Identité ou tour incorrect dans la réponse");
    return {
      civ,
      decision,
      source: "remote",
      model: service?.servedModel ?? model,
      service,
      error: repaired,
    };
  } catch (error) {
    // Never surface transport error bodies, headers or credentials in the UI.
    const safe =
      error instanceof ZodError
        ? "Réponse IA incompatible avec le schéma des ordres : " +
          describeIssues(error)
        : error instanceof SyntaxError
          ? "Réponse IA JSON illisible"
          : error instanceof Error && error.name === "TimeoutError"
            ? "Délai de réponse IA dépassé"
            : error instanceof Error &&
                /^(Clé Nous|Catalogue Nous|Gratuité|Nous HTTP|Modèle indisponible|Identité)/.test(
                  error.message,
                )
              ? error.message
              : "Réponse IA invalide ou connexion indisponible";
    return {
      civ,
      decision: null,
      source: "unavailable",
      model,
      service: null,
      error: safe,
    };
  }
}

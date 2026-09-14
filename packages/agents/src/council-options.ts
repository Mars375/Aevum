import {
  ageAllows,
  BUILDING_AGE,
  TECHNOLOGY_AGE,
} from "../../world/src/ages.js";
import {
  MODERNIZATION,
  ModernizationProjectSchema,
  modernizationIssue,
} from "../../world/src/modernization.js";
import type { SpectatorState } from "../../world/src/spectator.js";
import type { UnitCommand } from "../../world/src/commands.js";
import { MOVEMENT_BUDGET } from "../../world/src/commands.js";
import type { Building } from "../../world/src/civilization-state.js";
import {
  affordable,
  BUILDING_RULES,
  TECHNOLOGIES,
} from "../../world/src/development.js";
import { unitPath } from "../../world/src/units.js";

/** Start-of-council suggestions, never authority to bypass the simultaneous resolver. */
export function councilOptions(state: SpectatorState, civId: string) {
  const world = state.world;
  const civ = world.civs.find((candidate) => candidate.id === civId);
  if (!civ) throw new Error(`Unknown civilization: ${civId}`);
  const simulation = world.simulation;
  if (!simulation) throw new Error("Civilization simulation required");
  const alive = civ.fellOnTick === null && civ.population > 0;
  const distance = (a: number, b: number) =>
    Math.abs((a % world.size) - (b % world.size)) +
    Math.abs(Math.floor(a / world.size) - Math.floor(b / world.size));
  const ownUnits = simulation.units.filter((unit) => unit.owner === civ.id);
  const foundationTiles = world.board.flatMap((tile, index) =>
    tile.owner === null &&
    tile.kind !== "river" &&
    simulation.cities.every((city) => distance(city.position, index) >= 3)
      ? [index]
      : [],
  );
  const units = ownUnits.map((unit) => {
    const actions: UnitCommand["action"][] = alive
      ? ["move", "explore", "retreat"]
      : [];
    if (alive && unit.role === "soldier")
      actions.push("defend", "attack", "escort");
    if (alive && unit.role === "settler") actions.push("settle");
    const foundationSites =
      alive && unit.role === "settler"
        ? foundationTiles
            .map((target) => ({ target, route: unitPath(world, unit, target) }))
            .filter((site) => site.route.length > 0)
            .map((site) => ({ ...site, distance: site.route.length - 1 }))
            .sort((a, b) => a.distance - b.distance || a.target - b.target)
            .slice(0, 6)
        : [];
    const workKind =
      unit.role === "farmer"
        ? ["plain", "river"]
        : unit.role === "lumberjack"
          ? ["forest"]
          : unit.role === "miner"
            ? ["hill"]
            : [];
    const workSites = alive
      ? world.board
          .flatMap((tile, target) =>
            tile.owner === civId &&
            workKind.includes(tile.kind) &&
            simulation.cities.some(
              (c) => c.owner === civId && distance(c.position, target) <= 3,
            )
              ? [{ target, route: unitPath(world, unit, target) }]
              : [],
          )
          .filter((s) => s.route.length)
          .sort(
            (a, b) => a.route.length - b.route.length || a.target - b.target,
          )
          .slice(0, 6)
      : [];
    const tradeDestinations =
      alive && unit.role === "merchant" && state.rules !== "spectator-1"
        ? simulation.cities
            .filter(
              (c) => c.owner === civId && c.id !== state.caravans?.[unit.id],
            )
            .map((c) => ({
              city: c.id,
              target: c.position,
              route: unitPath(world, unit, c.position),
            }))
            .filter((s) => s.route.length > 0)
            .sort((a, b) => a.route.length - b.route.length)
            .slice(0, 6)
        : [];
    return {
      unit: unit.id,
      ...(["spectator-4", "spectator-5", "spectator-6"].includes(state.rules)
        ? { movementBudget: MOVEMENT_BUDGET[unit.role] }
        : {}),
      actions,
      foundationSites,
      workSites,
      tradeDestinations,
    };
  });
  const construction = alive
    ? simulation.cities
        .filter((city) => city.owner === civ.id && !city.queue)
        .flatMap((city) =>
          (Object.keys(BUILDING_RULES) as Building[]).flatMap((building) => {
            const { years, ...cost } = BUILDING_RULES[building];
            return (!["spectator-5", "spectator-6"].includes(state.rules) ||
              ageAllows(
                state.ages?.[civId]?.current ?? "bronze",
                BUILDING_AGE[building],
              )) &&
              !city.buildings.includes(building) &&
              affordable(civ.stock, cost)
              ? [{ city: city.id, building, cost, years }]
              : [];
          }),
        )
    : [];
  const research = alive
    ? TECHNOLOGIES.filter(
        (technology) =>
          (!["spectator-5", "spectator-6"].includes(state.rules) ||
            ageAllows(
              state.ages?.[civId]?.current ?? "bronze",
              TECHNOLOGY_AGE[technology.name]!,
            )) &&
          !civ.advances.includes(technology.name) &&
          technology.requires.every((prerequisite) =>
            civ.advances.includes(prerequisite),
          ),
      ).map((technology) => ({
        ...technology,
        requires: [...technology.requires],
      }))
    : [];
  const recruitCost = { food: 50, timber: 60, wealth: 20 };
  return {
    units,
    ...(state.rules === "spectator-6"
      ? {
          modernizationState: state.modernization![civId],
          modernization: ModernizationProjectSchema.options.map((project) => {
            const issue = modernizationIssue(
              world,
              civId,
              state.ages![civId]!.current,
              state.modernization![civId]!,
              project,
            );
            return {
              project,
              ...MODERNIZATION[project],
              available: issue === null,
              unavailableReason: issue,
            };
          }),
        }
      : {}),
    construction,
    research,
    recruitSettler: {
      cost: recruitCost,
      possible:
        alive &&
        civ.capital !== null &&
        ownUnits.filter((unit) => unit.role === "settler").length < 2 &&
        affordable(civ.stock, recruitCost),
    },
    constraints: {
      sharedBudget:
        state.rules === "spectator-6"
          ? "Options are individually affordable, not jointly affordable. Modernization is paid first (including science), then construction, then recruitment. All purchases share national stocks."
          : "Construction and recruitment options are individually affordable, not jointly affordable. All purchases share the civilization stock; construction is paid before recruitment.",
      resolution:
        "These are start-of-turn suggestions. Occupation, competing foundations and simultaneous orders may block an otherwise reachable destination. Route distance counts cardinal steps, not guaranteed travel turns.",
      attacks:
        "Attack requires a soldier and war against the target owner. Escort requires another own unit. Existing missions can be kept by omitting new orders.",
    },
  };
}

import type { FactionId } from "@abs/contracts";
import { DEFAULT_COUNCIL_MODEL } from "./stable-models.js";

const FACTIONS: FactionId[] = ["amber", "azure", "crimson", "verdant"];

/**
 * Le modèle de chaque dirigeant. Par défaut le même pour les quatre — le
 * principal des modèles retenus (`stable-models.ts`) —, sans repli silencieux.
 *
 * - `AEVUM_COUNCIL_MODELS` : un modèle par civilisation,
 *   `amber=kilo:…,azure=nous:…`. Quatre modèles dans le même monde partagent la
 *   carte, la graine et les crises : c'est l'appariement qui rend une
 *   comparaison équitable.
 * - `AEVUM_COUNCIL_MODEL` : une référence complète, chez n'importe quel
 *   fournisseur (`kilo:…`, `nous:…`), pour les quatre.
 * - `NOUS_MODEL` : reste lu, pour Nous seul.
 */
export function defaultCouncilModels(
  env: NodeJS.ProcessEnv = process.env,
): Record<FactionId, string> {
  const full = env.AEVUM_COUNCIL_MODEL?.trim();
  const configured = env.NOUS_MODEL?.trim().replace(/^nous:/, "");
  const model =
    full || (configured ? `nous:${configured}` : DEFAULT_COUNCIL_MODEL);
  const models = Object.fromEntries(
    FACTIONS.map((civ) => [civ, model]),
  ) as Record<FactionId, string>;
  for (const entry of (env.AEVUM_COUNCIL_MODELS ?? "").split(",")) {
    const [civ, ...ref] = entry.split("=");
    const name = civ?.trim() as FactionId;
    // Une civilisation inconnue est une faute de frappe, pas un réglage : la
    // taire ferait jouer le mauvais modèle sans que personne le voie.
    if (!entry.trim()) continue;
    if (!FACTIONS.includes(name) || !ref.join("=").trim())
      throw new Error(
        `AEVUM_COUNCIL_MODELS : entrée invalide « ${entry.trim()} »`,
      );
    models[name] = ref.join("=").trim();
  }
  return models;
}

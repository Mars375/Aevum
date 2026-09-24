/**
 * Le climat du tour, tel que la carte le montre.
 *
 * Sécheresse, récolte exceptionnelle et hiver rigoureux étaient annoncés dans
 * un bulletin et pesaient sur les récoltes, mais le monde restait le même :
 * rien ne disait, en regardant la carte, que l'hiver était là. Ici, l'épisode
 * en cours teinte les cases et anime le ciel.
 *
 * Sans Three : ce module est sur le chemin immédiat de l'interface, et la
 * teinte se teste sans rendu.
 */
export type ClimateKind = "drought" | "harvest" | "winter";

/** L'épisode du moteur (`incidentFor`), reconnu à son titre, stable. */
export function climateKind(
  incident: { title: string } | null | undefined,
): ClimateKind | null {
  switch (incident?.title) {
    case "Sécheresse":
      return "drought";
    case "Récolte exceptionnelle":
      return "harvest";
    case "Hiver rigoureux":
      return "winter";
    default:
      return null;
  }
}

/**
 * La teinte d'une case : la couleur vers laquelle la tirer, et de combien.
 * Assez pour qu'on la voie, jamais assez pour cacher à qui est la case.
 */
export function climateTint(
  kind: ClimateKind | null,
  land: "plain" | "forest" | "hill" | "river",
): { color: string; amount: number } | null {
  if (!kind) return null;
  if (kind === "winter")
    return land === "river"
      ? { color: "#b9d6dd", amount: 0.35 }
      : { color: "#eef3f4", amount: land === "forest" ? 0.22 : 0.3 };
  if (kind === "drought")
    return land === "river"
      ? { color: "#6f8f86", amount: 0.35 }
      : { color: "#c9a35e", amount: land === "forest" ? 0.16 : 0.26 };
  // Une récolte exceptionnelle ne touche que les terres cultivables.
  return land === "plain" ? { color: "#e2c85f", amount: 0.22 } : null;
}

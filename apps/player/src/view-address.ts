/**
 * L'adresse des quatre vues.
 *
 * Changer d'onglet ne changeait rien dans la barre d'adresse : un lecteur qui
 * avait trouvé les règles ou une bataille ne pouvait y envoyer personne, le
 * lien rouvrait toujours la chronique. Les anciennes orthographes restent
 * lues, parce que des liens écrits avant existent.
 *
 * Le module est séparé d'`App.vue` pour être éprouvé : c'est un contrat
 * public — ce que porte une URL — et ce dépôt vérifie ses contrats.
 */

export type ViewMode = "battle" | "world" | "reports" | "rules";

/** La chronique est la vue par défaut : elle ne s'écrit pas dans l'adresse. */
export const DEFAULT_MODE: ViewMode = "world";

const SLUG_OF_MODE: Record<ViewMode, string> = {
  world: "chronique",
  battle: "archives",
  rules: "regles",
  reports: "a-propos",
};

const MODE_OF_SLUG: Record<string, ViewMode> = {
  chronique: "world",
  archives: "battle",
  regles: "rules",
  "a-propos": "reports",
  /** Orthographe d'avant le renommage des vues. */
  rapports: "reports",
};

export const slugOfMode = (mode: ViewMode): string => SLUG_OF_MODE[mode];

/**
 * Lit la vue demandée par une adresse, ou `null` si elle n'en nomme aucune.
 *
 * `mode=3d` précède les vues nommées et ne désigne pas une vue : il allume le
 * rendu 3D. Le confondre avec un nom de vue renverrait le lecteur ailleurs que
 * là où son lien pointait.
 */
export function modeFromSearch(search: string): ViewMode | null {
  const params = new URLSearchParams(search);
  const named = MODE_OF_SLUG[params.get("mode") ?? ""];
  if (named) return named;
  if (params.get("rapport")) return "reports";
  if (params.get("replay") || params.get("turn")) return "battle";
  return null;
}

/** Vrai si l'adresse demande le rendu 3D, ancienne forme comprise. */
export function wants3d(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get("mode") === "3d" || params.get("3d") === "1";
}

/**
 * Réécrit une adresse pour qu'elle nomme la vue affichée, sans toucher au
 * reste : le monde ouvert, le rejeu choisi et le tour visé sont portés par
 * d'autres paramètres et doivent survivre à un changement d'onglet.
 */
export function addressForMode(href: string, mode: ViewMode): string {
  const url = new URL(href);
  if (mode === DEFAULT_MODE) url.searchParams.delete("mode");
  else url.searchParams.set("mode", slugOfMode(mode));
  return url.toString();
}

/**
 * Les modèles gratuits retenus pour gouverner nos tests — et eux seuls.
 *
 * Tous les modèles gratuits trouvables ont été mesurés (25 le 24 septembre, chez
 * Nous et Kilo ; les modèles locaux, écartés). Critères fixés AVANT la mesure,
 * `docs/reports/banc-modeles.md` :
 *
 *  1. crible — répond à une petite requête ;
 *  2. banc apparié, 6 situations — au moins 5 réponses, 3 valides du premier
 *     coup, médiane de 20 s au plus ;
 *  3. durée, 20 tours consécutifs — 20/20 sans tour perdu, 14 valides du premier
 *     coup, 4 ordres rejetés au plus, médiane de 15 s au plus.
 *
 * Deux passent, mesurés deux jours de suite. `longcat-2.0`, longtemps le défaut,
 * n'en fait pas partie : il perd un tour sur sept en durée, faute de réponse.
 *
 * Changer cette liste, c'est la remesurer : `npm run bench:models`.
 */
export interface StableModel {
  ref: string;
  role: "principal" | "second choix";
  /** La mesure qui justifie sa place, pas une impression. */
  evidence: string;
}

export const STABLE_FREE_MODELS: readonly StableModel[] = [
  {
    ref: "kilo:dots-studio/dots-3-note-preview:free",
    role: "principal",
    evidence:
      "Durée, deux jours : 40/40 tours, 37 valides du premier coup, 1 rejet. Campagne par le produit : 40/40 en 40 requêtes. Sans clé.",
  },
  {
    ref: "kilo:nex-agi/nex-n2.5-mini:free",
    role: "second choix",
    evidence:
      "Durée, deux jours : 40/40 tours, 28 valides du premier coup — pile au seuil de 70 %, retenu de justesse (13/20 puis 15/20). Sans clé.",
  },
];

/** Le modèle des conseils quand rien n'est configuré : le principal. */
export const DEFAULT_COUNCIL_MODEL = STABLE_FREE_MODELS[0]!.ref;

/**
 * Les modèles gratuits retenus pour gouverner nos tests — et eux seuls.
 *
 * Tous les modèles gratuits trouvables ont été mesurés : 25 le 24 septembre chez
 * Nous et Kilo, puis 26 le même jour chez OpenRouter et Mistral (les modèles
 * locaux, écartés). Critères fixés AVANT la mesure, `docs/reports/banc-modeles.md` :
 *
 *  1. crible — répond à une petite requête ;
 *  2. banc apparié, 6 situations — au moins 5 réponses, 3 valides du premier
 *     coup, médiane de 20 s au plus ;
 *  3. durée, 20 tours consécutifs — 20/20 sans tour perdu, 14 valides du premier
 *     coup, 4 ordres rejetés au plus, médiane de 15 s au plus.
 *
 * Quatre entrées passaient, pour trois modèles distincts. `longcat-2.0`, longtemps
 * le défaut, n'en fait pas partie : il perd un tour sur sept en durée.
 *
 * `nex-n2.5-mini` en a été retiré le 26 septembre : il a quitté les catalogues
 * gratuits de Kilo et d'OpenRouter (HTTP 404 au deuxième tour d'une partie).
 * Un modèle gratuit peut disparaître sans prévenir ; la liste le suit.
 *
 * Changer cette liste, c'est la remesurer : `npm run bench:models`.
 */
export interface StableModel {
  ref: string;
  role: "principal" | "second choix" | "secours";
  /**
   * La variable qui porte la clé, ou `null` : sans clé. Le principal doit
   * l'être — c'est le défaut d'une installation où rien n'est configuré.
   */
  key: string | null;
  /**
   * Les conditions de la mesure. Le servir autrement, c'est servir un modèle
   * qui n'a pas été mesuré : `stable-models.test.ts` les confronte au produit.
   */
  measuredAs: { nativeSchema: boolean; reasoningOff: boolean };
  /** La mesure qui justifie sa place, pas une impression. */
  evidence: string;
}

export const STABLE_FREE_MODELS: readonly StableModel[] = [
  {
    ref: "kilo:dots-studio/dots-3-note-preview:free",
    role: "principal",
    key: null,
    measuredAs: { nativeSchema: true, reasoningOff: true },
    evidence:
      "Durée, deux jours : 40/40 tours, 37 valides du premier coup, 1 rejet. Campagne par le produit : 40/40 en 40 requêtes. Sans clé.",
  },
  {
    ref: "mistral:codestral-latest",
    role: "second choix",
    key: "MISTRAL_API_KEY",
    measuredAs: { nativeSchema: false, reasoningOff: false },
    evidence:
      "Banc : 6/6, 4 valides du premier coup. Durée : 20/20, 19 valides du premier coup, 0 rejet, médiane 5,1 s. Campagne par le produit : 12/12 servis par lui-même, 1 rejet. Un seul jour de mesure. Clé Mistral ; la gratuité tient au compte, non vérifiée côté facturation.",
  },
  {
    ref: "openrouter:dots-studio/dots-3-note-preview:free",
    role: "secours",
    key: "OPENROUTER_API_KEY",
    measuredAs: { nativeSchema: true, reasoningOff: true },
    evidence:
      "Le principal par une autre route, si la passerelle Kilo tombe — mais pas si l'hébergeur du modèle tombe : les deux routes aboutissent chez AtlasCloud, qui a refusé par intermittence (HTTP 400) un conseil de 12 000 jetons, identique par les deux. Durée : 20/20, 17 valides du premier coup, 1 rejet, médiane 1,3 s. Campagne par le produit : 12/12 servis par lui-même, 1 rejet. Clé OpenRouter, 1 000 requêtes gratuites par jour.",
  },
];

/** Le modèle des conseils quand rien n'est configuré : le principal. */
export const DEFAULT_COUNCIL_MODEL = STABLE_FREE_MODELS[0]!.ref;

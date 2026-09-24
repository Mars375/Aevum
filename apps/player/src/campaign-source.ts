import type { Campaign } from "../../../packages/world/src/campaign";

/**
 * D'où viennent les parties que l'observatoire montre.
 *
 * Deux sources, un même affichage. **Local** : le service de la machine, qui
 * crée les parties, les joue et tient les clés. **Public** : des fichiers
 * publiés à côté du site (`campaigns/index.json`, puis un fichier par partie),
 * qu'un hébergeur statique sert tels quels. Le site public ne peut rien
 * déclencher : aucun appel de modèle, aucune clé, aucun quota à protéger.
 *
 * Dans les deux cas la page reçoit la partie brute et la rejoue elle-même avec
 * le moteur qui l'a vécue — un affichage qui divergerait du moteur ne peut pas
 * exister. Le serveur, lui, envoyait ses états rejoués : 31,5 Mo pour une
 * partie de 480 tours dont le fichier fait 0,8 Mo.
 */
export interface LiveStatus {
  on: boolean;
  failures: number;
  nextAt: number | null;
  stopped: string | null;
}
export interface CampaignHead {
  turns: number;
  pending: number | null;
  busy: boolean;
  error: string | null;
  live: LiveStatus;
}
/** Une partie publiée, telle que `campaigns/index.json` la décrit. */
export interface PublishedCampaign {
  id: string;
  title: string;
  seed: number;
  version: string;
  mode: string;
  models: Record<string, string>;
  turns: number;
  maxTurns: number | null;
  /** Encore jouée par la machine qui la publie. */
  live: boolean;
  updatedAt: string;
  path: string;
}
export interface CampaignSource {
  kind: "local" | "public";
  /**
   * Regarder sans pouvoir jouer : le site public, ou le service local vu
   * depuis un autre appareil du réseau (`AEVUM_LAN=1`).
   */
  readOnly: boolean;
  campaign(id: string): Promise<Campaign>;
  head(id: string): Promise<CampaignHead>;
  /** Parties publiées ; vide pour le service local, qui a sa propre liste. */
  published(): Promise<PublishedCampaign[]>;
}

const HOSTS: Record<string, string> = {
  kilo: "Kilo",
  nous: "Nous",
  openrouter: "OpenRouter",
  mistral: "Mistral",
  groq: "Groq",
  nvidia: "NVIDIA",
};

/**
 * Un modèle tel qu'un lecteur le lit : `dots-3-note-preview (Kilo)` plutôt
 * que `kilo:dots-studio/dots-3-note-preview:free`. L'hébergeur reste dit :
 * le même modèle chez un autre n'a pas les mêmes résultats.
 */
export function modelLabel(ref: string): string {
  const colon = ref.indexOf(":");
  const prefix = colon > 0 ? ref.slice(0, colon) : "";
  const known = prefix in HOSTS;
  const id = known ? ref.slice(colon + 1) : ref;
  const name =
    id
      .replace(/:free$/, "")
      .split("/")
      .pop() ?? id;
  return `${name} (${known ? HOSTS[prefix] : "OpenRouter"})`;
}

const idle: LiveStatus = {
  on: false,
  failures: 0,
  nextAt: null,
  stopped: null,
};

/**
 * Lire du JSON, et seulement du JSON.
 *
 * Un hébergeur statique configuré en application (`try_files … /index.html`)
 * répond **200 avec la page HTML** pour un fichier absent : `res.ok` est vrai,
 * et c'est `res.json()` qui lève, loin de la cause. On regarde donc le type.
 */
async function json<T>(fetcher: typeof fetch, url: string): Promise<T> {
  const response = await fetcher(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} : HTTP ${response.status}`);
  if (!response.headers.get("content-type")?.includes("json"))
    throw new Error(`${url} : pas un fichier JSON (fichier absent ?)`);
  return (await response.json()) as T;
}

export function localSource(
  fetcher: typeof fetch = fetch,
  readOnly = false,
): CampaignSource {
  return {
    kind: "local",
    readOnly,
    campaign: (id) => json<Campaign>(fetcher, `/api/campaigns/${id}/export`),
    head: (id) => json<CampaignHead>(fetcher, `/api/campaigns/${id}/head`),
    published: async () => [],
  };
}

export function publicSource(
  base = "campaigns/",
  fetcher: typeof fetch = fetch,
): CampaignSource {
  const index = () =>
    json<PublishedCampaign[]>(fetcher, `${base}index.json`).then((entries) => {
      if (!Array.isArray(entries))
        throw new Error("campaigns/index.json : une liste était attendue");
      return entries;
    });
  const entry = async (id: string) => {
    const found = (await index()).find((candidate) => candidate.id === id);
    if (!found) throw new Error(`Partie non publiée : ${id}`);
    return found;
  };
  return {
    kind: "public",
    readOnly: true,
    campaign: async (id) =>
      json<Campaign>(fetcher, `${base}${(await entry(id)).path}`),
    head: async (id) => {
      const found = await entry(id);
      return {
        turns: found.turns,
        pending: null,
        busy: false,
        error: null,
        live: { ...idle, on: found.live },
      };
    },
    published: index,
  };
}

/**
 * Le service local s'il répond, sinon les parties publiées.
 *
 * `/api/health` d'abord : sur un hébergeur statique il n'existe pas, et la
 * réponse est une erreur ou la page HTML — jamais `{ application: "aevum" }`.
 */
export async function detectSource(
  fetcher: typeof fetch = fetch,
): Promise<CampaignSource> {
  try {
    const health = await json<{ application?: string; readOnly?: boolean }>(
      fetcher,
      "/api/health",
    );
    if (health.application === "aevum")
      return localSource(fetcher, health.readOnly === true);
  } catch {
    // Pas de service local : on essaie la publication.
  }
  const published = publicSource(undefined, fetcher);
  await published.published();
  return published;
}

import { ReplaySchema } from "@abs/contracts";

export function replayUrlFromSearch(search: string): string | null {
  return new URLSearchParams(search).get("replay");
}

/**
 * Servi depuis un hébergeur statique, un JSON absent ne revient pas en 404.
 *
 * La règle `try_files $uri $uri/ /index.html` — celle de notre nginx, et le
 * défaut de la plupart des hébergeurs de page unique — renvoie la page de
 * l'application avec un code 200. `response.ok` est donc vrai, et c'est
 * `response.json()` qui échoue, sur « Unexpected token '<' ». Le lecteur lisait
 * alors que son fichier était corrompu, alors qu'il n'était simplement pas là.
 */
export class NotServed extends Error {
  constructor(readonly url: string) {
    super(`Aucune bataille n'est servie à ${url}`);
    this.name = "NotServed";
  }
}

export async function fetchReplay(url: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("text/html")) throw new NotServed(url);
  const body = await response.text();
  // Un serveur qui ne déclare pas son type peut tout de même rendre la page :
  // le premier caractère tranche sans avoir à analyser quoi que ce soit.
  if (body.trimStart().startsWith("<")) throw new NotServed(url);
  return JSON.parse(body);
}

export function parseReplay(raw: unknown) {
  return ReplaySchema.safeParse(raw);
}

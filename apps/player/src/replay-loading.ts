import { ReplaySchema } from "@abs/contracts";

export function replayUrlFromSearch(search: string): string | null {
  return new URLSearchParams(search).get("replay");
}

export async function fetchReplay(url: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export function parseReplay(raw: unknown) {
  return ReplaySchema.safeParse(raw);
}

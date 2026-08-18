/**
 * Recovering JSON from models that have no native structured-output mode.
 *
 * Only six of the sixteen free models advertise `response_format`. Requiring it
 * shrank the roster to two usable models and funnelled every general onto the
 * same one — defect D1 of the QA audit. The rest answer JSON perfectly well
 * when asked in the prompt; they just wrap it in a fence or a sentence.
 */

/** Scan for the first balanced {...}, ignoring braces inside strings. */
function firstBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Parse a model answer into an object, tolerating the three wrappers seen in
 * practice: bare JSON, a ```json fence, and JSON preceded or followed by prose.
 * Returns null when nothing parseable is present.
 */
export function extractJson(raw: string): unknown | null {
  const text = raw.trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    /* not bare JSON; keep going */
  }

  // ```json ... ``` or ``` ... ```
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fenced content was not JSON either */
    }
  }

  const balanced = firstBalancedObject(text);
  if (balanced) {
    try {
      return JSON.parse(balanced);
    } catch {
      /* give up below */
    }
  }
  return null;
}

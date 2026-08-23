/** Secret-boundary scanning shared by the release verifier and CI.
 *
 * One pattern list, two modes: `--tree` scans every tracked text-like file of
 * the checkout (binary content is skipped by sniffing, not by an extension
 * allowlist — the extension list was the first version and it silently missed
 * `.env.*`, `.txt` and `.tsx`), and `--diff <file>` scans the added lines of a
 * unified diff so a push or pull request is judged on what it introduces while
 * the tree scan keeps judging what is already committed.
 *
 * A finding prints the file path and the pattern name, never the matched
 * value: echoing the secret would turn the scanner into the leak.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface SecretPattern {
  name: string;
  pattern: RegExp;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  { name: "openrouter-token", pattern: /sk-or-v1-[A-Za-z0-9_-]{20,}/ },
  { name: "groq-token", pattern: /gsk_[A-Za-z0-9_-]{20,}/ },
  { name: "nvidia-token", pattern: /nvapi-[A-Za-z0-9_-]{20,}/ },
  // Generic provider assignment: ANY_PROVIDER_API_KEY/TOKEN/SECRET/PASSWORD
  // followed by a literal value. The lookahead rejects template placeholders
  // (${}, <...>), documentation ellipses and known dummy words so that
  // .env.example and test sentinels stay scannable without being findings.
  {
    name: "provider-secret-assignment",
    pattern: /\b[A-Z][A-Z0-9_]{1,48}_(?:API_?KEY|TOKEN|SECRET|PASSWORD)\b\s*[:=]\s*["']?(?!\$\{|\$\(|%|<|\.\.\.|your[-_]|replace[-_]|example|changeme|change-me|dummy|placeholder|sentinel|xxx)[^\s"']{16,}/i,
  },
];

/** Names of the patterns matching this text. The matched text itself never leaves this file. */
export function matchSecretNames(text: string): string[] {
  return SECRET_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
}

/** Files whose decoded content matches at least one pattern; paths only, no values. */
export function findSecretLeaks(files: string[]): string[] {
  return files.filter((path) => {
    const text = readFileSync(path, "utf8");
    return SECRET_PATTERNS.some(({ pattern }) => pattern.test(text));
  });
}

/**
 * A tracked file is scanned when it behaves like text: no NUL byte anywhere in
 * its first kilobyte and no U+FFFD when decoded as UTF-8. This is heuristic on
 * purpose — a secret pasted into an unrecognised extension must still be seen,
 * which is exactly what the old extension allowlist could not do.
 */
export function decodeTextLike(buffer: Buffer): string | null {
  const head = buffer.subarray(0, 1024);
  if (head.includes(0)) return null;
  const text = buffer.toString("utf8");
  return text.includes("\uFFFD") ? null : text;
}

export function addedLines(diffText: string): string {
  return diffText
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");
}

function trackedFiles(root: string): string[] {
  const output = execFileSync("git", ["ls-files", "-z"], { cwd: root });
  return output.toString("utf8").split("\0").filter(Boolean).map((path) => resolve(root, path));
}

/** Every tracked file whose content behaves like text (see decodeTextLike). */
export function trackedTextFiles(root: string): string[] {
  return trackedFiles(root).filter((path) => {
    try {
      return decodeTextLike(readFileSync(path)) !== null;
    } catch {
      return false;
    }
  });
}

export function scanTrackedTree(root: string): Array<{ path: string; names: string[] }> {
  const findings: Array<{ path: string; names: string[] }> = [];
  for (const path of trackedFiles(root)) {
    let buffer: Buffer;
    try {
      buffer = readFileSync(path);
    } catch {
      continue;
    }
    const text = decodeTextLike(buffer);
    if (text === null) continue;
    const names = matchSecretNames(text);
    if (names.length > 0) findings.push({ path: relative(root, path), names });
  }
  return findings;
}

export function scanDiffFile(root: string, diffPath: string): Array<{ path: string; names: string[] }> {
  const names = matchSecretNames(addedLines(readFileSync(diffPath, "utf8")));
  return names.length > 0 ? [{ path: `${relative(root, diffPath)} (added lines)`, names }] : [];
}

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, "..");
  const args = process.argv.slice(2);
  let findings: Array<{ path: string; names: string[] }> = [];
  if (args[0] === "--tree") {
    findings = scanTrackedTree(root);
  } else if (args[0] === "--diff" && args[1]) {
    findings = scanDiffFile(root, resolve(args[1]));
  } else {
    console.error("usage: node --import tsx scripts/secrets.ts --tree | --diff <unified-diff-file>");
    process.exitCode = 2;
    return;
  }
  for (const finding of findings) {
    for (const name of finding.names) {
      console.error(`secret-like pattern (${name}) found in ${finding.path} — value redacted`);
    }
  }
  if (findings.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

/** Reproducible headless-browser QA for the built Aevum player.
 *
 * Why this exists: the first Season 1 candidate recorded viewport and
 * reduced-motion observations from a one-session `headless_shell` run, and an
 * independent review rejected them as release evidence — nothing in the commit
 * could replay them, and component tests were quietly standing in for browser
 * facts. This script is the replayable path: it drives real Chromium over CDP
 * (Node's own WebSocket client — no runtime dependency) against
 * `apps/player/dist`, and it can only pass by observing the browser.
 *
 * It fails loudly when no Chromium is available. A missing browser is never a
 * pass, and neither is a green component test.
 *
 * Usage: npm run player:build && npm run qa:browser
 * Env:   AEVUM_CHROMIUM=/path/to/chromium overrides discovery.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "apps/player/dist");
const VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 900, height: 800 },
  { width: 1440, height: 900 },
];
/** Endpoints the app fetches and treats as absent-by-design; their 404 is documented behaviour. */
const OPTIONAL_PATHS = new Set(["/replays/index.json", "/worlds/status.json"]);

/** Bound on every CDP exchange. Learned from the first replay attempt: this
 * host's Chromium accepts the DevTools handshake yet never completes a local
 * navigation, and an unbounded Page.navigate hung QA forever. A fast honest
 * failure is the required behaviour; a timeout is never converted into a pass. */
const CDP_TIMEOUT_MS = 8_000;

function cdpTimeout(method: string): Error {
  return new Error(`${method} timed out after ${CDP_TIMEOUT_MS}ms`);
}

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

function findChromium(): string | null {
  const candidates = [
    process.env.AEVUM_CHROMIUM,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/snap/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter((candidate): candidate is string => !!candidate && existsSync(candidate));
  if (candidates.length > 0) return candidates[0]!;
  const playwrightCache = resolve(process.env.HOME ?? tmpdir(), ".cache/ms-playwright");
  if (!existsSync(playwrightCache)) return null;
  for (const directory of readdirSync(playwrightCache).sort().reverse()) {
    for (const suffix of ["chrome-linux/chrome", "chrome-linux/headless_shell"]) {
      const candidate = join(playwrightCache, directory, suffix);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

/** Only a regular file may be read raw. Learned in CI (commit 2ba9d90): the
 * root request `/` resolved to DIST itself, which passes existsSync yet makes
 * readFileSync throw EISDIR. A directory counts as absent, so extensionless
 * directory/root requests fall through to the index.html fallback below. */
function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Static file server for dist; during QA this harness is the page's whole internet. */
function serveDist(): Promise<{ port: number; close: () => void }> {
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    // Cosmetic auto-request of every browser; served here so the harness stays
    // quiet about a polish gap that belongs to another task.
    if (url.pathname === "/favicon.ico") {
      response.writeHead(204).end();
      return;
    }
    let path = join(DIST, decodeURIComponent(url.pathname));
    if ((!isFile(path) || !path.startsWith(DIST)) && !extname(path)) path = join(DIST, "index.html");
    if (isFile(path) && path.startsWith(DIST)) {
      response.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
      response.end(readFileSync(path));
    } else {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolvePromise({
        port: typeof address === "object" && address ? address.port : 0,
        // closeAllConnections: a keep-alive socket from the browser would
        // otherwise hold server.open and the event loop open past cleanup.
        close: () => {
          server.close();
          server.closeAllConnections();
        },
      });
    });
  });
}

/** Minimal CDP session over Node's built-in WebSocket client. */
class Cdp {
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  private listeners = new Map<string, Array<(params: any) => void>>();
  /** Every session event since the last navigation, for request/console audits. */
  readonly events: Array<{ method: string; params: any }> = [];

  private constructor(private socket: WebSocket, readonly sessionId: string) {
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as any;
      if (message.id !== undefined) {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(`${message.error.message} ${message.error.data ?? ""}`));
        else entry.resolve(message.result);
      } else if (message.method) {
        this.events.push({ method: message.method, params: message.params });
        for (const listener of this.listeners.get(message.method) ?? []) listener(message.params);
      }
    });
  }

  static async attach(wsUrl: string): Promise<Cdp> {
    const socket = new WebSocket(wsUrl);
    try {
      // Bounded open: an endpoint that accepts the TCP handshake but never
      // completes the upgrade must fail fast instead of hanging the run.
      await new Promise((resolvePromise, rejectPromise) => {
        const timer = setTimeout(
          () => rejectPromise(new Error(`CDP websocket open timed out after ${CDP_TIMEOUT_MS}ms: ${wsUrl}`)),
          CDP_TIMEOUT_MS,
        );
        socket.addEventListener("open", () => {
          clearTimeout(timer);
          resolvePromise(null);
        }, { once: true });
        socket.addEventListener("error", () => {
          clearTimeout(timer);
          rejectPromise(new Error(`CDP websocket refused ${wsUrl}`));
        }, { once: true });
      });
      const targetId = (await Cdp.roundTrip(socket, "Target.createTarget", { url: "about:blank" })).targetId;
      const { sessionId } = await Cdp.roundTrip(socket, "Target.attachToTarget", { targetId, flatten: true });
      return new Cdp(socket, sessionId);
    } catch (error) {
      try {
        socket.close();
      } catch {
        // A socket that never opened cannot be closed; the original error matters more.
      }
      throw error;
    }
  }

  private static roundTrip(socket: WebSocket, method: string, params: Record<string, unknown>): Promise<any> {
    return new Promise((resolvePromise, rejectPromise) => {
      const id = Math.floor(Math.random() * 1e9);
      const handler = (event: MessageEvent) => {
        const message = JSON.parse(String(event.data)) as any;
        if (message.id !== id) return;
        clearTimeout(timer);
        socket.removeEventListener("message", handler);
        if (message.error) rejectPromise(new Error(message.error.message));
        else resolvePromise(message.result);
      };
      const timer = setTimeout(() => {
        socket.removeEventListener("message", handler);
        rejectPromise(cdpTimeout(method));
      }, CDP_TIMEOUT_MS);
      socket.addEventListener("message", handler);
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolvePromise, rejectPromise) => {
      // The timer lives inside the pending entry so close() rejects it too:
      // no command may outlive the session.
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectPromise(cdpTimeout(method));
      }, CDP_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolvePromise(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          rejectPromise(error);
        },
      });
      this.socket.send(JSON.stringify({ id, method, params, sessionId: this.sessionId }));
    });
  }

  waitFor(method: string): Promise<any> {
    return new Promise((resolvePromise, rejectPromise) => {
      const listener = (params: any) => {
        clearTimeout(timer);
        const list = this.listeners.get(method) ?? [];
        this.listeners.set(method, list.filter((entry) => entry !== listener));
        resolvePromise(params);
      };
      const timer = setTimeout(() => {
        const list = this.listeners.get(method) ?? [];
        this.listeners.set(method, list.filter((entry) => entry !== listener));
        rejectPromise(new Error(`${method} never fired within ${CDP_TIMEOUT_MS}ms`));
      }, CDP_TIMEOUT_MS);
      this.listeners.set(method, [...(this.listeners.get(method) ?? []), listener]);
    });
  }

  close(): void {
    // Reject in-flight commands first: a dangling promise would hang the run
    // even with the socket gone.
    const pending = [...this.pending.values()];
    this.pending.clear();
    for (const entry of pending) entry.reject(new Error("CDP session closed with commands in flight"));
    try {
      this.socket.close();
    } catch {
      // A socket that died mid-session cannot be closed twice; nothing to save.
    }
  }
}

async function evaluate<T>(cdp: Cdp, expression: string): Promise<T> {
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(`page evaluation failed: ${result.exceptionDetails.text} ${result.exceptionDetails.exception?.description ?? ""}`);
  }
  return result.result.value as T;
}

async function pressKey(cdp: Cdp, key: string, code: string, virtual: number): Promise<void> {
  for (const type of ["keyDown", "keyUp"]) {
    await cdp.send("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: virtual, nativeVirtualKeyCode: virtual });
  }
}

async function clickElement(cdp: Cdp, selector: string): Promise<boolean> {
  const centre = await evaluate<{ x: number; y: number } | null>(cdp, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!centre) return false;
  for (const type of ["mousePressed", "mouseReleased"]) {
    await cdp.send("Input.dispatchMouseEvent", { type, x: centre.x, y: centre.y, button: "left", clickCount: 1 });
  }
  return true;
}

interface RequestAudit {
  total: number;
  external: string[];
  broken: string[];
}

function auditRequestEvents(cdp: Cdp, port: number): RequestAudit {
  const requests = cdp.events.filter((event) => event.method === "Network.requestWillBeSent");
  const external = requests
    .map((event) => String(event.params.request.url))
    .filter((url) => !url.startsWith(`http://127.0.0.1:${port}/`) && !url.startsWith("data:"));
  const broken = cdp.events.filter((event) => event.method === "Network.loadingFailed")
    .map((event) => `loadingFailed: ${event.params.errorText}`)
    .concat(cdp.events.filter((event) => event.method === "Network.responseReceived" && event.params.response.status >= 400)
      .map((event) => `${event.params.response.status} ${event.params.response.url}`)
      .filter((entry) => !OPTIONAL_PATHS.has(new URL(entry.split(" ")[1]!).pathname)));
  return { total: requests.length, external, broken };
}

function requestChecks(audit: RequestAudit, label: string): Check[] {
  return [
    {
      name: `${label}: no external request`,
      ok: audit.external.length === 0,
      detail: audit.external.length ? audit.external.join(", ") : `${audit.total} requests, all local`,
    },
    {
      name: `${label}: no failed or errored request`,
      ok: audit.broken.length === 0,
      detail: audit.broken.length ? audit.broken.join(", ") : undefined,
    },
  ];
}

async function openChronicle(cdp: Cdp, base: string): Promise<void> {
  const loaded = cdp.waitFor("Page.loadEventFired");
  // Marked handled immediately, not in a finally: if navigation stalls, `loaded`
  // rejects while this function still awaits Page.navigate, and a deferred
  // attachment loses the race against Node's unhandled-rejection check.
  loaded.catch(() => {});
  cdp.events.length = 0;
  await cdp.send("Page.navigate", { url: base });
  await loaded;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await evaluate<boolean>(cdp, "!!document.querySelector('.chronicle')")) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("the chronicle never rendered within 10s");
}

async function capture(cdp: Cdp, label: string): Promise<Check> {
  const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  const directory = join(tmpdir(), "aevum-browser-qa");
  mkdirSync(directory, { recursive: true });
  const file = join(directory, `${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`);
  writeFileSync(file, Buffer.from(shot.data, "base64"));
  return { name: `${label}: screenshot captured`, ok: true, detail: file };
}

async function auditViewport(
  cdp: Cdp,
  base: string,
  viewport: { width: number; height: number },
  options: { reducedMotion?: boolean } = {},
): Promise<Check[]> {
  const label = `${viewport.width}px${options.reducedMotion ? " reduced-motion" : ""}`;
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 500,
  });
  await cdp.send("Emulation.setEmulatedMedia", {
    features: options.reducedMotion ? [{ name: "prefers-reduced-motion", value: "reduce" }] : [],
  });

  await openChronicle(cdp, base);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));

  const checks: Check[] = [];
  const brand = (await evaluate<string>(cdp, "document.querySelector('h1')?.textContent ?? ''")).trim();
  checks.push({ name: `${label}: Aevum identity rendered`, ok: brand.includes("Aevum"), detail: brand });

  const overflow = await evaluate<string | null>(cdp, `(() => {
    const doc = document.scrollingElement;
    if (!doc) return 'no scrolling element';
    return doc.scrollWidth > doc.clientWidth + 1 ? \`scrollWidth \${doc.scrollWidth} > clientWidth \${doc.clientWidth}\` : null;
  })()`);
  checks.push({ name: `${label}: no horizontal overflow`, ok: overflow === null, detail: overflow ?? "document fits its viewport" });

  const consoleErrors = cdp.events
    .filter((event) => event.method === "Runtime.exceptionThrown"
      || (event.method === "Runtime.consoleAPICalled" && event.params.type === "error")
      || (event.method === "Log.entryAdded" && event.params.entry.level === "error"))
    .map((event) => JSON.stringify(event.params).slice(0, 200));
  checks.push({
    name: `${label}: no console error`,
    ok: consoleErrors.length === 0,
    detail: consoleErrors.length ? consoleErrors.join(" | ") : undefined,
  });
  checks.push(...requestChecks(auditRequestEvents(cdp, Number(new URL(base).port)), label));

  if (options.reducedMotion) {
    const honored = await evaluate<boolean>(cdp, "matchMedia('(prefers-reduced-motion: reduce)').matches");
    checks.push({ name: `${label}: prefers-reduced-motion active in the page`, ok: honored });
  }
  checks.push(await capture(cdp, label));
  return checks;
}

async function auditInteractions(cdp: Cdp, base: string, port: number): Promise<Check[]> {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Emulation.setEmulatedMedia", { features: [] });
  await openChronicle(cdp, base);

  const checks: Check[] = [];

  // Keyboard: focus walks into the main navigation, then Enter activates a tab,
  // like a reader who never touches the mouse.
  await pressKey(cdp, "Tab", "Tab", 9);
  await pressKey(cdp, "Tab", "Tab", 9);
  const focusTag = await evaluate<string>(cdp, "document.activeElement?.tagName ?? 'none'");
  const focusLabel = await evaluate<string>(cdp, "document.activeElement?.textContent?.trim() ?? ''");
  checks.push({ name: "keyboard: Tab reaches the navigation buttons", ok: focusTag === "BUTTON", detail: `${focusTag} "${focusLabel}"` });
  await pressKey(cdp, "Enter", "Enter", 13);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  const deck = (await evaluate<string>(cdp, "document.querySelector('.section-deck')?.textContent ?? ''")).trim();
  checks.push({ name: "keyboard: Enter switches section", ok: deck.includes("ARCHIVES"), detail: deck });

  await openChronicle(cdp, base);

  // Profile: one civilisation card opens the profile view.
  await clickElement(cdp, ".profile-link");
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  checks.push({
    name: "profile: card opens the civilisation profile",
    ok: await evaluate<boolean>(cdp, "!!document.querySelector('.profile-shell')"),
  });

  // Metric picker: aria-pressed must follow the selection.
  const pressedBefore = await evaluate<string | null>(cdp, `document.querySelector('.metric-picker button[aria-pressed="true"]')?.textContent?.trim() ?? null`);
  await clickElement(cdp, ".metric-picker button:nth-child(2)");
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  const pressedAfter = await evaluate<string | null>(cdp, `document.querySelector('.metric-picker button[aria-pressed="true"]')?.textContent?.trim() ?? null`);
  checks.push({
    name: "metric: picker selection moves",
    ok: !!pressedBefore && !!pressedAfter && pressedBefore !== pressedAfter,
    detail: `"${pressedBefore}" -> "${pressedAfter}"`,
  });

  // Auditable source: a seek button carries the year it witnesses. The scripted
  // era publishes no per-model curve, so DecisionSources is empty by design and
  // the sources live in the turning points and the register.
  await clickElement(cdp, ".profile-shell .history button");
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  const yearBefore = (await evaluate<string>(cdp, "document.querySelector('.chronicle p.live')?.textContent ?? ''")).trim();
  const clicked = await evaluate<string | null>(cdp, `(() => {
    const button = document.querySelector('.sources button[data-tick], .register details:not([open]) summary, .register .jump');
    if (!button) return null;
    if (button.tagName === 'SUMMARY') { (button.parentElement as HTMLDetailsElement).open = true; return 'registre ouvert'; }
    button.click();
    return button.textContent.trim() + ' · ' + button.className;
  })()`);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  const yearAfter = (await evaluate<string>(cdp, "document.querySelector('.chronicle p.live')?.textContent ?? ''")).trim();
  const searchYear = await evaluate<string | null>(cdp, "new URLSearchParams(location.search).get('annee')");
  checks.push({
    name: "source: seeking lands on the cited year",
    ok: !!clicked && yearBefore !== yearAfter && /^An \d/.test(yearAfter),
    detail: `control=${clicked ?? "none"} · "${yearBefore}" -> "${yearAfter}" · annee=${searchYear ?? "absent"}`,
  });
  checks.push(...requestChecks(auditRequestEvents(cdp, port), "interactions"));
  return checks;
}

/** Kill the browser outright: a hung Chromium must never outlive the QA run.
 * Learned on this host: /usr/bin/chromium is a wrapper whose grandchild browser
 * survives any signal sent to the direct child alone, so the whole process
 * group is signalled — SIGTERM first, then SIGKILL, which cannot be declined. */
async function stopChrome(chrome: ChildProcess | null): Promise<void> {
  if (!chrome || chrome.pid === undefined) return;
  const signalGroup = (signal: NodeJS.Signals): boolean => {
    try {
      process.kill(-chrome.pid!, signal);
      return true;
    } catch {
      // No such group: everything already died with the wrapper.
      return false;
    }
  };
  if (chrome.exitCode === null && chrome.signalCode === null) {
    signalGroup("SIGTERM");
    if (!(await exitsWithin(chrome, 1_000))) signalGroup("SIGKILL");
    await exitsWithin(chrome, 1_000);
  }
  // The wrapper can exit politely while its grandchild browser survives it;
  // sweep whatever remains of the group either way.
  signalGroup("SIGKILL");
  // Destroying the stderr pipe unblocks the event loop even if some exit
  // event is still in flight.
  chrome.stderr?.destroy();
}

function exitsWithin(chrome: ChildProcess, ms: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const onExit = () => {
      clearTimeout(timer);
      resolvePromise(true);
    };
    const timer = setTimeout(() => {
      chrome.off("exit", onExit);
      resolvePromise(false);
    }, ms);
    chrome.once("exit", onExit);
  });
}

async function main(): Promise<void> {
  const failures: string[] = [];
  const record = (checks: Check[]) => {
    for (const check of checks) {
      console.log(`${check.ok ? "ok  " : "FAIL"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
      if (!check.ok) failures.push(check.name);
    }
  };

  if (!existsSync(join(DIST, "index.html"))) {
    console.error("browser QA cannot run: apps/player/dist/index.html is missing — run `npm run player:build` first.");
    process.exitCode = 1;
    return;
  }
  const executable = findChromium();
  if (!executable) {
    console.error(
      "browser QA cannot pass: no Chromium found. Install chromium/google-chrome, point AEVUM_CHROMIUM at a binary,"
        + " or populate the Playwright cache. A missing browser is reported as a failure, never as a pass.",
    );
    process.exitCode = 1;
    return;
  }
  console.log(`chromium: ${executable}`);

  const { port, close } = await serveDist();
  const base = `http://127.0.0.1:${port}/`;
  const profileDir = join(tmpdir(), "aevum-chromium-profile");
  rmSync(profileDir, { recursive: true, force: true });
  let chrome: ChildProcess | null = null;
  let cdp: Cdp | null = null;
  let aborted: unknown = null;
  try {
    let exposeWsUrl: ((wsUrl: string) => void) | null = null;
    const wsUrl = new Promise<string>((resolvePromise, rejectPromise) => {
      setTimeout(() => rejectPromise(new Error(`Chromium never exposed a DevTools endpoint within ${CDP_TIMEOUT_MS}ms`)), CDP_TIMEOUT_MS).unref();
      exposeWsUrl = resolvePromise;
    });
    chrome = spawn(executable, [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe"], detached: true });
    chrome.stderr!.setEncoding("utf8");
    chrome.stderr!.on("data", (chunk: string) => {
      const match = chunk.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match && exposeWsUrl) exposeWsUrl(match[1]!);
    });

    cdp = await Cdp.attach(await wsUrl);
    // Concurrent enables keep this phase inside one timeout window instead of
    // four; a silent transport then fails in ~8s rather than ~32s.
    await Promise.all(["Page.enable", "Runtime.enable", "Network.enable", "Log.enable"].map((method) => cdp!.send(method)));

    for (const viewport of VIEWPORTS) record(await auditViewport(cdp, base, viewport));
    record(await auditViewport(cdp, base, VIEWPORTS[0]!, { reducedMotion: true }));
    record(await auditInteractions(cdp, base, port));
  } catch (error) {
    aborted = error;
  } finally {
    cdp?.close();
    await stopChrome(chrome);
    close();
    rmSync(profileDir, { recursive: true, force: true });
  }

  if (aborted !== null) {
    console.error(`browser QA failed before completing all checks: ${aborted instanceof Error ? aborted.message : String(aborted)}`);
    process.exitCode = 1;
    return;
  }
  if (failures.length > 0) {
    console.error(`browser QA FAILED: ${failures.length} check(s): ${failures.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("browser QA: all checks passed against the built player.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

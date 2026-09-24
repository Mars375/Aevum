/**
 * render-icons — les images de l'application, rendues depuis une seule source.
 *
 * \`packaging/msix/icon.svg\` est la seule icône : le Store demande des PNG à
 * plusieurs tailles, le site une icône d'onglet. Les rendre à la main, c'est
 * les laisser diverger. Chrome (celui des contrôles navigateur) les rend ici,
 * fond transparent.
 */
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  mkdtempSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Cdp, findChromium, spawnChromium, stopChrome } from "./browser-qa.js";

const svg = readFileSync(resolve("packaging/msix/icon.svg"), "utf8");
const out = resolve("packaging/msix/Assets");
mkdirSync(out, { recursive: true });
/** [fichier, largeur, hauteur] — tailles demandées par le manifeste MSIX. */
const TARGETS: [string, number, number][] = [
  ["Square44x44Logo.png", 44, 44],
  ["Square44x44Logo.targetsize-256.png", 256, 256],
  ["Square150x150Logo.png", 150, 150],
  ["StoreLogo.png", 50, 50],
  ["Wide310x150Logo.png", 310, 150],
];
const executable = findChromium();
if (!executable) throw new Error("Chromium introuvable");
const launched = spawnChromium(
  executable,
  mkdtempSync(join(tmpdir(), "aevum-icons-")),
);
try {
  const cdp = await Cdp.attach(await launched.wsUrl);
  await cdp.send("Page.enable");
  await cdp.send("Emulation.setDefaultBackgroundColorOverride", {
    color: { r: 0, g: 0, b: 0, a: 0 },
  });
  for (const [file, width, height] of TARGETS) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const side = Math.min(width, height);
    // La large reprend l'icône centrée sur le fond du jeu.
    const body =
      width === height
        ? svg.replace("<svg ", `<svg width="${side}" height="${side}" `)
        : `<div style="width:${width}px;height:${height}px;background:#1c2f28;display:flex;align-items:center;justify-content:center">${svg.replace("<svg ", `<svg width="${side * 0.8}" height="${side * 0.8}" `)}</div>`;
    const html = `<!doctype html><html><body style="margin:0;overflow:hidden;background:transparent"><style>svg{display:block}</style>${body}</body></html>`;
    const loaded = cdp.waitFor("Page.loadEventFired");
    loaded.catch(() => {});
    await cdp.send("Page.navigate", {
      url: `data:text/html;base64,${Buffer.from(html).toString("base64")}`,
    });
    await loaded;
    const shot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      clip: { x: 0, y: 0, width, height, scale: 1 },
    });
    writeFileSync(join(out, file), Buffer.from(shot.data, "base64"));
    console.log(`${file} ${width}×${height}`);
  }
} finally {
  await stopChrome(launched.chrome);
}
// L'onglet du site : la même icône, en SVG.
copyFileSync(
  resolve("packaging/msix/icon.svg"),
  resolve("apps/player/public/favicon.svg"),
);
console.log("apps/player/public/favicon.svg");

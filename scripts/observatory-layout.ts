/**
 * observatory-layout — les panneaux flottants de l'observatoire se recouvrent-ils ?
 *
 * L'observatoire pose ses panneaux en position absolue, palier par palier :
 * bulletin de crise, barre d'outils de la carte, contrôles de tour, dirigeants,
 * trajet. Un décalage de quelques pixels suffit à cacher un bouton, et aucun
 * test ne le voit. Mesuré le 23 septembre : entre 721 et 1100 px la prévision
 * cachait « Carte 2D », « Ordres » et « + » ; entre 1101 et 1250 px bulletin et
 * outils passaient sous les contrôles ; sous 720 px le bulletin mordait sur les
 * outils ; sous 411 px les outils disparaissaient de 41 px sous les contrôles.
 *
 * `npm run qa:browser` ne peut pas le mesurer : il sert le lecteur sans API, et
 * l'observatoire n'y montre que son aperçu initial — sans bulletin, avec des
 * contrôles moins hauts. Vérifié en réintroduisant les défauts : il passait.
 * Cette sonde mesure donc une vraie campagne, servie par le vrai serveur.
 *
 * Usage : npm run spectator:server   (dans un autre terminal)
 *         npm run qa:observatory -- [campagne] [adresse du serveur]
 * Le bulletin n'existe que si la campagne a une crise annoncée ou en cours ;
 * la sonde dit quand il est absent, parce qu'une largeur sans bulletin ne
 * prouve rien sur lui.
 */
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Cdp,
  evaluate,
  findChromium,
  overlapProbe,
  spawnChromium,
  stopChrome,
} from "./browser-qa.js";

const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const CAMPAIGN = positional[0] ?? "agreements-local-42";
const SERVER =
  positional[1] ?? `http://127.0.0.1:${process.env.AEVUM_PORT ?? 5174}`;
/** Chaque frontière de palier, des deux côtés, et les largeurs courantes. */
const WIDTHS = [
  360, 390, 410, 411, 420, 421, 600, 720, 721, 820, 1000, 1100, 1101, 1180,
  1250, 1251, 1289, 1440,
];
const FLOATING_PANELS = [
  ".world-bulletin:not(.quiet)",
  ".observatory .map-tools",
  ".turn-controls",
  ".ruler-dock",
  ".route-caption",
];

async function main() {
  try {
    const health = await fetch(`${SERVER}/api/health`);
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
  } catch (error) {
    console.error(
      `observatoire injoignable sur ${SERVER} (${error instanceof Error ? error.message : String(error)}). ` +
        "Lancez npm run spectator:server ; une sonde sans page à mesurer échoue, elle ne passe pas.",
    );
    process.exitCode = 1;
    return;
  }
  const executable = findChromium();
  if (!executable) {
    console.error(
      "aucun Chromium trouvé ; AEVUM_CHROMIUM peut en désigner un.",
    );
    process.exitCode = 1;
    return;
  }

  const profileDir = join(tmpdir(), "aevum-observatory-profile");
  rmSync(profileDir, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200,
  });
  const launched = spawnChromium(executable, profileDir);
  let cdp: Cdp | null = null;
  const failures: string[] = [];
  let bulletinSeen = 0;
  try {
    cdp = await Cdp.attach(await launched.wsUrl);
    await Promise.all(
      ["Page.enable", "Runtime.enable"].map((m) => cdp!.send(m)),
    );
    const url = `${SERVER}/?campaign=${encodeURIComponent(CAMPAIGN)}`;
    for (const width of WIDTHS) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: width < 500,
      });
      const loaded = cdp.waitFor("Page.loadEventFired");
      loaded.catch(() => {});
      await cdp.send("Page.navigate", { url });
      await loaded;
      const deadline = Date.now() + 15_000;
      let ready = false;
      while (!ready && Date.now() < deadline) {
        // L'aperçu initial s'affiche avant que la campagne soit chargée et
        // rejouée. Attendre les seuls contrôles mesurait parfois l'aperçu, et le
        // bulletin semblait absent à huit largeurs sur dix-huit d'une même
        // partie. `textContent`, et non `innerText` : la mention est dans un
        // panneau masqué aux petites largeurs, mais retirée du DOM au chargement.
        ready = await evaluate<boolean>(
          cdp,
          "!!document.querySelector('.observatory .turn-controls') && !document.querySelector('.map-loading') && !document.body.textContent.includes('Aperçu initial')",
        );
        if (!ready) await new Promise((r) => setTimeout(r, 250));
      }
      if (!ready) {
        failures.push(`${width} px : observatoire non rendu`);
        console.log(`${String(width).padStart(5)} px  NON RENDU en 15 s`);
        continue;
      }
      await new Promise((r) => setTimeout(r, 500));
      const overlap = await evaluate<string | null>(
        cdp,
        overlapProbe(FLOATING_PANELS),
      );
      const overflow = await evaluate<string | null>(
        cdp,
        "document.documentElement.scrollWidth > innerWidth + 1 ? `document ${document.documentElement.scrollWidth} px pour ${innerWidth}` : null",
      );
      const bulletin = await evaluate<boolean>(
        cdp,
        "!!document.querySelector('.world-bulletin:not(.quiet)')",
      );
      if (bulletin) bulletinSeen++;
      const problems = [
        overlap && `chevauche : ${overlap}`,
        overflow && `déborde : ${overflow}`,
      ].filter(Boolean);
      if (problems.length)
        failures.push(`${width} px : ${problems.join(" ; ")}`);
      console.log(
        `${String(width).padStart(5)} px  ${problems.length ? problems.join(" ; ") : "ok"}${bulletin ? "" : "   (sans bulletin)"}`,
      );
    }
  } finally {
    cdp?.close();
    await stopChrome(launched.chrome);
    try {
      rmSync(profileDir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
    } catch {
      // Un profil encore tenu ne doit pas masquer le verdict.
    }
  }

  console.log(
    `\n${WIDTHS.length} largeurs, campagne ${CAMPAIGN}, bulletin présent sur ${bulletinSeen}.`,
  );
  if (bulletinSeen === 0)
    console.log(
      "Aucun bulletin affiché : cette campagne ne dit rien de sa place. Choisissez-en une avec une crise annoncée.",
    );
  if (failures.length) {
    console.error(`ÉCHEC : ${failures.length} largeur(s).`);
    process.exitCode = 1;
  } else console.log("Aucun chevauchement, aucun débordement.");
}

await main();

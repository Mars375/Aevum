/**
 * Point d'entrée d'`Aevum.exe` — notre propre exécutable.
 *
 * Le paquet livrait `runtime/node.exe`, un serveur `.mjs` et un lanceur
 * `.cmd`. Rien de cela n'était signable par nous : `node.exe` porte déjà la
 * signature valide de l'OpenJS Foundation — la remplacer usurperait son
 * éditeur — et un fichier batch ne peut pas porter de signature Authenticode.
 * Un exécutable unique (`node --build-sea`) est à nous, et se signe.
 *
 * Ce fichier refait ce que faisait le lanceur, dans le même ordre, AVANT de
 * charger le serveur : l'import est dynamique exprès, parce qu'un import
 * statique serait évalué — et le serveur démarré — avant ces réglages.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { isSea } from "node:sea";

if (isSea()) {
  // Le serveur cherche le site et la démonstration dans le répertoire courant ;
  // un double-clic ne le fixe pas, le `cd /d "%~dp0"` du lanceur le faisait.
  process.chdir(dirname(process.execPath));
}

// Les parties vivent hors de l'installation, sinon remplacer ce dossier pour
// mettre à jour les effacerait. Une valeur déjà fixée par la machine gagne.
if (!process.env.AEVUM_DATA && process.env.LOCALAPPDATA)
  process.env.AEVUM_DATA = join(process.env.LOCALAPPDATA, "Aevum");
if (process.env.AEVUM_DATA && !existsSync(process.env.AEVUM_DATA))
  mkdirSync(process.env.AEVUM_DATA, { recursive: true });
process.env.AEVUM_PORT ??= "5174";

// Démarrage explicite : la garde « lancé directement » du serveur compare
// `import.meta.url` à argv[1], et dans l'exécutable `import.meta.url` est
// indéfini dans ce module chargé à la demande. Se fier à elle laissait le
// paquet se terminer aussitôt, en silence.
const { startServer } = await import("./spectator-server.js");
startServer();

/**
 * Le navigateur, une fois le serveur réellement en écoute — le lanceur
 * l'ouvrait avant, sur une page qui pouvait ne pas répondre encore.
 * `AEVUM_NO_BROWSER` sert à la vérification du paquet, qui démarre
 * l'exécutable sans ouvrir de fenêtre chez celui qui le construit.
 */
if (isSea() && !process.env.AEVUM_NO_BROWSER) {
  const address = `http://127.0.0.1:${process.env.AEVUM_PORT}`;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      if ((await fetch(`${address}/api/health`)).ok) {
        spawn("cmd", ["/c", "start", "", address], {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        }).unref();
        break;
      }
    } catch {
      /* pas encore en écoute */
    }
    await new Promise((done) => setTimeout(done, 250));
  }
}

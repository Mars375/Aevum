/**
 * package-app — une copie d'Aevum qui n'exige plus rien de la machine.
 *
 * Le lanceur actuel demande quatre choses a l'utilisateur, et chacune peut
 * echouer chez lui sans qu'on le sache : Node installe, un `npm ci` avec
 * Internet au premier demarrage, un build Vite a l'execution, et `tsx` pour
 * lire du TypeScript a chaud. Un double-clic qui installe des dependances
 * n'est pas un demarrage en un clic, c'est une installation deguisee.
 *
 * Ce script produit un dossier autonome : le site deja construit, le serveur
 * reduit a un seul fichier JavaScript, et une copie de l'interpreteur Node a
 * cote. Rien n'est telecharge au lancement, rien n'est compile.
 *
 * Il verifie ensuite ce qu'il vient de produire au lieu de l'affirmer : aucune
 * cle dans aucun fichier livre, la disposition attendue presente, et surtout le
 * serveur demarre pour de bon sur un port libre, sert le site, puis survit a
 * une fermeture brutale — celle que produit la fermeture de la fenetre. C'est
 * le REDEMARRAGE qui fait foi : un paquet qui ne repart pas n'est pas un
 * paquet, et c'est ce controle qui a trouve le verrou orphelin.
 *
 * Ce qu'il ne fait pas, et qu'il ne faut pas lui preter : il ne signe rien. Une
 * distribution signee demande un certificat qui n'a rien a faire dans un depot.
 * `docs/reports/distribution-autonome.md` dit ou s'arrete la garantie.
 */
import { spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { SECRET_PATTERNS } from "./secrets.js";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "dist-app");
const SERVER = "aevum-server.mjs";
const LAUNCHER = "Lancer Aevum.cmd";

/** Ce que le serveur lit au demarrage, releve a la main dans son code. */
const REQUIRED = [
  SERVER,
  LAUNCHER,
  "runtime/node.exe",
  "apps/player/dist/index.html",
  "examples/nous-discovery.json",
  "TIERS.txt",
];

const step = (message: string) => console.log(`  ${message}`);

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Un port que personne n'occupe, pour ne pas bousculer une instance ouverte. */
async function sparePort(): Promise<number> {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once("error", fail);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (typeof address === "string" || !address) {
        probe.close();
        fail(new Error("Port indisponible"));
        return;
      }
      const port = address.port;
      probe.close(() => done(port));
    });
  });
}

async function run(command: string, args: string[], cwd = ROOT): Promise<void> {
  const code = await new Promise<number>((done) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
      windowsHide: true,
    });
    child.once("exit", (value) => done(value ?? 1));
  });
  if (code !== 0) throw new Error(`${command} a echoue (${code})`);
}

// 1) Le site, construit une fois ici plutot qu'a chaque lancement chez l'autre.
if (!process.argv.includes("--skip-build")) {
  step("construction du site…");
  await run("npm", ["run", "player:build"]);
}
if (!existsSync(resolve(ROOT, "apps/player/dist/index.html")))
  throw new Error("Le site n'est pas construit : retirez --skip-build.");

step("preparation du dossier…");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// 2) Le serveur en un seul fichier : plus de tsx, plus de node_modules.
step("assemblage du serveur…");
await build({
  entryPoints: [resolve(ROOT, "scripts/spectator-server.ts")],
  outfile: resolve(OUT, SERVER),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // Le serveur ne demarre le service que si `import.meta.url` correspond a
  // process.argv[1]. esbuild conserve les deux en ESM, donc le paquet demarre
  // en etant simplement nomme, sans drapeau ni enveloppe.
  logLevel: "warning",
});

// 3) Ce que le serveur lit a l'execution, aux chemins ou il le cherche.
step("copie du site et de la demonstration…");
mkdirSync(resolve(OUT, "apps/player"), { recursive: true });
cpSync(resolve(ROOT, "apps/player/dist"), resolve(OUT, "apps/player/dist"), {
  recursive: true,
});
mkdirSync(resolve(OUT, "examples"), { recursive: true });
cpSync(
  resolve(ROOT, "examples/nous-discovery.json"),
  resolve(OUT, "examples/nous-discovery.json"),
);
// Rien d'ecrivable ne vit dans l'installation : les parties sont ailleurs,
// sinon remplacer ce dossier pour mettre a jour les effacerait.

// 4) L'interpreteur, pour que la machine d'en face n'ait rien a installer.
step("copie de l'interpreteur…");
mkdirSync(resolve(OUT, "runtime"), { recursive: true });
cpSync(process.execPath, resolve(OUT, "runtime/node.exe"));
writeFileSync(
  resolve(OUT, "TIERS.txt"),
  [
    `runtime/node.exe est une copie non modifiee de Node.js ${process.version},`,
    "distribuee sous licence MIT. Le texte de la licence n'accompagne pas",
    "l'executable sur cette installation ; il fait foi a l'adresse officielle",
    "https://github.com/nodejs/node/blob/main/LICENSE",
    "",
    "Aucune cle d'API n'est livree avec cette application. Les reglages Nous",
    "sont lus dans les variables d'environnement de la machine qui l'execute.",
    "",
  ].join("\n"),
);

// 5) Le double-clic. Il fixe le repertoire courant, parce que le serveur y
//    cherche le site et la demonstration — mais pas les parties, qui vivent
//    hors de l'installation pour survivre a son remplacement.
step("ecriture du lanceur…");
writeFileSync(
  resolve(OUT, LAUNCHER),
  [
    "@echo off",
    'cd /d "%~dp0"',
    "echo Demarrage d'Aevum...",
    // Les parties vivent hors de l'installation, sinon la remplacer pour
    // mettre a jour les effacerait.
    'if "%AEVUM_DATA%"=="" set AEVUM_DATA=%LOCALAPPDATA%\\Aevum',
    'if not exist "%AEVUM_DATA%" mkdir "%AEVUM_DATA%"',
    // Le port reste 5174 sauf si la machine en impose un autre, et le
    // navigateur doit ouvrir celui-la, pas une adresse sans port.
    'if "%AEVUM_PORT%"=="" set AEVUM_PORT=5174',
    'start "" "http://127.0.0.1:%AEVUM_PORT%"',
    `"%~dp0runtime\\node.exe" "%~dp0${SERVER}"`,
    "if errorlevel 1 pause",
    "",
  ].join("\r\n"),
);

// 6) Verifier au lieu d'affirmer.
step("verification de la disposition…");
const missing = REQUIRED.filter((path) => !existsSync(resolve(OUT, path)));
if (missing.length) throw new Error(`Absent du paquet : ${missing.join(", ")}`);

step("recherche de secrets dans le paquet…");
const files = walk(OUT);
const leaks: string[] = [];
for (const file of files) {
  // L'executable et les polices sont binaires : les lire en texte ne prouve
  // rien et produit du bruit. Le risque porte sur ce qu'on a genere.
  if (/\.(exe|woff2?|ttf|png|jpg|glb|bin)$/i.test(file)) continue;
  const content = readFileSync(file, "utf8");
  for (const { name, pattern } of SECRET_PATTERNS)
    // On nomme le fichier et le motif, jamais la valeur : afficher le secret
    // ferait du controle la fuite.
    if (pattern.test(content))
      leaks.push(`${file.slice(OUT.length + 1)} (${name})`);
}
if (leaks.length) {
  rmSync(OUT, { recursive: true, force: true });
  throw new Error(`Paquet detruit, secrets detectes : ${leaks.join(", ")}`);
}

/** Demarre le paquet comme un utilisateur le ferait, et attend sa reponse. */
async function boot(port: number, data: string) {
  const child = spawn(resolve(OUT, "runtime/node.exe"), [SERVER], {
    cwd: OUT,
    env: { ...process.env, AEVUM_PORT: String(port), AEVUM_DATA: data },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  const health = `http://127.0.0.1:${port}/api/health`;
  let ready = false;
  for (let attempt = 0; attempt < 40 && !ready; attempt++) {
    await new Promise((done) => setTimeout(done, 250));
    try {
      const response = await fetch(health, {
        signal: AbortSignal.timeout(1000),
      });
      ready = response.ok && (await response.json()).application === "aevum";
    } catch {
      /* pas encore en ecoute */
    }
  }
  return { child, ready, log: () => output };
}

/**
 * Arret tel qu'il se produit vraiment.
 *
 * Sous Windows, fermer la fenetre du lanceur n'envoie aucun signal : le
 * processus est termine, ses gestionnaires ne tournent pas. Verifier un arret
 * poli mesurerait donc une chose qui n'arrive jamais chez l'utilisateur.
 */
const abruptlyStop = async (child: ReturnType<typeof spawn>) => {
  child.kill();
  return new Promise<number | null>((done) =>
    child.once("exit", (value) => done(value)),
  );
};

step("demarrage reel du serveur empaquete…");
const port = await sparePort();
// Des donnees hors de l'installation, comme chez l'utilisateur : c'est ce qui
// permet de verifier qu'une mise a jour n'emporte pas les parties.
const data = mkdtempSync(join(tmpdir(), "aevum-paquet-"));
const first = await boot(port, data);
if (!first.ready) {
  first.child.kill();
  throw new Error(`Le paquet n'a pas repondu :\n${first.log()}`);
}
// Le site doit etre servi par le paquet lui-meme, pas seulement l'API : c'est
// la moitie qu'un build oublie le plus facilement.
const page = await fetch(`http://127.0.0.1:${port}/`);
const served = page.ok && (await page.text()).includes('<div id="app">');
if (!served) {
  first.child.kill();
  throw new Error("Le paquet repond mais ne sert pas le site.");
}
// Une partie enregistree, pour savoir OU elle atterrit.
await fetch(`http://127.0.0.1:${port}/api/demo`, { method: "POST" });
const saved = existsSync(resolve(data, "worlds/spectator/nous-discovery.json"));
await abruptlyStop(first.child);

// Le critere « mises a jour et sauvegardes preservees » se joue ici : si rien
// d'ecrivable ne vit dans l'installation, remplacer ce dossier par une version
// plus recente ne peut pas emporter les parties.
const installHoldsSaves = existsSync(resolve(OUT, "worlds"));
if (!saved)
  throw new Error("La partie enregistree n'atteint pas le dossier de donnees.");
if (installHoldsSaves)
  throw new Error(
    "L'installation contient des donnees : une mise a jour les effacerait.",
  );

step("redemarrage apres une fermeture brutale…");
const lockSurvived = existsSync(resolve(data, "worlds/spectator/server.lock"));
const second = await boot(port, data);
const exitCode = await abruptlyStop(second.child);
if (!second.ready)
  throw new Error(
    `Le paquet ne redemarre pas apres une fermeture brutale :\n${second.log()}`,
  );
// Le verrou laisse par la premiere fermeture doit avoir ete repris, pas
// contourne : c'est la difference entre « ca remarche » et « on sait pourquoi ».
const reclaimed = /Verrou repris/.test(second.log());
if (lockSurvived && !reclaimed)
  throw new Error("Le verrou a survecu sans que le redemarrage le reprenne.");

const bytes = files.reduce((total, file) => total + statSync(file).size, 0);
const manifest = {
  builtAt: new Date().toISOString(),
  node: process.version,
  files: files.length,
  megabytes: Number((bytes / 1024 / 1024).toFixed(1)),
  verified: {
    layout: true,
    secretsFound: 0,
    booted: true,
    servesSite: true,
    // Fermer la fenetre ne libere pas le verrou sous Windows ; ce qui compte
    // est que le lancement suivant le reprenne au lieu de refuser de demarrer.
    savesLandOutsideInstall: true,
    installHoldsNoSaves: true,
    lockSurvivesAbruptStop: lockSurvived,
    restartsAfterAbruptStop: true,
    lockReclaimedOnRestart: reclaimed,
    exitCode,
  },
  signed: false,
};
writeFileSync(
  resolve(OUT, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);

console.log(`\nPaquet pret : ${OUT}`);
console.log(JSON.stringify(manifest, null, 1));

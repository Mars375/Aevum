/**
 * package-app — une copie d'Aevum qui n'exige plus rien de la machine.
 *
 * Le lanceur actuel demande quatre choses a l'utilisateur, et chacune peut
 * echouer chez lui sans qu'on le sache : Node installe, un `npm ci` avec
 * Internet au premier demarrage, un build Vite a l'execution, et `tsx` pour
 * lire du TypeScript a chaud. Un double-clic qui installe des dependances
 * n'est pas un demarrage en un clic, c'est une installation deguisee.
 *
 * Ce script produit un dossier autonome : le site deja construit et un seul
 * executable, `Aevum.exe`, qui porte le serveur. Rien n'est telecharge au
 * lancement, rien n'est compile.
 *
 * L'executable est a nous, et c'est ce qui le rend signable. Le paquet
 * livrait auparavant une copie de `node.exe` — deja signee par l'OpenJS
 * Foundation, la resigner usurperait son editeur — et un lanceur `.cmd`, qui
 * ne peut pas porter de signature Authenticode. Il ne contenait donc rien de
 * signable par nous. `node --build-sea` produit notre propre binaire.
 *
 * Il verifie ensuite ce qu'il vient de produire au lieu de l'affirmer : aucune
 * cle dans le code embarque ni dans aucun fichier livre, la disposition
 * attendue presente, et surtout l'executable demarre pour de bon sur un port
 * libre, sert le site, puis survit a une fermeture brutale — celle que produit
 * la fermeture de la fenetre. C'est le REDEMARRAGE qui fait foi : un paquet
 * qui ne repart pas n'est pas un paquet, et c'est ce controle qui a trouve le
 * verrou orphelin.
 *
 * La signature : `AEVUM_SIGN_THUMBPRINT` designe un certificat de signature de
 * code du magasin de l'utilisateur ; sans lui, rien n'est signe et le
 * manifeste le dit. Un certificat reconnu par Windows s'achete et suppose une
 * verification d'identite : il n'a rien a faire dans un depot.
 * `docs/reports/distribution-autonome.md` dit ou s'arrete la garantie.
 */
import { spawn, spawnSync } from "node:child_process";
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
import { withoutStaleSignature } from "./pe-signature.js";
import { SECRET_PATTERNS } from "./secrets.js";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "dist-app");
const EXE = "Aevum.exe";

/** Ce que l'executable lit au demarrage, releve a la main dans son code. */
const REQUIRED = [
  EXE,
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

/** Nomme le fichier et le motif, jamais la valeur : afficher le secret ferait
 * du controle la fuite. */
function secretsIn(file: string, label: string): string[] {
  const content = readFileSync(file, "utf8");
  return SECRET_PATTERNS.filter(({ pattern }) => pattern.test(content)).map(
    ({ name }) => `${label} (${name})`,
  );
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

/** Voir `pe-signature.ts` : pourquoi, et pourquoi on ne coupe jamais a l'aveugle. */
function stripStaleSignature(file: string): { removedBytes: number } {
  const { bytes, removedBytes } = withoutStaleSignature(readFileSync(file));
  if (removedBytes) writeFileSync(file, bytes);
  return { removedBytes };
}

/** Ce que Windows dit de la signature, lu par PowerShell. */
function readSignature(file: string): {
  status: string;
  signer: string | null;
} {
  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `$s = Get-AuthenticodeSignature -LiteralPath '${file}'; "$($s.Status)|$($s.SignerCertificate.Subject)"`,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  const [status = "Inconnu", signer = ""] = result.stdout.trim().split("|");
  return { status, signer: signer || null };
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
const work = mkdtempSync(join(tmpdir(), "aevum-sea-"));

// 2) Le serveur en un seul fichier : plus de tsx, plus de node_modules. Il
//    reste hors du paquet — il sera embarque dans l'executable.
step("assemblage du serveur…");
const bundle = join(work, "aevum.mjs");
await build({
  entryPoints: [resolve(ROOT, "scripts/aevum-entry.ts")],
  outfile: bundle,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // Le serveur ne demarre le service que si `import.meta.url` correspond a
  // process.argv[1]. Dans l'executable, les deux designent `Aevum.exe` :
  // verifie sur un binaire d'essai avant d'en dependre.
  logLevel: "warning",
});

// Le code serveur disparait dans le binaire, que la recherche de secrets ne
// lit pas : on le lit ici, avant qu'il ne devienne opaque. Sans cette ligne,
// passer a l'executable aurait retire le serveur du controle en silence.
step("recherche de secrets dans le code embarque…");
const embeddedLeaks = secretsIn(bundle, "code embarque");
if (embeddedLeaks.length) {
  rmSync(work, { recursive: true, force: true });
  throw new Error(
    `Paquet refuse, secrets detectes : ${embeddedLeaks.join(", ")}`,
  );
}

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

// 4) L'executable : l'interpreteur et le serveur, en un fichier qui est a nous.
step("construction de l'executable…");
const seaConfig = join(work, "sea-config.json");
writeFileSync(
  seaConfig,
  JSON.stringify({
    main: bundle,
    mainFormat: "module",
    output: resolve(OUT, EXE),
    disableExperimentalSEAWarning: true,
  }),
);
// Sans shell : le chemin de l'interpreteur contient souvent une espace
// (« Program Files »), que `run` ne protegerait pas.
const sea = spawnSync(process.execPath, ["--build-sea", seaConfig], {
  stdio: "inherit",
  windowsHide: true,
});
if (sea.status !== 0)
  throw new Error(`La construction de l'executable a echoue (${sea.status})`);
const stripped = stripStaleSignature(resolve(OUT, EXE));
rmSync(work, { recursive: true, force: true });
writeFileSync(
  resolve(OUT, "TIERS.txt"),
  [
    `Aevum.exe embarque Node.js ${process.version}, distribue sous licence MIT.`,
    "Le texte de la licence n'accompagne pas l'executable sur cette",
    "installation ; il fait foi a l'adresse officielle",
    "https://github.com/nodejs/node/blob/main/LICENSE",
    "",
    "Aucune cle d'API n'est livree avec cette application. Les reglages Nous",
    "sont lus dans les variables d'environnement de la machine qui l'execute.",
    "",
  ].join("\n"),
);

// 5) La signature, si un certificat est designe. Sans lui on ne signe pas, et
//    on ne pretend pas l'avoir fait.
const thumbprint = process.env.AEVUM_SIGN_THUMBPRINT?.replace(/\s/g, "");
if (thumbprint) {
  step("signature de l'executable…");
  const timestamp = process.env.AEVUM_SIGN_TIMESTAMP;
  const signed = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      [
        `$c = Get-Item -LiteralPath 'Cert:\\CurrentUser\\My\\${thumbprint}' -ErrorAction Stop`,
        `$r = Set-AuthenticodeSignature -LiteralPath '${resolve(OUT, EXE)}' -Certificate $c -HashAlgorithm SHA256${timestamp ? ` -TimestampServer '${timestamp}'` : ""}`,
        `"$($r.Status)|$($r.StatusMessage)"`,
      ].join("; "),
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (signed.status !== 0)
    throw new Error(`Signature impossible : ${signed.stderr.trim()}`);
}
const signature = readSignature(resolve(OUT, EXE));
if (thumbprint && signature.status === "NotSigned")
  throw new Error(
    "Un certificat etait designe, mais l'executable n'est pas signe.",
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
  // rien et produit du bruit. Le code embarque a ete lu avant d'etre scelle.
  if (/\.(exe|woff2?|ttf|png|jpg|glb|bin)$/i.test(file)) continue;
  leaks.push(...secretsIn(file, file.slice(OUT.length + 1)));
}
if (leaks.length) {
  rmSync(OUT, { recursive: true, force: true });
  throw new Error(`Paquet detruit, secrets detectes : ${leaks.join(", ")}`);
}

/**
 * Demarre le paquet comme un utilisateur le ferait, et attend sa reponse.
 *
 * Depuis un AUTRE repertoire que l'installation : un double-clic ne fixe pas
 * le repertoire courant, et c'est a l'executable de retrouver son site.
 */
async function boot(port: number, data: string) {
  const child = spawn(resolve(OUT, EXE), [], {
    cwd: data,
    env: {
      ...process.env,
      AEVUM_PORT: String(port),
      AEVUM_DATA: data,
      AEVUM_NO_BROWSER: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  const health = `http://127.0.0.1:${port}/api/health`;
  let ready = false;
  for (let attempt = 0; attempt < 60 && !ready; attempt++) {
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

step("demarrage reel de l'executable…");
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
    embeddedCodeScanned: true,
    booted: true,
    bootedFromAnotherDirectory: true,
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
  executable: {
    name: EXE,
    staleSignatureBytesRemoved: stripped.removedBytes,
  },
  // « Valid » seulement si Windows reconnait la chaine du certificat. Un
  // certificat auto-signe donne « UnknownError » : signe, mais pas reconnu.
  signed: signature.status !== "NotSigned",
  signature,
};
writeFileSync(
  resolve(OUT, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);

console.log(`\nPaquet pret : ${OUT}`);
console.log(JSON.stringify(manifest, null, 1));

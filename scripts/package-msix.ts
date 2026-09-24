/**
 * package-msix — le paquet d'Aevum pour le Microsoft Store.
 *
 * Pourquoi un MSIX et pas l'exécutable : le Store re-signe un MSIX avec son
 * propre certificat, gratuitement — plus d'avertissement SmartScreen. Un
 * exécutable soumis tel quel, lui, doit arriver déjà signé par un certificat
 * reconnu, c'est-à-dire acheté.
 *
 * Part de `dist-app` (`npm run package`), y ajoute le manifeste et les
 * images, et emballe avec `makeappx`, pris dans le paquet NuGet officiel
 * Microsoft.Windows.SDK.BuildTools : rien à installer sur la machine.
 *
 * Le paquet produit n'est pas signé : c'est le Store qui le signe. Pour
 * l'installer localement avant soumission, il faudrait le signer soi-même.
 *
 * Identité (attribuée par l'espace partenaires en réservant le nom) :
 *   AEVUM_MSIX_NAME, AEVUM_MSIX_PUBLISHER (« CN=… »), AEVUM_MSIX_PUBLISHER_DISPLAY
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(".");
const APP = resolve(ROOT, "dist-app");
const STAGE = resolve(ROOT, "dist-msix/stage");
const OUT = resolve(ROOT, "dist-msix/Aevum.msix");

function makeappx(): string {
  const tools = resolve(ROOT, ".tools/buildtools/bin");
  if (!existsSync(tools)) {
    mkdirSync(resolve(ROOT, ".tools"), { recursive: true });
    const zip = resolve(ROOT, ".tools/buildtools.zip");
    execFileSync("curl", [
      "-sL",
      "-o",
      zip,
      "https://www.nuget.org/api/v2/package/Microsoft.Windows.SDK.BuildTools",
    ]);
    execFileSync("tar", ["-xf", zip, "-C", resolve(ROOT, ".tools")], {
      cwd: resolve(ROOT, ".tools"),
    });
  }
  const version = readdirSync(tools).sort().at(-1)!;
  return join(tools, version, "x64", "makeappx.exe");
}

if (!existsSync(join(APP, "Aevum.exe")))
  throw new Error("dist-app/Aevum.exe absent : lancez d'abord npm run package");

// Le Store exige une révision nulle : 0.3.1 devient 0.3.1.0.
const [major, minor, patch] = (
  JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")) as {
    version: string;
  }
).version.split(".");
const identity = {
  __NAME__: process.env.AEVUM_MSIX_NAME ?? "Aevum.Observatoire",
  __PUBLISHER__: process.env.AEVUM_MSIX_PUBLISHER ?? "CN=Aevum",
  __PUBLISHER_DISPLAY__: process.env.AEVUM_MSIX_PUBLISHER_DISPLAY ?? "Aevum",
  __VERSION__: `${major}.${minor}.${patch}.0`,
};
const provisional = !process.env.AEVUM_MSIX_PUBLISHER;

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
cpSync(APP, STAGE, { recursive: true });
cpSync(resolve(ROOT, "packaging/msix/Assets"), join(STAGE, "Assets"), {
  recursive: true,
});
let manifest = readFileSync(
  resolve(ROOT, "packaging/msix/AppxManifest.xml"),
  "utf8",
);
for (const [key, value] of Object.entries(identity))
  manifest = manifest.split(key).join(value);
writeFileSync(join(STAGE, "AppxManifest.xml"), manifest);

rmSync(OUT, { force: true });
execFileSync(makeappx(), ["pack", "/d", STAGE, "/p", OUT, "/o"], {
  stdio: "inherit",
});
console.log(
  JSON.stringify(
    {
      package: OUT,
      version: identity.__VERSION__,
      name: identity.__NAME__,
      publisher: identity.__PUBLISHER__,
      provisionalIdentity: provisional,
      signed: false,
      note: provisional
        ? "Identité provisoire : remplacer par celle de l'espace partenaires avant soumission."
        : "Prêt à soumettre : le Store signe le paquet.",
    },
    null,
    1,
  ),
);

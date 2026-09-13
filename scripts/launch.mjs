import { spawn, execFile } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const url = "http://127.0.0.1:5174/";
async function ready() {
  try {
    const response = await fetch(url + "api/health", { signal: AbortSignal.timeout(1000) });
    return response.ok && (await response.json()).application === "aevum";
  } catch { return false; }
}
function open() {
  if (process.env.AEVUM_NO_BROWSER === "1") return;
  if (process.platform === "win32") execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Start-Process '${url}'`], { windowsHide: true });
  else execFile(process.platform === "darwin" ? "open" : "xdg-open", [url]);
}
if (await ready()) {
  console.log(`Aevum est déjà prêt : ${url}`);
  open();
} else {
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error("Lancez avec npm run launch ou Lancer Aevum.cmd.");
  console.log("Préparation d'Aevum...");
  const build = spawn(process.execPath, [npm, "run", "player:build"], { stdio: "inherit", windowsHide: true });
  const built = await new Promise(resolve => build.once("exit", resolve));
  if (built !== 0) process.exit(1);
  const lock = resolve("worlds/spectator/server.lock");
  if (existsSync(lock)) {
    const previous = JSON.parse(readFileSync(lock, "utf8"));
    if (!Number.isInteger(previous.pid) || previous.pid <= 0) throw new Error("Verrou serveur invalide.");
    let dead = false;
    try { process.kill(previous.pid, 0); } catch (error) { if (error.code === "ESRCH") dead = true; }
    if (!dead) throw new Error("Un serveur Aevum est encore actif. Réessayez dans quelques secondes.");
    unlinkSync(lock);
  }
  const server = spawn(process.execPath, ["--import", "tsx", "scripts/spectator-server.ts"], { stdio: "inherit", windowsHide: true });
  let stopped = false;
  server.once("exit", code => { stopped = true; process.exitCode = code ?? 1; });
  for (let attempt = 0; attempt < 30 && !stopped; attempt++) {
    if (await ready()) { console.log(`Prêt : ${url}\nGardez cette fenêtre ouverte pendant la simulation.`); open(); break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!await ready() && !stopped) { server.kill(); throw new Error("Le serveur n'a pas démarré. Le port 5174 est peut-être occupé."); }
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.kill(signal));
}

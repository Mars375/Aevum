import { execFileSync } from "node:child_process";

/**
 * Les réglages lus dans les variables Windows, et eux seuls.
 *
 * Une clé posée par `setx` n'atteint pas les processus déjà lancés : le
 * terminal qui lance la sonde ne la voit pas. Les clés Mistral et OpenRouter
 * étaient pourtant posées — le banc les déclarait absentes parce que seule
 * celle de Nous était lue ici.
 */
const names = [
  "NOUS_API_KEY",
  "NOUS_MODEL",
  "KILO_API_KEY",
  "MISTRAL_API_KEY",
  "OPENROUTER_API_KEY",
] as const;

/** Read only the supported Windows settings, without persisting secrets. */
export function loadWindowsNousEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): void {
  if (platform !== "win32" || names.every((name) => env[name]?.trim())) return;
  try {
    const output = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `$ErrorActionPreference = 'Stop'; $values = @{}; foreach ($name in @(${names.map((name) => `'${name}'`).join(", ")})) { $value = [Environment]::GetEnvironmentVariable($name, 'User'); if ([string]::IsNullOrWhiteSpace($value)) { $value = [Environment]::GetEnvironmentVariable($name, 'Machine') }; if (-not [string]::IsNullOrWhiteSpace($value)) { $values[$name] = $value } }; ConvertTo-Json -InputObject $values -Compress`,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 5000,
        maxBuffer: 32 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const values: unknown = JSON.parse(output.replace(/^\uFEFF/, ""));
    if (!values || typeof values !== "object" || Array.isArray(values)) return;
    for (const name of names) {
      const value = (values as Record<string, unknown>)[name];
      if (!env[name]?.trim() && typeof value === "string" && value.trim())
        env[name] = value;
    }
  } catch {
    // A missing shell or inaccessible registry leaves the provider unconfigured.
    // Never log the subprocess error: it can contain captured secret output.
  }
}

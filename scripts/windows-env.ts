import { execFileSync } from "node:child_process";

const names = ["NOUS_API_KEY", "NOUS_MODEL"] as const;

/** Read only the two supported Windows settings, without persisting secrets. */
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
        `$ErrorActionPreference = 'Stop'; $values = @{}; foreach ($name in @('NOUS_API_KEY', 'NOUS_MODEL')) { $value = [Environment]::GetEnvironmentVariable($name, 'User'); if ([string]::IsNullOrWhiteSpace($value)) { $value = [Environment]::GetEnvironmentVariable($name, 'Machine') }; if (-not [string]::IsNullOrWhiteSpace($value)) { $values[$name] = $value } }; ConvertTo-Json -InputObject $values -Compress`,
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

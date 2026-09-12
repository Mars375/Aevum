import { afterEach, describe, expect, it, vi } from "vitest";
import * as childProcess from "node:child_process";
import { loadWindowsNousEnvironment } from "../../../scripts/windows-env.js";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

// Spy on the subprocess boundary; never read this machine's environment stores.
afterEach(() => {
  vi.mocked(childProcess.execFileSync).mockReset();
  vi.restoreAllMocks();
});
describe("Windows Nous environment", () => {
  it("skips other platforms and fully configured processes", () => {
    const run = vi.mocked(childProcess.execFileSync);
    loadWindowsNousEnvironment({}, "linux");
    loadWindowsNousEnvironment(
      { NOUS_API_KEY: "existing", NOUS_MODEL: "existing" },
      "win32",
    );
    expect(run).not.toHaveBeenCalled();
  });
  it("imports only allowed missing settings without replacing configured values", () => {
    const run = vi
      .mocked(childProcess.execFileSync)
      .mockReturnValueOnce(
        JSON.stringify({
          NOUS_API_KEY: "fixture",
          NOUS_MODEL: "fixture-model",
          OTHER_SECRET: "ignored",
        }),
      );
    const env = { NOUS_API_KEY: "existing", NOUS_MODEL: "" };
    loadWindowsNousEnvironment(env, "win32");
    expect(env).toEqual({
      NOUS_API_KEY: "existing",
      NOUS_MODEL: "fixture-model",
    });
    expect(run).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining(["-NoProfile", "-NonInteractive"]),
      expect.objectContaining({
        windowsHide: true,
        timeout: 5000,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  });
  it("ignores malformed captured output", () => {
    vi.mocked(childProcess.execFileSync).mockReturnValueOnce("invalid-json");
    const env = {};
    loadWindowsNousEnvironment(env, "win32");
    expect(env).toEqual({});
  });
  it("silently ignores subprocess failure without exposing captured output", () => {
    vi.mocked(childProcess.execFileSync).mockImplementationOnce(() => {
      throw new Error("private captured fixture");
    });
    const log = vi.spyOn(console, "log"),
      warn = vi.spyOn(console, "warn"),
      error = vi.spyOn(console, "error");
    const env = {};
    expect(() => loadWindowsNousEnvironment(env, "win32")).not.toThrow();
    expect(env).toEqual({});
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});

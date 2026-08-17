import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@abs/contracts": r("./packages/contracts/src/index.ts"),
      "@abs/engine": r("./packages/engine/src/index.ts"),
      "@abs/agents": r("./packages/agents/src/index.ts"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node",
  },
});

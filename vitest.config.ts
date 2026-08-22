import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@abs/contracts": r("./packages/contracts/src/index.ts"),
      "@abs/engine": r("./packages/engine/src/index.ts"),
      "@abs/agents": r("./packages/agents/src/index.ts"),
      "@abs/world": r("./packages/world/src/index.ts"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    environment: "node",
  },
});

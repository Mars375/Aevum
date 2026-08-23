import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const vuePlugin = vue();
const transformVue = vuePlugin.transform;

// Vitest's Node environment normally asks Vite for SSR-only Vue output, which
// has no event handlers to exercise. Client render functions still support
// renderToString and let component tests trigger the real handlers in memory.
if (typeof transformVue === "function") {
  vuePlugin.transform = function (code, id, options) {
    return transformVue.call(this, code, id, { ...options, ssr: false });
  };
}

export default defineConfig({
  plugins: [vuePlugin],
  resolve: {
    alias: {
      "@abs/contracts": r("./packages/contracts/src/index.ts"),
      "@abs/engine": r("./packages/engine/src/index.ts"),
      "@abs/agents": r("./packages/agents/src/index.ts"),
      "@abs/world": r("./packages/world/src/index.ts"),
      "@abs/metrics": r("./packages/metrics/src/index.ts"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    environment: "node",
  },
});

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
    /**
     * Cinq secondes mesuraient la charge de la machine, pas la correction.
     *
     * Plusieurs tests d'ici rejouent des centaines de tours de moteur — 1 100
     * actions pour la modernisation, une campagne entière pour la démo, une
     * chauffe jusqu'au tour 639 pour les ordres réalisables — et le contrôle de
     * marque lit tous les fichiers suivis. Chacun passe largement seul ; en
     * parallèle ils dépassaient les cinq secondes par défaut et la suite
     * échouait sans qu'aucune régression n'existe. Un échec environnemental
     * qu'on apprend à ignorer est pire qu'un test lent.
     */
    testTimeout: 30000,
  },
});

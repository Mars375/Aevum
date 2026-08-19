import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  base: "./",
  resolve: {
    alias: {
      "@abs/contracts": fileURLToPath(new URL("../../packages/contracts/src/index.ts", import.meta.url)),
      // The player recomputes a world from its journal using the very code
      // that lived it, rather than trusting a separate rendering of events.
      "@abs/world": fileURLToPath(new URL("../../packages/world/src/index.ts", import.meta.url)),
    },
  },
});

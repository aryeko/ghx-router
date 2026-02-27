import { resolve } from "node:path"
import { defineConfig } from "tsup"

export default defineConfig({
  // CLI-only entry: workspace consumers import source via TypeScript path aliases; dist is for the standalone binary only.
  entry: ["src/cli/index.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  dts: false,
  sourcemap: true,
  esbuildOptions(options) {
    options.alias = {
      ...options.alias,
      "@eval": resolve(import.meta.dirname, "src"),
    }
  },
})

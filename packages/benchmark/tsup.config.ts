import { resolve } from "node:path"
import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/cli/index.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  dts: false,
  sourcemap: true,
  esbuildOptions(options) {
    options.alias = {
      ...options.alias,
      "@bench": resolve(import.meta.dirname, "src"),
    }
  },
})

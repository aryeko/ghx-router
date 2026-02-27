import { resolve } from "node:path"
import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  dts: true,
  sourcemap: true,
  esbuildOptions(options) {
    options.alias = {
      ...options.alias,
      "@profiler": resolve(import.meta.dirname, "src"),
    }
  },
})

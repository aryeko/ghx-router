import { resolve } from "node:path"
import { defineConfig } from "tsup"
import pkg from "./package.json" with { type: "json" }

export default defineConfig({
  entry: ["src/index.ts", "src/cli/index.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  dts: true,
  sourcemap: true,
  onSuccess: "node scripts/copy-registry-cards.mjs",
  esbuildOptions(options) {
    options.alias = {
      ...options.alias,
      "@core": resolve(import.meta.dirname, "src"),
    }
    options.define = {
      ...options.define,
      __GHX_VERSION__: JSON.stringify(pkg.version),
    }
  },
})

import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/cli/benchmark.ts", "src/cli/check-scenarios.ts", "src/cli/report.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  dts: false,
  sourcemap: true,
})

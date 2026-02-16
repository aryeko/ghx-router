import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts", "src/agent.ts", "src/cli/index.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  dts: true,
  sourcemap: true,
})

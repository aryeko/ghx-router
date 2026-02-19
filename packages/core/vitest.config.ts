import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@core": resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    reporters: ["default", "junit"],
    outputFile: { junit: "test-report.junit.xml" },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/gql/generated/**", "src/**/*.generated.ts"],
    },
  },
})

import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    reporters: ["default", "junit"],
    outputFile: { junit: "test-report.junit.xml" },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/gql/generated/**", "src/gql/operations/*.generated.ts"],
    },
  },
})

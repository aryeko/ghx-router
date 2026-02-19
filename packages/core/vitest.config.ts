import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [tsconfigPaths()],
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

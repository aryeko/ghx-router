import { defineWorkspace } from "vitest/config"

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "unit",
      include: ["test/**/*.test.ts"],
      exclude: ["test/e2e/**/*.test.ts"],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "e2e:local",
      include: ["test/e2e/setup-install-verify.e2e.test.ts"],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "e2e:sdk",
      include: ["test/e2e/setup-opencode-skill.e2e.test.ts"],
    },
  },
])

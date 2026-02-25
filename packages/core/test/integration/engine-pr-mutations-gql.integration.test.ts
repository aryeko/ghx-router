import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("PR mutation GQL routing", () => {
  describe("pr.create", () => {
    it("routes to graphql and returns correct output shape", async () => {
      const githubClient = {
        createPr: async () => ({
          number: 7,
          url: "https://github.com/acme/repo/pull/7",
          title: "Add new feature",
          state: "OPEN",
          draft: false,
        }),
      } as unknown as GithubClient

      const request: TaskRequest = {
        task: "pr.create",
        input: {
          owner: "acme",
          name: "repo",
          title: "Add new feature",
          head: "feat/new-feature",
          base: "main",
        },
      }

      const result = await executeTask(request, {
        githubClient,
        githubToken: "test-token",
      })

      expect(result.ok).toBe(true)
      expect(result.meta.route_used).toBe("graphql")
      expect(result.data).toMatchObject({
        number: 7,
        url: "https://github.com/acme/repo/pull/7",
        title: "Add new feature",
        state: "OPEN",
        draft: false,
      })
    })
  })

  describe("pr.update", () => {
    it("routes to graphql and returns correct output shape", async () => {
      const githubClient = {
        updatePr: async () => ({
          number: 42,
          url: "https://github.com/acme/repo/pull/42",
          title: "Updated title",
          state: "OPEN",
          draft: false,
        }),
      } as unknown as GithubClient

      const request: TaskRequest = {
        task: "pr.update",
        input: {
          owner: "acme",
          name: "repo",
          prNumber: 42,
          title: "Updated title",
        },
      }

      const result = await executeTask(request, {
        githubClient,
        githubToken: "test-token",
      })

      expect(result.ok).toBe(true)
      expect(result.meta.route_used).toBe("graphql")
      expect(result.data).toMatchObject({
        number: 42,
        title: "Updated title",
        state: "OPEN",
        draft: false,
      })
    })
  })

  describe("pr.merge", () => {
    it("routes to graphql and returns correct output shape", async () => {
      const githubClient = {
        mergePr: async () => ({
          prNumber: 42,
          method: "merge",
          isMethodAssumed: true,
          queued: false,
          deleteBranch: false,
        }),
      } as unknown as GithubClient

      const request: TaskRequest = {
        task: "pr.merge",
        input: {
          owner: "acme",
          name: "repo",
          prNumber: 42,
        },
      }

      const result = await executeTask(request, {
        githubClient,
        githubToken: "test-token",
      })

      expect(result.ok).toBe(true)
      expect(result.meta.route_used).toBe("graphql")
      expect(result.data).toMatchObject({
        prNumber: 42,
        method: "merge",
        queued: false,
        deleteBranch: false,
      })
    })
  })

  describe("pr.branch.update", () => {
    it("routes to graphql and returns correct output shape", async () => {
      const githubClient = {
        updatePrBranch: async () => ({
          prNumber: 42,
          updated: true,
        }),
      } as unknown as GithubClient

      const request: TaskRequest = {
        task: "pr.branch.update",
        input: {
          owner: "acme",
          name: "repo",
          prNumber: 42,
        },
      }

      const result = await executeTask(request, {
        githubClient,
        githubToken: "test-token",
      })

      expect(result.ok).toBe(true)
      expect(result.meta.route_used).toBe("graphql")
      expect(result.data).toMatchObject({
        prNumber: 42,
        updated: true,
      })
    })
  })

  describe("pr.assignees.add", () => {
    it("routes to graphql and returns correct output shape", async () => {
      const githubClient = {
        addPrAssignees: async () => ({
          prNumber: 42,
          added: ["login1"],
        }),
      } as unknown as GithubClient

      const request: TaskRequest = {
        task: "pr.assignees.add",
        input: {
          owner: "acme",
          name: "repo",
          prNumber: 42,
          assignees: ["login1"],
        },
      }

      const result = await executeTask(request, {
        githubClient,
        githubToken: "test-token",
      })

      expect(result.ok).toBe(true)
      expect(result.meta.route_used).toBe("graphql")
      expect(result.data).toMatchObject({
        prNumber: 42,
        added: ["login1"],
      })
    })
  })

  describe("pr.assignees.remove", () => {
    it("routes to graphql and returns correct output shape", async () => {
      const githubClient = {
        removePrAssignees: async () => ({
          prNumber: 42,
          removed: ["login1"],
        }),
      } as unknown as GithubClient

      const request: TaskRequest = {
        task: "pr.assignees.remove",
        input: {
          owner: "acme",
          name: "repo",
          prNumber: 42,
          assignees: ["login1"],
        },
      }

      const result = await executeTask(request, {
        githubClient,
        githubToken: "test-token",
      })

      expect(result.ok).toBe(true)
      expect(result.meta.route_used).toBe("graphql")
      expect(result.data).toMatchObject({
        prNumber: 42,
        removed: ["login1"],
      })
    })
  })

  describe("pr.reviews.request", () => {
    it("routes to graphql and returns correct output shape", async () => {
      const githubClient = {
        requestPrReviews: async () => ({
          prNumber: 42,
          reviewers: ["login1"],
          updated: true,
        }),
      } as unknown as GithubClient

      const request: TaskRequest = {
        task: "pr.reviews.request",
        input: {
          owner: "acme",
          name: "repo",
          prNumber: 42,
          reviewers: ["login1"],
        },
      }

      const result = await executeTask(request, {
        githubClient,
        githubToken: "test-token",
      })

      expect(result.ok).toBe(true)
      expect(result.meta.route_used).toBe("graphql")
      expect(result.data).toMatchObject({
        prNumber: 42,
        reviewers: ["login1"],
        updated: true,
      })
    })
  })
})

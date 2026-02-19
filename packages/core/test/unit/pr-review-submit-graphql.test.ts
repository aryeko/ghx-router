import { describe, expect, it } from "vitest"

describe("pr.review.submit via GraphQL", () => {
  it("submits review with inline comments using addPullRequestReview mutation", async () => {
    // Mock the GQL transport
    // Call the GraphQL adapter with pr.review.submit + comments array
    // Assert: mutation contains "addPullRequestReview"
    // Assert: variables include threads array
  })

  it("submits review without comments (body-only)", async () => {
    // Call with just event + body, no comments
    // Assert: threads variable is empty or absent
  })
})

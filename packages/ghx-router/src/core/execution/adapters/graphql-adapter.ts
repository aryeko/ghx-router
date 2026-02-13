import type { ResultEnvelope } from "../../contracts/envelope.js"
import { mapErrorToCode } from "../../errors/map-error.js"
import type { GraphqlClient, GraphqlVariables } from "../../../gql/client.js"

export interface GraphqlAdapterRequest {
  query: string
  variables?: GraphqlVariables
  reason?: string
}

function buildMeta(reason?: string): ResultEnvelope<unknown>["meta"] {
  return reason ? { source: "graphql", reason } : { source: "graphql" }
}

export async function runGraphqlAdapter<TData>(
  client: GraphqlClient,
  request: GraphqlAdapterRequest
): Promise<ResultEnvelope<TData>> {
  try {
    const data = await client.query<TData>(request.query, request.variables)

    return {
      success: true,
      data,
      meta: buildMeta(request.reason)
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)

    return {
      success: false,
      error: {
        code: mapErrorToCode(error),
        message,
        details: {
          adapter: "graphql"
        },
        retryable: false
      },
      meta: buildMeta(request.reason)
    }
  }
}

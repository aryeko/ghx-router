import type { ResultEnvelope } from "../../contracts/envelope.js"
import { mapErrorToCode } from "../../errors/map-error.js"
import { isRetryableErrorCode } from "../../errors/retryability.js"
import type { GraphqlClient, GraphqlVariables } from "../../../gql/client.js"
import type { RouteReasonCode } from "../../routing/reason-codes.js"

export interface GraphqlAdapterRequest {
  query: string
  variables?: GraphqlVariables
  reason?: RouteReasonCode
}

function buildMeta(reason?: RouteReasonCode): ResultEnvelope<unknown>["meta"] {
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
    const code = mapErrorToCode(error)
    const message = error instanceof Error ? error.message : String(error)

    return {
      success: false,
      error: {
        code,
        message,
        details: {
          adapter: "graphql"
        },
        retryable: isRetryableErrorCode(code)
      },
      meta: buildMeta(request.reason)
    }
  }
}

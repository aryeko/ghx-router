import { type DocumentNode, print } from "graphql"
import type { GraphQLClient, RequestDocument, RequestOptions } from "graphql-request"

export type GraphqlVariables = Record<string, unknown>

export type GraphqlError = {
  message: string
  path?: ReadonlyArray<string | number>
  extensions?: Record<string, unknown>
}

export type GraphqlRawResult<TData> = {
  data: TData | undefined
  errors: GraphqlError[] | undefined
}

type GraphqlDocument = string | DocumentNode
type QueryLike = GraphqlDocument | RequestDocument

export interface GraphqlTransport {
  execute<TData>(query: string, variables?: GraphqlVariables): Promise<TData>
  executeRaw?<TData>(query: string, variables?: GraphqlVariables): Promise<GraphqlRawResult<TData>>
}

export interface GraphqlClient {
  query<TData, TVariables extends GraphqlVariables = GraphqlVariables>(
    query: GraphqlDocument,
    variables?: TVariables,
  ): Promise<TData>
  queryRaw<TData, TVariables extends GraphqlVariables = GraphqlVariables>(
    query: GraphqlDocument,
    variables?: TVariables,
  ): Promise<GraphqlRawResult<TData>>
}

export type TokenClientOptions = {
  token: string
  graphqlUrl?: string
}

function queryToString(query: QueryLike): string {
  if (typeof query === "string") {
    return query
  }

  if (typeof query === "object" && query !== null && "kind" in query) {
    return print(query as DocumentNode)
  }

  return String(query)
}

function assertQuery(query: string): void {
  if (query.trim().length === 0) {
    throw new Error("GraphQL query must be non-empty")
  }
}

export function createGraphqlClient(transport: GraphqlTransport): GraphqlClient {
  return {
    async query<TData, TVariables extends GraphqlVariables = GraphqlVariables>(
      query: GraphqlDocument,
      variables?: TVariables,
    ): Promise<TData> {
      const queryText = queryToString(query)
      assertQuery(queryText)
      return transport.execute<TData>(queryText, variables)
    },
    async queryRaw<TData, TVariables extends GraphqlVariables = GraphqlVariables>(
      query: GraphqlDocument,
      variables?: TVariables,
    ): Promise<GraphqlRawResult<TData>> {
      const queryText = queryToString(query)
      assertQuery(queryText)
      // Both paths normalize transport-level errors into settled results
      try {
        if (transport.executeRaw) {
          return await transport.executeRaw<TData>(queryText, variables)
        }
        const data = await transport.execute<TData>(queryText, variables)
        return { data, errors: undefined }
      } catch (err) {
        return {
          data: undefined,
          errors: [{ message: err instanceof Error ? err.message : String(err) }],
        }
      }
    },
  }
}

export function createGraphqlRequestClient(transport: GraphqlTransport): GraphQLClient {
  const client: Pick<GraphQLClient, "request"> = {
    request<TData, TVariables extends object = object>(
      documentOrOptions: RequestDocument | RequestOptions<TVariables, TData>,
      ...variablesAndRequestHeaders: unknown[]
    ): Promise<TData> {
      const options =
        typeof documentOrOptions === "object" &&
        documentOrOptions !== null &&
        "document" in documentOrOptions
          ? documentOrOptions
          : {
              document: documentOrOptions,
              variables: variablesAndRequestHeaders[0] as TVariables | undefined,
            }

      const queryText = queryToString(options.document)
      assertQuery(queryText)
      return transport.execute<TData>(queryText, options.variables as GraphqlVariables)
    },
  }

  return client as GraphQLClient
}

const DEFAULT_GRAPHQL_URL = "https://api.github.com/graphql"

export function resolveGraphqlUrl(): string {
  if (process.env.GITHUB_GRAPHQL_URL) {
    return process.env.GITHUB_GRAPHQL_URL
  }

  if (process.env.GH_HOST) {
    return `https://${process.env.GH_HOST}/api/graphql`
  }

  return DEFAULT_GRAPHQL_URL
}

type JsonPayload<TData> = {
  data?: TData
  errors?: GraphqlError[]
  message?: string
}

async function fetchGraphql<TData>(
  url: string,
  token: string,
  query: string,
  variables?: GraphqlVariables,
): Promise<JsonPayload<TData>> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  })

  if (!response.ok) {
    let message = `GraphQL request failed (${response.status})`
    try {
      const body = (await response.json()) as JsonPayload<TData>
      if (body.message) {
        message = body.message
      }
    } catch {
      // Non-JSON error body — use status-based message
    }
    throw new Error(message)
  }

  try {
    return (await response.json()) as JsonPayload<TData>
  } catch {
    throw new Error(`GraphQL response is not valid JSON (${response.status})`)
  }
}

export function createTokenTransport(token: string, graphqlUrl?: string): GraphqlTransport {
  const url = graphqlUrl ?? resolveGraphqlUrl()

  return {
    async execute<TData>(query: string, variables?: GraphqlVariables): Promise<TData> {
      const payload = await fetchGraphql<TData>(url, token, query, variables)

      if (payload.errors?.length) {
        throw new Error(payload.errors[0]?.message ?? "GraphQL returned errors")
      }

      if (payload.data === undefined) {
        throw new Error("GraphQL response missing data")
      }

      return payload.data
    },

    async executeRaw<TData>(
      query: string,
      variables?: GraphqlVariables,
    ): Promise<GraphqlRawResult<TData>> {
      const payload = await fetchGraphql<TData>(url, token, query, variables)
      return {
        data: payload.data,
        errors: payload.errors?.length ? payload.errors : undefined,
      }
    },
  }
}

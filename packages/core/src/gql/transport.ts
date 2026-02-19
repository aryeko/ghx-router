import { type DocumentNode, print } from "graphql"
import type { GraphQLClient, RequestDocument, RequestOptions } from "graphql-request"

export type GraphqlVariables = Record<string, unknown>

type GraphqlDocument = string | DocumentNode
type QueryLike = GraphqlDocument | RequestDocument

export interface GraphqlTransport {
  execute<TData>(query: string, variables?: GraphqlVariables): Promise<TData>
}

export interface GraphqlClient {
  query<TData, TVariables extends GraphqlVariables = GraphqlVariables>(
    query: GraphqlDocument,
    variables?: TVariables,
  ): Promise<TData>
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

function resolveGraphqlUrl(): string {
  if (process.env.GITHUB_GRAPHQL_URL) {
    return process.env.GITHUB_GRAPHQL_URL
  }

  if (process.env.GH_HOST) {
    return `https://${process.env.GH_HOST}/api/graphql`
  }

  return DEFAULT_GRAPHQL_URL
}

export function createTokenTransport(token: string, graphqlUrl?: string): GraphqlTransport {
  const url = graphqlUrl ?? resolveGraphqlUrl()

  return {
    async execute<TData>(query: string, variables?: GraphqlVariables): Promise<TData> {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables: variables ?? {} }),
      })

      const payload = (await response.json()) as {
        data?: TData
        errors?: Array<{ message?: string }>
        message?: string
      }

      if (!response.ok) {
        throw new Error(payload.message ?? `GraphQL request failed (${response.status})`)
      }

      if (payload.errors?.length) {
        throw new Error(payload.errors[0]?.message ?? "GraphQL returned errors")
      }

      if (payload.data === undefined) {
        throw new Error("GraphQL response missing data")
      }

      return payload.data
    },
  }
}

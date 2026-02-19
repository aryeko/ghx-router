import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PageInfoFieldsFragment = {
  __typename?: "PageInfo"
  endCursor?: string | null
  hasNextPage: boolean
}

export const PageInfoFieldsFragmentDoc = `
    fragment PageInfoFields on PageInfo {
  endCursor
  hasNextPage
}
    `

export type SdkFunctionWrapper = <T>(
  action: (requestHeaders?: Record<string, string>) => Promise<T>,
  operationName: string,
  operationType?: string,
  variables?: any,
) => Promise<T>

const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) =>
  action()

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {}
}
export type Sdk = ReturnType<typeof getSdk>

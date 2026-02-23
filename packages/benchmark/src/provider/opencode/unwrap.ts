import { isObject } from "@bench/util/guards.js"

export function unwrapData<T>(value: unknown, label: string): T {
  if (isObject(value) && "data" in value) {
    const wrapped = value as { data?: unknown; error?: unknown }
    if (wrapped.error) {
      throw new Error(`${label} returned error payload: ${String(wrapped.error)}`)
    }
    return wrapped.data as T
  }

  return value as T
}

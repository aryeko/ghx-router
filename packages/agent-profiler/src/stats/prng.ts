/**
 * Mulberry32 — a fast, seedable 32-bit PRNG.
 *
 * Returns a function that produces deterministic pseudo-random numbers
 * in [0, 1) on each call.
 */
export function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

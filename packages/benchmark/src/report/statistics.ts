export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  if (p < 0 || p > 100) {
    throw new Error("Percentile must be between 0 and 100")
  }

  const sorted = [...values].sort((a, b) => a - b)
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index % 1

  if (lower === upper) {
    return sorted[lower] ?? 0
  }

  const lowerVal = sorted[lower] ?? 0
  const upperVal = sorted[upper] ?? 0
  return lowerVal * (1 - weight) + upperVal * weight
}

export function iqr(values: number[]): number {
  if (values.length === 0) return 0
  const p25 = percentile(values, 25)
  const p75 = percentile(values, 75)
  return p75 - p25
}

export function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  if (mean === 0) return 0

  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  const stddev = Math.sqrt(variance)

  return (stddev / mean) * 100
}

export function bootstrapCI(
  values: number[],
  confidence: number = 0.95,
  iterations: number = 10000,
): [number, number] {
  if (values.length === 0) {
    return [0, 0]
  }

  if (values.length === 1) {
    const val = values[0] ?? 0
    return [val, val]
  }

  const bootstrapMedians: number[] = []

  for (let i = 0; i < iterations; i++) {
    const sample: number[] = []
    for (let j = 0; j < values.length; j++) {
      const idx = Math.floor(Math.random() * values.length)
      sample.push(values[idx] ?? 0)
    }
    bootstrapMedians.push(percentile(sample, 50))
  }

  bootstrapMedians.sort((a, b) => a - b)

  const alpha = 1 - confidence
  const lowerIdx = Math.floor((alpha / 2) * bootstrapMedians.length)
  const upperIdx = Math.ceil((1 - alpha / 2) * bootstrapMedians.length) - 1

  const lower = bootstrapMedians[lowerIdx] ?? 0
  const upper = bootstrapMedians[Math.min(upperIdx, bootstrapMedians.length - 1)] ?? 0

  return [lower, upper]
}

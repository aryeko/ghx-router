import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type {
  AnalysisResult,
  Analyzer,
  BaseScenario,
  SessionAnalysisBundle,
  SessionTrace,
} from "@ghx-dev/agent-profiler"
import {
  efficiencyAnalyzer,
  errorAnalyzer,
  reasoningAnalyzer,
  strategyAnalyzer,
  toolPatternAnalyzer,
} from "@ghx-dev/agent-profiler"

export interface RunAnalyzersOptions {
  readonly runDir: string
  readonly outputDir: string
}

const BUILT_IN_ANALYZERS: readonly Analyzer[] = [
  reasoningAnalyzer,
  strategyAnalyzer,
  efficiencyAnalyzer,
  toolPatternAnalyzer,
  errorAnalyzer,
]

/**
 * Discovers session traces in {runDir}/sessions/ and runs all built-in
 * analyzers on each trace. Returns SessionAnalysisBundle records.
 */
export async function runAnalyzers(
  options: RunAnalyzersOptions,
): Promise<readonly SessionAnalysisBundle[]> {
  const sessionsDir = join(options.runDir, "sessions")
  let scenarioDirs: readonly string[]

  try {
    scenarioDirs = (await readdir(sessionsDir)) as unknown as string[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }

  const bundles: SessionAnalysisBundle[] = []

  for (const scenarioId of scenarioDirs) {
    const scenarioDir = join(sessionsDir, scenarioId)
    let traceFiles: readonly string[]
    try {
      traceFiles = ((await readdir(scenarioDir)) as unknown as string[]).filter((f) =>
        f.endsWith(".json"),
      )
    } catch {
      continue
    }

    for (const traceFile of traceFiles) {
      const content = await readFile(join(scenarioDir, traceFile), "utf-8")
      const trace = JSON.parse(content) as SessionTrace

      // Parse mode from filename: "{mode}-iter-{n}.json"
      const match = traceFile.match(/^(.+)-iter-\d+\.json$/)
      const mode = match?.[1] ?? "unknown"

      const stubScenario: BaseScenario = {
        id: scenarioId,
        name: scenarioId,
        description: "",
        prompt: "",
        timeoutMs: 0,
        allowedRetries: 0,
        tags: [],
        extensions: {},
      }

      const results: Record<string, AnalysisResult> = {}
      for (const analyzer of BUILT_IN_ANALYZERS) {
        results[analyzer.name] = await analyzer.analyze(trace, stubScenario, mode)
      }

      const bundle: SessionAnalysisBundle = {
        sessionId: trace.sessionId,
        scenarioId,
        mode,
        model: "",
        results,
      }

      bundles.push(bundle)

      // Write bundle to output
      const outDir = join(options.outputDir, scenarioId)
      await mkdir(outDir, { recursive: true })
      const outFile = traceFile.replace(".json", "-analysis.json")
      await writeFile(join(outDir, outFile), JSON.stringify(bundle, null, 2), "utf-8")
    }
  }

  return bundles
}

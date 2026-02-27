// @ghx-dev/agent-profiler public API

// ── Analyzers ──────────────────────────────────────────────────────────────
export { efficiencyAnalyzer } from "./analyzer/efficiency-analyzer.js"
export { errorAnalyzer } from "./analyzer/error-analyzer.js"
export { reasoningAnalyzer } from "./analyzer/reasoning-analyzer.js"
export { strategyAnalyzer } from "./analyzer/strategy-analyzer.js"
export { toolPatternAnalyzer } from "./analyzer/tool-pattern-analyzer.js"
// ── Collectors ─────────────────────────────────────────────────────────────
export { CostCollector } from "./collector/cost-collector.js"
export { LatencyCollector } from "./collector/latency-collector.js"
export { TokenCollector } from "./collector/token-collector.js"
export { ToolCallCollector } from "./collector/tool-call-collector.js"
// ── Config ─────────────────────────────────────────────────────────────────
export { loadConfig, PROFILER_FLAGS, parseProfilerFlags } from "./config/loader.js"
export type { ProfilerConfig } from "./config/schema.js"
export { ProfilerConfigSchema } from "./config/schema.js"
// ── Contracts ──────────────────────────────────────────────────────────────
export type { Analyzer } from "./contracts/analyzer.js"
export type { Collector } from "./contracts/collector.js"
export type {
  AfterScenarioContext,
  BeforeScenarioContext,
  RunContext,
  RunHooks,
} from "./contracts/hooks.js"
export type { ModeConfig, ModeResolver } from "./contracts/mode-resolver.js"
export type {
  CreateSessionParams,
  PermissionConfig,
  PromptResult,
  ProviderConfig,
  SessionHandle,
  SessionProvider,
} from "./contracts/provider.js"
export type {
  Scorer,
  ScorerCheckResult,
  ScorerContext,
  ScorerResult,
} from "./contracts/scorer.js"
// ── Reporter ───────────────────────────────────────────────────────────────
export type { ReportOptions } from "./reporter/orchestrator.js"
export { generateReport } from "./reporter/orchestrator.js"
// ── Runner ─────────────────────────────────────────────────────────────────
export type { ProfileSuiteOptions, ProfileSuiteResult } from "./runner/profile-runner.js"
export { runProfileSuite } from "./runner/profile-runner.js"
// ── Shared ─────────────────────────────────────────────────────────────────
export {
  DEFAULT_BOOTSTRAP_RESAMPLES,
  DEFAULT_CONFIDENCE_LEVEL,
  DEFAULT_LOG_LEVEL,
  DEFAULT_PERMUTATION_COUNT,
  DEFAULT_REPETITIONS,
  DEFAULT_REPORTS_DIR,
  DEFAULT_RESULTS_DIR,
  DEFAULT_SESSION_EXPORT,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_WARMUP,
} from "./shared/constants.js"
export type { Logger, LogLevel } from "./shared/logger.js"
export { createLogger } from "./shared/logger.js"
// ── Statistics ─────────────────────────────────────────────────────────────
export type { BootstrapCIOptions } from "./stats/bootstrap.js"
export { bootstrapCI, bootstrapReductionCI } from "./stats/bootstrap.js"
export type { CompareGroupsOptions, PermutationTestOptions } from "./stats/comparison.js"
export { cohensD, compareGroups, permutationTest } from "./stats/comparison.js"
export { computeDescriptive } from "./stats/descriptive.js"
// ── Store ──────────────────────────────────────────────────────────────────
export {
  appendJsonlLine,
  parseJsonlLines,
  readJsonlFile,
  writeJsonlFile,
} from "./store/jsonl-store.js"
export { readManifest, updateManifest, writeManifest } from "./store/run-manifest.js"
export type { RunManifest } from "./store/types.js"
// ── Types ──────────────────────────────────────────────────────────────────
export type {
  ComparisonResult,
  ConfidenceInterval,
  CostBreakdown,
  CustomMetric,
  DescriptiveStats,
  EffectSize,
  PermutationResult,
  TimingBreakdown,
  TimingSegment,
  TokenBreakdown,
  ToolCallRecord,
} from "./types/metrics.js"
export type { CheckpointResult, ProfileRow } from "./types/profile-row.js"
export type {
  BaseScenario,
  ProgressEvent,
  ScenarioLoader,
  ScenarioSets,
} from "./types/scenario.js"
export type {
  AnalysisFinding,
  AnalysisResult,
  SessionAnalysisBundle,
  SessionTrace,
  TraceEvent,
  Turn,
} from "./types/trace.js"

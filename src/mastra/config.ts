/**
 * Runtime configuration for the Mastra scaffold.
 *
 * Everything is read lazily, at call time, so a test (or a route that only
 * touches one capability) never needs the whole environment to be present.
 */

export const DEFAULT_AGENT_MODEL = "openrouter/anthropic/claude-sonnet-4.5";

/**
 * Guardrails run a detection model on every turn, so they default to a cheap
 * model rather than the agent's own.
 */
export const DEFAULT_GUARDRAIL_MODEL = "openrouter/openai/gpt-4o-mini";

export function agentModel(): string {
  return process.env.MASTRA_MODEL?.trim() || DEFAULT_AGENT_MODEL;
}

/**
 * Specialists run on their own model knob so the roster can be made cheaper
 * than the orchestrator without touching every agent definition.
 */
export function subagentModel(): string {
  return (
    process.env.MASTRA_SUBAGENT_MODEL?.trim() ||
    process.env.MASTRA_MODEL?.trim() ||
    DEFAULT_AGENT_MODEL
  );
}

export function guardrailModel(): string {
  return process.env.MASTRA_GUARDRAIL_MODEL?.trim() || DEFAULT_GUARDRAIL_MODEL;
}

/**
 * Cumulative spend allowed per user (Mastra `resourceId`) before a run is
 * aborted. `TokenCostControl` fails open on anything that is not a finite
 * positive number, so an empty value silently disables the guard — hence the
 * explicit fallback.
 */
export function costBudgetUsd(): number {
  const raw = Number(process.env.MASTRA_COST_BUDGET_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 0.5;
}

export function costWindow(): "1h" | "6h" | "24h" | "7d" | "30d" | "365d" {
  const raw = process.env.MASTRA_COST_WINDOW?.trim();
  const allowed = ["1h", "6h", "24h", "7d", "30d", "365d"] as const;
  return allowed.find((value) => value === raw) ?? "24h";
}

/** Input-token ceiling for a single request, before the model is called. */
export function inputTokenLimit(): number {
  const raw = Number(process.env.MASTRA_INPUT_TOKEN_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 32_000;
}

/** Output-token ceiling for a single response. */
export function outputTokenLimit(): number {
  const raw = Number(process.env.MASTRA_OUTPUT_TOKEN_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 4_000;
}

export type SearchProvider = "tavily" | "brave";

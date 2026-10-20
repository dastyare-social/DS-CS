import {
  ModerationProcessor,
  PIIDetector,
  PromptInjectionDetector,
  TokenCostControl,
  TokenLimiterProcessor,
} from "@mastra/core/processors";

import {
  costBudgetUsd,
  costWindow,
  guardrailModel,
  inputTokenLimit,
  outputTokenLimit,
} from "../config";
import { contentPolicyProcessor } from "./content-policy";

/**
 * Guardrails, in the order they run.
 *
 * Input: the channel's own content policy first (cheap, local), then PII
 * redaction and prompt-injection detection (one cheap model call each), then a
 * token ceiling, then the per-user cost ceiling.
 *
 * Output: moderation before the content policy, so unsafe text is blocked
 * rather than merely sanitized on its way back to the user.
 *
 * The detectors are model-backed. They are configured with a separate, cheap
 * model (`MASTRA_GUARDRAIL_MODEL`) and fail *open* (`errorStrategy: "warn"`):
 * a provider outage should not silently make the agent unusable, it should
 * show up in the logs.
 */
export function zernioInputProcessors() {
  return [
    contentPolicyProcessor,
    new PIIDetector({
      model: guardrailModel(),
      strategy: "redact",
      redactionMethod: "placeholder",
      threshold: 0.6,
      errorStrategy: "warn",
    }),
    new PromptInjectionDetector({
      model: guardrailModel(),
      threshold: 0.75,
      strategy: "block",
      errorStrategy: "warn",
    }),
    new TokenLimiterProcessor({
      limit: inputTokenLimit(),
      strategy: "abort",
    }),
    new TokenCostControl({
      maxCost: costBudgetUsd(),
      scope: "resource",
      window: costWindow(),
      strategy: "block",
      warnAtPercent: 80,
    }),
  ];
}

export function zernioOutputProcessors() {
  return [
    new ModerationProcessor({
      model: guardrailModel(),
      threshold: 0.6,
      strategy: "block",
      errorStrategy: "warn",
    }),
    contentPolicyProcessor,
    new TokenLimiterProcessor({
      limit: outputTokenLimit(),
      strategy: "truncate",
    }),
  ];
}

export { contentPolicyProcessor, sanitizeAgentText } from "./content-policy";

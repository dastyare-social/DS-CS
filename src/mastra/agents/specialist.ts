import { Agent, type ToolsInput } from "@mastra/core/agent";
import { TokenLimiterProcessor } from "@mastra/core/processors";

import { outputTokenLimit, subagentModel } from "../config";
import { contentPolicyProcessor } from "../guardrails/content-policy";

/**
 * Shared contract for every specialist.
 *
 * Specialists are delegated to by the Zernio orchestrator and answer one task
 * at a time. They deliberately do not get the model-backed guardrails: those
 * run on the orchestrator's turn, and repeating a detection call inside every
 * delegation would multiply latency and cost for the same protection. The
 * local content policy and the output token ceiling still apply here.
 */
export const SPECIALIST_PREAMBLE = `You are a specialist inside a content studio. A supervisor delegates one task to you and passes you the source material.

Rules:
- Answer the task you were given. Do not plan the wider campaign, and do not ask the supervisor questions it can answer from the channel.
- Use the tools you have before asserting anything about this channel. If the tools return nothing relevant, say so instead of inventing.
- Never invent statistics, quotes, links, dates, account names or product claims.
- If the task is missing a fact you need — platform, audience, source post, destination URL, numbers — say exactly what is missing and stop. Do not pick a default and present it as the brief.
- You cannot ask the user directly. The supervisor can; give it the one question it should ask.
- Return only the deliverable, in the structure the task asks for. No preamble, no "here is your post".
- If the task cannot be completed safely or truthfully, say what is missing in one sentence.`;

interface SpecialistOptions {
  id: string;
  name: string;
  description: string;
  instructions: string;
  tools?: ToolsInput;
}

export function createSpecialist({
  id,
  name,
  description,
  instructions,
  tools,
}: SpecialistOptions) {
  return new Agent({
    id,
    name,
    description,
    model: subagentModel(),
    instructions: `${SPECIALIST_PREAMBLE}\n\n${instructions}`,
    ...(tools ? { tools } : {}),
    outputProcessors: [
      contentPolicyProcessor,
      new TokenLimiterProcessor({
        limit: outputTokenLimit(),
        strategy: "truncate",
      }),
    ],
  });
}

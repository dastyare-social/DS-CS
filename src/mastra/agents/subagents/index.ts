import { editorAgent, repurposeEditorAgent } from "./editor";
import { newsletterWriterAgent, substackWriterAgent } from "./long-form";
import { hashtagAnalystAgent, researcherAgent } from "./research";
import { engagementAnalystAgent, plannerAgent } from "./strategy";
import { firstCommentWriterAgent, scriptWriterAgent } from "./video";
import {
  instagramWriterAgent,
  linkedinWriterAgent,
  socialWriterAgent,
  tiktokWriterAgent,
  xWriterAgent,
} from "./writers";

/**
 * The specialist roster.
 *
 * Each entry becomes an `agent-<id>` tool on the orchestrator, so the `id` is
 * part of the model-facing surface: it should say what the specialist does
 * without needing the description.
 */
export const specialistAgents = {
  "content-planner": plannerAgent,
  researcher: researcherAgent,
  "engagement-analyst": engagementAnalystAgent,
  "linkedin-writer": linkedinWriterAgent,
  "instagram-writer": instagramWriterAgent,
  "tiktok-writer": tiktokWriterAgent,
  "x-writer": xWriterAgent,
  "social-writer": socialWriterAgent,
  "script-writer": scriptWriterAgent,
  "first-comment-writer": firstCommentWriterAgent,
  "hashtag-analyst": hashtagAnalystAgent,
  "substack-writer": substackWriterAgent,
  "newsletter-writer": newsletterWriterAgent,
  editor: editorAgent,
  "repurpose-editor": repurposeEditorAgent,
};

export type SpecialistId = keyof typeof specialistAgents;

export {
  editorAgent,
  repurposeEditorAgent,
  newsletterWriterAgent,
  substackWriterAgent,
  hashtagAnalystAgent,
  researcherAgent,
  engagementAnalystAgent,
  plannerAgent,
  firstCommentWriterAgent,
  scriptWriterAgent,
  instagramWriterAgent,
  linkedinWriterAgent,
  socialWriterAgent,
  tiktokWriterAgent,
  xWriterAgent,
};

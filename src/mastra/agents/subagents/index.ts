import { editorAgent, qualityReviewerAgent, repurposeEditorAgent } from "./editor";
import { newsletterWriterAgent, substackWriterAgent } from "./long-form";
import { hashtagAnalystAgent, researcherAgent } from "./research";
import { engagementAnalystAgent, plannerAgent } from "./strategy";
import {
  firstCommentWriterAgent,
  scriptWriterAgent,
  videoAnalystAgent,
} from "./video";
import {
  instagramWriterAgent,
  linkedinWriterAgent,
  redditWriterAgent,
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
  "reddit-writer": redditWriterAgent,
  "social-writer": socialWriterAgent,
  "script-writer": scriptWriterAgent,
  "video-analyst": videoAnalystAgent,
  "first-comment-writer": firstCommentWriterAgent,
  "hashtag-analyst": hashtagAnalystAgent,
  "substack-writer": substackWriterAgent,
  "newsletter-writer": newsletterWriterAgent,
  editor: editorAgent,
  "quality-reviewer": qualityReviewerAgent,
  "repurpose-editor": repurposeEditorAgent,
};

export type SpecialistId = keyof typeof specialistAgents;

export {
  editorAgent,
  qualityReviewerAgent,
  repurposeEditorAgent,
  newsletterWriterAgent,
  substackWriterAgent,
  hashtagAnalystAgent,
  researcherAgent,
  engagementAnalystAgent,
  plannerAgent,
  firstCommentWriterAgent,
  scriptWriterAgent,
  videoAnalystAgent,
  instagramWriterAgent,
  linkedinWriterAgent,
  redditWriterAgent,
  socialWriterAgent,
  tiktokWriterAgent,
  xWriterAgent,
};

import {
  channelDataTools,
  getChannelPost,
  listChannelPosts,
} from "./channel-data";
import { knowledgeTools } from "./knowledge";
import { repurposeTools } from "./repurpose";
import { zernioWebTools } from "./web-search";

/**
 * Tool groups for the specialist agents. Keeping the groups here (rather than
 * repeating object spreads in a dozen agent files) makes it obvious what each
 * kind of specialist is allowed to reach:
 *
 * - writers read the channel, they do not browse the web;
 * - research and hashtag work browses and reads the channel;
 * - the editor can check a draft against the format playbook.
 */
export const writerTools = {
  search_channel: knowledgeTools.search_channel,
  get_channel_post: getChannelPost,
  list_channel_posts: listChannelPosts,
};

export const researchTools = {
  ...zernioWebTools,
  search_channel: knowledgeTools.search_channel,
  list_channel_posts: listChannelPosts,
  get_channel_post: getChannelPost,
  channel_stats: channelDataTools.channel_stats,
};

export const editorTools = {
  ...repurposeTools,
  search_channel: knowledgeTools.search_channel,
  get_channel_post: getChannelPost,
  channel_stats: channelDataTools.channel_stats,
};

export const plannerTools = {
  ...writerTools,
  channel_stats: channelDataTools.channel_stats,
};

export const allChannelTools = channelDataTools;

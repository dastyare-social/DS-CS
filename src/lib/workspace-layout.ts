export const WORKSPACE_GUTTER = 16;

/**
 * The workspace is three columns that fill the window: a left column, the
 * feed, and a right column. The feed is the resizable one; the right column
 * takes what is left of the window.
 */
export const WORKSPACE_LEFT = {
  min: 200,
  max: 640,
  default: 240,
} as const;

export const WORKSPACE_FEED = {
  min: 480,
  max: 960,
  default: 672,
} as const;

export const WORKSPACE_RIGHT = {
  min: 280,
  max: 640,
  default: 320,
} as const;

/**
 * The columns exist from 1024px — the narrowest viewport where the feed keeps
 * a readable width and both side columns still have room.
 */
export const WORKSPACE_BREAKPOINT = 1024;

/**
 * The Tailwind class that reveals the columns at the breakpoint. It lives next
 * to the number so the CSS and the JS can never disagree; Tailwind picks the
 * literal up from this file.
 */
export const WORKSPACE_DESKTOP_CLASS = "min-[1024px]:flex";

/**
 * The width every piece of fixed chrome has to use to sit exactly over the
 * feed: the feed's width on the desktop, the screen's width on mobile, where
 * the feed is full width.
 */
export const WORKSPACE_FEED_WIDTH_CLASS =
  "w-[min(var(--workspace-feed-width,672px),100vw)]";

/**
 * The saved widths live in a cookie, not in localStorage, because the server
 * has to be able to read them: the widths are part of the layout, and a width
 * the server cannot see is a width the first paint gets wrong.
 */
export const WORKSPACE_WIDTHS_COOKIE = "ds.workspace.widths";

/**
 * The panel ids, which are also the keys of the library's layout map.
 */
export const WORKSPACE_PANEL_IDS = {
  left: "ws-left",
  feed: "ws-feed",
  right: "ws-right",
} as const;

export type WorkspaceLayout = Record<string, number>;

/**
 * Runs before the first paint: it reads the saved widths and puts the
 * columns where they belong, so the feed is never painted at the fallback
 * width and then resized.
 *
 * The panels are sized with `flex-grow`, and the library sets that itself —
 * so the script writes the same values the first client render will produce.
 * The DOM then matches the render and there is nothing to jump.
 */
export const WORKSPACE_WIDTH_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )ds\\.workspace\\.widths=([^;]*)/);if(!m)return;var w=JSON.parse(decodeURIComponent(m[1]));var v=window.innerWidth;var left=w.left||0,feed=w.feed||0,right=Math.max(0,v-left-feed),total=left+feed+right;if(!(total>0))return;var l=Math.round(left/total*1000),f=Math.round(feed/total*1000),r=1000-l-f;var sizes={left:l,feed:f,right:r};document.documentElement.style.setProperty("--workspace-feed-width",Math.round((w.feed||0))+"px");var apply=function(){var found=false;["ws-left","ws-feed","ws-right"].forEach(function(id){var el=document.getElementById(id);if(el){el.style.flexGrow=String(sizes[id]);found=true}});return found};if(!apply()){var o=new MutationObserver(function(){if(apply()){o.disconnect()}});o.observe(document.documentElement,{childList:true,subtree:true})}}catch(e){}})();`;

/**
 * The library's layout is a map of panel id to flex-grow ratio, so the saved
 * pixel widths have to become ratios before they can be handed to it.
 */
export function layoutFromWidths(
  widths: { left: number; feed: number },
  viewportWidth: number,
): WorkspaceLayout {
  if (!(widths.left + widths.feed > 0)) {
    return {
      [WORKSPACE_PANEL_IDS.left]: 1,
      [WORKSPACE_PANEL_IDS.feed]: 1,
      [WORKSPACE_PANEL_IDS.right]: 1,
    };
  }

  const right = Math.max(0, viewportWidth - widths.left - widths.feed);
  const total = widths.left + widths.feed + right;

  if (!(total > 0)) {
    return {
      [WORKSPACE_PANEL_IDS.left]: 1,
      [WORKSPACE_PANEL_IDS.feed]: 1,
      [WORKSPACE_PANEL_IDS.right]: 1,
    };
  }

  const left = Math.round((widths.left / total) * 1000);
  const feed = Math.round((widths.feed / total) * 1000);

  return {
    [WORKSPACE_PANEL_IDS.left]: left,
    [WORKSPACE_PANEL_IDS.feed]: feed,
    [WORKSPACE_PANEL_IDS.right]: 1000 - left - feed,
  };
}

/**
 * The other direction: the library's ratios back to pixel widths, so they can
 * be saved and so the fixed chrome can be told how wide the feed is.
 */
export function widthsFromLayout(
  layout: WorkspaceLayout,
  viewportWidth: number,
): { left: number; feed: number; right: number } {
  const left = layout[WORKSPACE_PANEL_IDS.left] ?? 0;
  const feed = layout[WORKSPACE_PANEL_IDS.feed] ?? 0;
  const right = layout[WORKSPACE_PANEL_IDS.right] ?? 0;
  const total = left + feed + right;

  if (!(total > 0)) {
    return {
      left: WORKSPACE_LEFT.default,
      feed: WORKSPACE_FEED.default,
      right: WORKSPACE_RIGHT.default,
    };
  }

  return {
    left: Math.round((left / total) * viewportWidth),
    feed: Math.round((feed / total) * viewportWidth),
    right: Math.round((right / total) * viewportWidth),
  };
}

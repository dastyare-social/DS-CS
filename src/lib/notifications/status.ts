export type PushStatus =
  | "idle"
  | "loading"
  | "enabled"
  | "unsupported-browser"
  | "permission-denied"
  | "missing-vapid"
  | "error";

export function getPushStatusMessage(status: PushStatus) {
  switch (status) {
    case "enabled":
      return "Notifications are enabled. You’ll get browser alerts for new posts and stories.";
    case "unsupported-browser":
      return "This browser does not support push notifications. Please switch to Chrome, Edge, Safari, or another modern browser.";
    case "permission-denied":
      return "Notifications are blocked for this browser. Please allow notifications in your browser settings and try again.";
    case "missing-vapid":
      return "Push notifications are not configured yet. Add VAPID keys to your environment to enable them.";
    case "error":
      return "Something went wrong while enabling notifications. Please try again in a moment.";
    case "loading":
    case "idle":
    default:
      return "Get alerts for new posts and stories right in your browser.";
  }
}

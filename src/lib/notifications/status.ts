export type PushStatus =
  | "idle"
  | "loading"
  | "enabled"
  | "unsupported-browser"
  | "ios"
  | "permission-denied"
  | "missing-vapid"
  | "error";

export function getPushStatusMessage(status: PushStatus) {
  switch (status) {
    case "enabled":
      return "Notifications are enabled. You'll get browser alerts for new posts and stories. Click the button below to turn them off.";
    case "unsupported-browser":
      return "Push notifications are not supported by this browser. Please try a modern browser like Chrome or Edge.";
    case "ios":
      return "Push notifications on iOS require this site to be added to your Home Screen. Add it to your Home Screen, reopen it from there, then enable notifications.";
    case "permission-denied":
      return "Notifications are blocked for this browser. Please allow notifications in your browser settings and try again.";
    case "missing-vapid":
      return "Push notifications are not configured yet. Add VAPID keys to your environment to enable them.";
    case "error":
      return "Something went wrong while enabling notifications. Please try again in a moment.";
    case "loading":
    case "idle":
    default:
      return "Get alerts for new posts and stories. Turn on browser notifications to stay updated.";
  }
}

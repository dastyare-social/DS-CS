export type PushStatus =
  | "idle"
  | "loading"
  | "enabled"
  | "unsupported-browser"
  | "permission-denied"
  | "missing-vapid"
  | "error"
  | "not-pwa";

export function getPushStatusMessage(status: PushStatus) {
  switch (status) {
    case "enabled":
      return "Notifications are enabled. You'll get browser alerts for new posts and stories. Click the button below to turn them off.";
    case "unsupported-browser":
      return "Push notifications require installing this app to your home screen. Add to homepage first, then enable notifications.";
    case "permission-denied":
      return "Notifications are blocked for this browser. Please allow notifications in your browser settings and try again.";
    case "missing-vapid":
      return "Push notifications are not configured yet. Add VAPID keys to your environment to enable them.";
    case "error":
      return "Something went wrong while enabling notifications. Please try again in a moment.";
    case "not-pwa":
      return "To get notifications, you need to add this website to your homepage first. Then activate notifications from this modal.";
    case "loading":
    case "idle":
    default:
      return "Get alerts for new posts and stories. Install the app to your home screen for notifications.";
  }
}

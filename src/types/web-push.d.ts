declare module "web-push" {
  export interface PushSubscription {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  export interface SendNotificationOptions {
    TTL?: number;
    vapidDetails?: {
      subject: string;
      publicKey: string;
      privateKey: string;
    };
  }

  export interface WebPush {
    generateVAPIDKeys?: () => { publicKey: string; privateKey: string };
    setVapidDetails: (
      subject: string,
      publicKey: string,
      privateKey: string,
    ) => void;
    sendNotification: (
      subscription: PushSubscription,
      payload: string | Buffer | object,
      options?: SendNotificationOptions,
    ) => Promise<unknown>;
  }

  export type { PushSubscription };
  const webPush: WebPush;
  export default webPush;
}

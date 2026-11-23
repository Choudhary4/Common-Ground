import * as webpushModule from 'web-push';
import type { Types } from 'mongoose';
import { env } from '../config/env.js';
import { PushSubscription } from '../models/index.js';

const webpush =
  (webpushModule as unknown as { default?: typeof webpushModule }).default ?? webpushModule;

let configured = false;
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && typeof webpush.setVapidDetails === 'function') {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
}

export function isPushConfigured(): boolean {
  return configured;
}

export async function sendPushToUser(
  userId: string | Types.ObjectId,
  payload: { title: string; body: string; url?: string }
): Promise<{ configured: boolean; subscriptions: number; sent: number; failed: number }> {
  if (!configured) {
    return { configured: false, subscriptions: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  try {
    const subs = await PushSubscription.find({ userId }).lean();
    if (subs.length === 0) {
      return { configured: true, subscriptions: 0, sent: 0, failed: 0 };
    }

    const jsonPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/app/notifications',
    });

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            jsonPayload
          );
          sent += 1;
        } catch (err: unknown) {
          failed += 1;
          const statusCode = (err as { statusCode?: number })?.statusCode;
          console.error('Web Push delivery error:', statusCode, (err as Error)?.message);
          if (statusCode === 404 || statusCode === 410) {
            await PushSubscription.deleteOne({ _id: sub._id });
          }
        }
      })
    );

    return { configured: true, subscriptions: subs.length, sent, failed };
  } catch (err) {
    console.error('sendPushToUser error:', err);
    return { configured: true, subscriptions: 0, sent, failed: failed + 1 };
  }
}

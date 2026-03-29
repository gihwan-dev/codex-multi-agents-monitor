import {
  canInvokeTauriRuntime,
  invokeTauri,
  listenTauri,
} from "../../../shared/api";
import type {
  RecentSessionLiveSubscription,
  RecentSessionLiveUpdate,
} from "../model/types";

const RECENT_SESSION_LIVE_UPDATE_EVENT = "recent-session-live-update";

interface SubscribeRecentSessionLiveOptions {
  onUpdate: (update: RecentSessionLiveUpdate) => void;
}

export function subscribeRecentSessionLive(
  filePath: string,
  options: SubscribeRecentSessionLiveOptions,
) {
  if (!canInvokeTauriRuntime()) {
    return () => {};
  }

  let disposed = false;
  let subscriptionId: string | null = null;
  let unlisten: (() => void) | null = null;

  const stopSubscription = async () => {
    if (!subscriptionId) {
      return;
    }

    const activeSubscriptionId = subscriptionId;
    subscriptionId = null;
    await invokeTauri("stop_recent_session_live_subscription", {
      subscriptionId: activeSubscriptionId,
    }).catch(() => undefined);
  };

  void (async () => {
    try {
      unlisten = await listenTauri<RecentSessionLiveUpdate>(
        RECENT_SESSION_LIVE_UPDATE_EVENT,
        (event) => {
          if (!subscriptionId || event.payload.subscriptionId !== subscriptionId) {
            return;
          }

          options.onUpdate(event.payload);
        },
      );

      const subscription = await invokeTauri<RecentSessionLiveSubscription>(
        "start_recent_session_live_subscription",
        { filePath },
      );
      subscriptionId = subscription.subscriptionId;

      if (disposed) {
        unlisten?.();
        unlisten = null;
        await stopSubscription();
      }
    } catch {
      unlisten?.();
      unlisten = null;
      await stopSubscription();
    }
  })();

  return () => {
    if (disposed) {
      return;
    }

    disposed = true;
    unlisten?.();
    unlisten = null;
    void stopSubscription();
  };
}

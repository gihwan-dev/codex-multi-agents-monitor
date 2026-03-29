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

interface RecentLiveSubscriptionState {
  disposed: boolean;
  subscriptionId: string | null;
  unlisten: (() => void) | null;
}

function createSubscriptionState(): RecentLiveSubscriptionState {
  return {
    disposed: false,
    subscriptionId: null,
    unlisten: null,
  };
}

function clearRecentLiveListener(state: RecentLiveSubscriptionState) {
  state.unlisten?.();
  state.unlisten = null;
}

async function stopRecentLiveSubscription(state: RecentLiveSubscriptionState) {
  if (!state.subscriptionId) {
    return;
  }

  const activeSubscriptionId = state.subscriptionId;
  state.subscriptionId = null;
  await invokeTauri("stop_recent_session_live_subscription", {
    subscriptionId: activeSubscriptionId,
  }).catch(() => undefined);
}

function createRecentLiveUpdateHandler(
  state: RecentLiveSubscriptionState,
  options: SubscribeRecentSessionLiveOptions,
) {
  return (event: { payload: RecentSessionLiveUpdate }) => {
    if (
      !state.subscriptionId ||
      event.payload.subscriptionId !== state.subscriptionId
    ) {
      return;
    }

    options.onUpdate(event.payload);
  };
}

function notifyStartupFailure(
  filePath: string,
  options: SubscribeRecentSessionLiveOptions,
  state: RecentLiveSubscriptionState,
) {
  if (state.disposed) {
    return;
  }

  options.onUpdate({
    subscriptionId: "recent-live-startup-failed",
    filePath,
    connection: "disconnected",
  });
}

async function initializeRecentLiveSubscription(
  filePath: string,
  options: SubscribeRecentSessionLiveOptions,
  state: RecentLiveSubscriptionState,
) {
  try {
    await startRecentLiveSubscriptionBridge(filePath, options, state);
    if (!state.disposed) {
      return;
    }
  } catch {
    notifyStartupFailure(filePath, options, state);
  }

  clearRecentLiveListener(state);
  await stopRecentLiveSubscription(state);
}

async function startRecentLiveSubscriptionBridge(
  filePath: string,
  options: SubscribeRecentSessionLiveOptions,
  state: RecentLiveSubscriptionState,
) {
  state.unlisten = await listenTauri<RecentSessionLiveUpdate>(
    RECENT_SESSION_LIVE_UPDATE_EVENT,
    createRecentLiveUpdateHandler(state, options),
  );
  const subscription = await invokeTauri<RecentSessionLiveSubscription>(
    "start_recent_session_live_subscription",
    { filePath },
  );
  state.subscriptionId = subscription.subscriptionId;
}

export function subscribeRecentSessionLive(
  filePath: string,
  options: SubscribeRecentSessionLiveOptions,
) {
  if (!canInvokeTauriRuntime()) {
    return () => {};
  }

  const state = createSubscriptionState();

  void initializeRecentLiveSubscription(filePath, options, state);

  return () => {
    if (state.disposed) {
      return;
    }

    state.disposed = true;
    clearRecentLiveListener(state);
    void stopRecentLiveSubscription(state);
  };
}

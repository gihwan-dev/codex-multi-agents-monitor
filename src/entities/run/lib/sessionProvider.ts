import type { RunDataset } from "../model/types.js";

export function resolveMainSessionProvider(dataset: RunDataset): string | null {
  const mainLane = dataset.lanes.find(
    (lane) => lane.threadId === dataset.session.sessionId,
  );
  if (mainLane?.provider) {
    return mainLane.provider;
  }

  return (
    dataset.events.find((event) => event.threadId === dataset.session.sessionId)
      ?.provider ?? null
  );
}

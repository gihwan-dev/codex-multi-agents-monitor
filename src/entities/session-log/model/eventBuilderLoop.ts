import type { EventRecord } from "../../run";

interface LaneEventLoopResult {
  event: EventRecord | null;
  firstUserPromptSeen: boolean;
}

interface BuildLaneEventLoopOptions {
  entryCount: number;
  buildEntryResult: (
    index: number,
    events: EventRecord[],
    firstUserPromptSeen: boolean,
  ) => LaneEventLoopResult;
}

export function buildLaneEventLoop(
  options: BuildLaneEventLoopOptions,
): EventRecord[] {
  const events: EventRecord[] = [];
  let firstUserPromptSeen = false;

  for (let index = 0; index < options.entryCount; index++) {
    const result = options.buildEntryResult(index, events, firstUserPromptSeen);
    firstUserPromptSeen = applyLaneEventResult(events, result);
  }

  return events;
}

function applyLaneEventResult(
  events: EventRecord[],
  result: LaneEventLoopResult,
) {
  if (result.event) {
    deduplicateOrAppend(events, result.event);
  }
  return result.firstUserPromptSeen;
}

function deduplicateOrAppend(events: EventRecord[], event: EventRecord) {
  const last = events[events.length - 1];
  const isCompactedPair =
    last?.title === "Context compacted" &&
    event.title === "Context compacted" &&
    last.startTs === event.startTs;

  if (isCompactedPair) {
    if (last.outputPreview === "Context reduced to fit within the model window") {
      events[events.length - 1] = event;
    }
    return;
  }

  events.push(event);
}

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
    events.push(result.event);
  }
  return result.firstUserPromptSeen;
}

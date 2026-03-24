import type { EventRecord } from "../../run";
import { buildTimedSubagentSnapshots } from "../lib/helpers";
import { buildSessionLinkMaps, indexSubagents } from "../lib/sessionLinks";
import type { SessionLinkContext } from "./subagentLinkTypes";
import type { SessionLogSnapshot, TimedSubagentSnapshot } from "./types";

export interface SubagentTimelineContext {
  subagents: TimedSubagentSnapshot[];
  indexedSubagents: ReturnType<typeof indexSubagents>;
  subagentToSpawnSource: Map<string, string>;
  waitAgentErrors: Map<string, string>;
  sessionLinks: SessionLinkContext;
}

interface CreateSubagentTimelineContextOptions {
  snapshot: SessionLogSnapshot;
  parentEvents: EventRecord[];
}

export function createSubagentTimelineContext(
  options: CreateSubagentTimelineContextOptions,
): SubagentTimelineContext {
  const subagents = buildTimedSubagentSnapshots(options.snapshot.subagents ?? []);
  const indexedSubagents = indexSubagents(subagents);
  const sessionLinkMaps = buildSessionLinkMaps({
    sessionId: options.snapshot.sessionId,
    entries: options.snapshot.entries,
    parentEvents: options.parentEvents,
    subagents,
    indexedSubagents,
  });

  return {
    subagents,
    indexedSubagents,
    subagentToSpawnSource: sessionLinkMaps.subagentToSpawnSource,
    waitAgentErrors: sessionLinkMaps.waitAgentErrors,
    sessionLinks: {
      callEventToOutputEvent: sessionLinkMaps.callEventToOutputEvent,
      codexAgentIdToSessionId: sessionLinkMaps.codexAgentIdToSessionId,
      parentFunctionArgsByEventId: sessionLinkMaps.parentFunctionArgsByEventId,
    },
  };
}

import type { EventRecord } from "../../run";
import type { SessionLogSnapshot, TimedSubagentSnapshot } from "../model/types";
import { buildCallMaps } from "./sessionLinkCallMaps";
import {
  collectOutputLinks,
  fillMissingSpawnSourceEvents,
} from "./sessionLinkOutputCollection";
import type { IndexedSubagents, SessionLinkMaps } from "./sessionLinkTypes";

export function buildSessionLinkMaps(options: {
  sessionId: string;
  entries: SessionLogSnapshot["entries"];
  parentEvents: EventRecord[];
  subagents: TimedSubagentSnapshot[];
  indexedSubagents: IndexedSubagents;
}): SessionLinkMaps {
  const { sessionId, entries, parentEvents, subagents, indexedSubagents } = options;
  const callMaps = buildCallMaps({ sessionId, entries });
  const sessionLinks = buildEmptySessionLinks();

  collectOutputLinks({
    sessionId,
    entries,
    indexedSubagents,
    callMaps,
    sessionLinks,
  });
  fillMissingSpawnSourceEvents({
    parentEvents,
    subagents,
    subagentToSpawnSource: sessionLinks.subagentToSpawnSource,
  });

  return sessionLinks;
}

function buildEmptySessionLinks(): SessionLinkMaps {
  return {
    subagentToSpawnSource: new Map(),
    waitAgentErrors: new Map(),
    codexAgentIdToSessionId: new Map(),
    callEventToOutputEvent: new Map(),
    parentFunctionArgsByEventId: new Map(),
  };
}

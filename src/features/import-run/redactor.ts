import type { EventRecord } from "../../entities/run";

export interface RedactionOptions {
  allowRaw: boolean;
  noRawStorage: boolean;
}

export function redactEvent(event: EventRecord, options: RedactionOptions): EventRecord {
  if (options.noRawStorage || !options.allowRaw) {
    return {
      ...event,
      rawInput: null,
      rawOutput: null,
    };
  }

  return event;
}

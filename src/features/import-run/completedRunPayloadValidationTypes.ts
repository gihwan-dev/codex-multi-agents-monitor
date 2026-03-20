import type { RawImportPayload } from "../../entities/run";

export type ValidatedCompletedRunPayload = Pick<
  RawImportPayload,
  "project" | "session" | "run" | "lanes" | "events" | "edges" | "artifacts" | "promptAssembly"
>;

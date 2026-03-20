import type { RawImportPayload } from "../../entities/run";
import { validateCompletedRunPayload } from "./completedRunPayloadValidation";

export function parseCompletedRunPayload(input: string): RawImportPayload {
  return validateCompletedRunPayload(JSON.parse(input) as unknown);
}

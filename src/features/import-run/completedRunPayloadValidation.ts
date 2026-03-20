import type { RawImportPayload } from "../../entities/run";
import { validatePayloadReferences } from "./completedRunPayloadReferenceValidation";
import { validateCompletedRunPayloadShape } from "./completedRunPayloadShapeValidation";

export function validateCompletedRunPayload(parsed: unknown): RawImportPayload {
  const payload = validateCompletedRunPayloadShape(parsed);
  validatePayloadReferences(payload);
  return payload;
}

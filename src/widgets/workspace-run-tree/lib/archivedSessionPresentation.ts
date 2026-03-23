import type { ArchivedSessionIndexItem } from "../../../entities/session-log";
import { deriveArchiveIndexTitle } from "../../../entities/session-log";

export function deriveArchivedSessionTitle(session: ArchivedSessionIndexItem): string {
  return deriveArchiveIndexTitle(session.firstUserMessage) ?? formatArchivedSessionDate(session.startedAt);
}

export function formatArchivedSessionDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

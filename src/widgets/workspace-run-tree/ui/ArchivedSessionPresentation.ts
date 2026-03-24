import type { ArchivedSessionIndexItem } from "../../../entities/session-log";
import { deriveArchiveIndexTitle } from "../../../entities/session-log";

export function deriveArchiveItemTitle(session: ArchivedSessionIndexItem): string {
  return deriveArchiveIndexTitle(session.firstUserMessage) ?? formatArchiveDate(session.startedAt);
}

export function formatArchiveDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }

  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ];

  return `${parts[0]}-${parts[1]}-${parts[2]} ${parts[3]}:${parts[4]}`;
}

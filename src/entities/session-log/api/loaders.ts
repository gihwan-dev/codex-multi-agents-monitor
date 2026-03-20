import { invokeTauri } from "../../../shared/api";
import type { ArchivedSessionIndexResult, RunDataset } from "../../run";
import { buildDatasetFromSessionLog } from "../model/datasetBuilder";
import type { SessionLogSnapshot } from "../model/types";

export {
  deriveArchiveIndexTitle,
  deriveSessionLogStatus,
  deriveSessionLogTitle,
} from "../lib/text";
export { buildDatasetFromSessionLog } from "../model/datasetBuilder";
export type {
  SessionEntrySnapshot,
  SessionLogSnapshot,
  SubagentSnapshot,
} from "../model/types";
export { NEW_THREAD_TITLE } from "../model/types";

const WEB_SESSION_SNAPSHOT_URL = "/__codex/session-snapshots.json";

function normalizeArchivedSearch(search?: string) {
  const normalized = search?.trim();
  return normalized ? normalized : null;
}

export async function loadSessionLogDatasets(): Promise<RunDataset[] | null> {
  try {
    return normalizeSessionLogDatasets(
      await invokeTauri<SessionLogSnapshot[]>("load_recent_session_snapshots"),
    );
  } catch {
    return loadWebSessionLogDatasets();
  }
}

function normalizeSessionLogDatasets(snapshots: SessionLogSnapshot[] | null | undefined) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return null;
  }

  const datasets = snapshots
    .map((snapshot) => buildDatasetFromSessionLog(snapshot))
    .filter((dataset): dataset is RunDataset => dataset !== null);

  return datasets.length > 0 ? datasets : null;
}

async function loadWebSessionLogDatasets(): Promise<RunDataset[] | null> {
  try {
    const response = await fetch(WEB_SESSION_SNAPSHOT_URL, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    return normalizeSessionLogDatasets((await response.json()) as SessionLogSnapshot[]);
  } catch {
    return null;
  }
}

export async function loadArchivedSessionIndex(
  offset: number,
  limit: number,
  search?: string,
): Promise<ArchivedSessionIndexResult | null> {
  try {
    return await invokeTauri<ArchivedSessionIndexResult>(
      "load_archived_session_index",
      { offset, limit, search: normalizeArchivedSearch(search) },
    );
  } catch {
    return null;
  }
}

export async function loadArchivedSessionSnapshot(
  filePath: string,
): Promise<RunDataset | null> {
  try {
    const snapshot = await invokeTauri<SessionLogSnapshot | null>(
      "load_archived_session_snapshot",
      { filePath },
    );
    if (!snapshot) return null;
    return buildDatasetFromSessionLog(snapshot);
  } catch {
    return null;
  }
}

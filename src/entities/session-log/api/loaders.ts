import { invokeTauri } from "../../../shared/api";
import type { RunDataset } from "../../run";
import { buildDatasetFromSessionLogAsync } from "../model/datasetBuilderAsync";
import type {
  ArchivedSessionIndexResult,
  RecentSessionIndexItem,
  SessionLogSnapshot,
} from "../model/types";

const WEB_SESSION_SNAPSHOT_URL = "/__codex/session-snapshots.json";

function normalizeArchivedSearch(search?: string) {
  const normalized = search?.trim();
  return normalized ? normalized : null;
}

export async function loadSessionLogDatasets(): Promise<RunDataset[] | null> {
  try {
    const index = await loadRecentSessionIndex();
    if (index === null) {
      return loadWebSessionLogDatasets();
    }
    return loadIndexedSessionLogDatasets(index);
  } catch {
    return loadWebSessionLogDatasets();
  }
}

async function normalizeSessionLogDatasets(
  snapshots: SessionLogSnapshot[] | null | undefined,
) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return null;
  }

  const datasets = (
    await Promise.all(
      snapshots.map((snapshot) => buildDatasetFromSessionLogAsync(snapshot)),
    )
  ).filter((dataset): dataset is RunDataset => dataset !== null);

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

export async function loadRecentSessionIndex(): Promise<RecentSessionIndexItem[] | null> {
  try {
    const items = await invokeTauri<RecentSessionIndexItem[]>("load_recent_session_index");
    return Array.isArray(items) && items.length > 0 ? items : [];
  } catch {
    return null;
  }
}

export async function loadRecentSessionSnapshot(
  filePath: string,
): Promise<RunDataset | null> {
  try {
    return loadSnapshotDataset("load_recent_session_snapshot", filePath);
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
    return loadSnapshotDataset("load_archived_session_snapshot", filePath);
  } catch {
    return null;
  }
}

async function loadIndexedSessionLogDatasets(
  index: RecentSessionIndexItem[],
): Promise<RunDataset[] | null> {
  if (!index.length) {
    return null;
  }

  const snapshots = await Promise.all(index.map(loadIndexedSnapshot));
  return normalizeSessionLogDatasets(
    snapshots.filter((snapshot): snapshot is SessionLogSnapshot => snapshot !== null),
  );
}

function loadIndexedSnapshot(item: RecentSessionIndexItem) {
  return invokeTauri<SessionLogSnapshot | null>("load_recent_session_snapshot", {
    filePath: item.filePath,
  }).catch(() => null);
}

async function loadSnapshotDataset(
  command:
    | "load_archived_session_snapshot"
    | "load_recent_session_snapshot",
  filePath: string,
) {
  const snapshot = await invokeTauri<SessionLogSnapshot | null>(command, { filePath });
  return snapshot ? buildDatasetFromSessionLogAsync(snapshot) : null;
}

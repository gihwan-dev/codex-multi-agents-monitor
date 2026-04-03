import { useDeferredValue, useMemo, useState } from "react";
import type {
  RunDataset,
  WorkspaceScoreFilterKey,
  WorkspaceScoreSortKey,
} from "../../../entities/run";
import type { RecentSessionIndexItem } from "../../../entities/session-log";
import type { WorkspaceIdentityOverrideMap } from "../../../entities/workspace";
import { buildSidebarTreeModel } from "../lib/sidebarTreeModel";

function useWorkspaceTreeControls() {
  const [search, setSearch] = useState("");
  const [scoreSort, setScoreSort] = useState<WorkspaceScoreSortKey>("recent");
  const [scoreFilter, setScoreFilter] = useState<WorkspaceScoreFilterKey>("all");

  return {
    scoreFilter,
    scoreSort,
    search,
    setScoreFilter,
    setScoreSort,
    setSearch,
  };
}

function useWorkspaceTreeModelMemo(options: {
  datasets: RunDataset[];
  recentIndex: RecentSessionIndexItem[];
  recentIndexReady: boolean;
  scoreFilter: WorkspaceScoreFilterKey;
  scoreSort: WorkspaceScoreSortKey;
  search: string;
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap;
}) {
  const deferredSearch = useDeferredValue(options.search);

  return useMemo(
    () =>
      buildSidebarTreeModel({
        datasets: options.datasets,
        recentIndex: options.recentIndex,
        recentIndexReady: options.recentIndexReady,
        search: deferredSearch,
        scoreFilter: options.scoreFilter,
        scoreSort: options.scoreSort,
        workspaceIdentityOverrides: options.workspaceIdentityOverrides,
      }),
    [
      options.datasets,
      options.recentIndex,
      options.recentIndexReady,
      deferredSearch,
      options.scoreFilter,
      options.scoreSort,
      options.workspaceIdentityOverrides,
    ],
  );
}

export function useWorkspaceTreeModel(options: {
  datasets: RunDataset[];
  recentIndex: RecentSessionIndexItem[];
  recentIndexReady: boolean;
  workspaceIdentityOverrides: WorkspaceIdentityOverrideMap;
}) {
  const controls = useWorkspaceTreeControls();
  const model = useWorkspaceTreeModelMemo({
    ...options,
    scoreFilter: controls.scoreFilter,
    scoreSort: controls.scoreSort,
    search: controls.search,
  });

  return {
    model,
    ...controls,
  };
}

import { useEffect, useState } from "react";
import type { RunDataset, WorkspaceIdentityOverrideMap } from "../../../entities/run";
import { resolveWorkspaceIdentityOverrides } from "../lib/workspaceIdentityResolver";

export function useWorkspaceIdentityOverrides(datasets: RunDataset[]) {
  const [workspaceIdentityOverrides, setWorkspaceIdentityOverrides] =
    useState<WorkspaceIdentityOverrideMap>({});

  useEffect(() => {
    let cancelled = false;

    resolveWorkspaceIdentityOverrides(datasets).then((nextOverrides) => {
      if (!cancelled) {
        setWorkspaceIdentityOverrides(nextOverrides);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [datasets]);

  return workspaceIdentityOverrides;
}

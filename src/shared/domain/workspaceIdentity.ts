import type {
  RunDataset,
  WorkspaceIdentityOverride,
  WorkspaceIdentityOverrideMap,
} from "./types.js";

export function buildFallbackWorkspaceIdentityMap(
  datasets: RunDataset[],
): WorkspaceIdentityOverrideMap {
  return datasets.reduce<WorkspaceIdentityOverrideMap>((map, dataset) => {
    const { repoPath, name } = dataset.project;
    if (map[repoPath]) {
      return map;
    }

    map[repoPath] = {
      originPath: repoPath,
      displayName: resolveFallbackWorkspaceDisplayName(name, repoPath),
      isWorktree: false,
    };
    return map;
  }, {});
}

export function buildResolvedWorkspaceIdentityMap(
  fallbackMap: WorkspaceIdentityOverrideMap,
  overrides: Map<string, WorkspaceIdentityOverride>,
): WorkspaceIdentityOverrideMap {
  return Object.fromEntries(
    Object.entries(fallbackMap).map(([repoPath, fallback]) => [
      repoPath,
      overrides.get(repoPath) ?? fallback,
    ]),
  );
}

export function sanitizeWorkspaceIdentity(
  identity: Partial<WorkspaceIdentityOverride>,
  fallback: WorkspaceIdentityOverride,
): WorkspaceIdentityOverride {
  return {
    originPath:
      typeof identity.originPath === "string" && identity.originPath.trim().length
        ? identity.originPath
        : fallback.originPath,
    displayName:
      typeof identity.displayName === "string" && identity.displayName.trim().length
        ? identity.displayName
        : fallback.displayName,
    isWorktree:
      typeof identity.isWorktree === "boolean" ? identity.isWorktree : fallback.isWorktree,
  };
}

function resolveFallbackWorkspaceDisplayName(name: string, repoPath: string) {
  const trimmedName = name.trim();
  if (trimmedName.length) {
    return trimmedName;
  }

  const normalizedPath = repoPath.replace(/[\\/]+$/, "");
  const segments = normalizedPath.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? repoPath;
}

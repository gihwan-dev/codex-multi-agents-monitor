import type {
  RunDataset,
  WorkspaceIdentityOverride,
  WorkspaceIdentityOverrideMap,
} from "../shared/domain";
import { invokeTauri } from "./tauri";

const identityCache = new Map<string, WorkspaceIdentityOverride>();

export async function resolveWorkspaceIdentityOverrides(
  datasets: RunDataset[],
): Promise<WorkspaceIdentityOverrideMap> {
  const fallbackMap = buildFallbackIdentityMap(datasets);
  const repoPaths = Object.keys(fallbackMap).filter((repoPath) => !identityCache.has(repoPath));

  if (repoPaths.length && typeof window !== "undefined") {
    try {
      const resolved = await invokeTauri<Record<string, Partial<WorkspaceIdentityOverride>>>(
        "resolve_workspace_identities",
        {
          repoPaths,
        },
      );

      Object.entries(resolved).forEach(([repoPath, identity]) => {
        const fallback = fallbackMap[repoPath];
        if (!fallback) {
          return;
        }
        identityCache.set(repoPath, sanitizeWorkspaceIdentity(identity, fallback));
      });
    } catch {
      // Web/Storybook should quietly keep fallback labels when native resolution is unavailable.
    }
  }

  return Object.fromEntries(
    Object.entries(fallbackMap).map(([repoPath, fallback]) => [
      repoPath,
      identityCache.get(repoPath) ?? fallback,
    ]),
  );
}

function buildFallbackIdentityMap(datasets: RunDataset[]): WorkspaceIdentityOverrideMap {
  return datasets.reduce<WorkspaceIdentityOverrideMap>((map, dataset) => {
    const { repoPath, name } = dataset.project;
    if (map[repoPath]) {
      return map;
    }

    map[repoPath] = {
      originPath: repoPath,
      displayName: resolveFallbackDisplayName(name, repoPath),
      isWorktree: false,
    };
    return map;
  }, {});
}

function sanitizeWorkspaceIdentity(
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
    isWorktree: typeof identity.isWorktree === "boolean" ? identity.isWorktree : fallback.isWorktree,
  };
}

function resolveFallbackDisplayName(name: string, repoPath: string) {
  const trimmedName = name.trim();
  if (trimmedName.length) {
    return trimmedName;
  }

  const normalizedPath = repoPath.replace(/[\\/]+$/, "");
  const segments = normalizedPath.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? repoPath;
}

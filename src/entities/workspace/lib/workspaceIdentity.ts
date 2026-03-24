import type { RunDataset } from "../../run";
import type {
  WorkspaceIdentityOverride,
  WorkspaceIdentityOverrideMap,
} from "../model/types";

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

interface SanitizeWorkspaceIdentityOptions {
  identity: Partial<WorkspaceIdentityOverride>;
  fallback: WorkspaceIdentityOverride;
}

export function sanitizeWorkspaceIdentity(
  options: SanitizeWorkspaceIdentityOptions,
): WorkspaceIdentityOverride {
  const { identity, fallback } = options;
  return {
    originPath: resolveIdentityString(identity.originPath, fallback.originPath),
    displayName: resolveIdentityString(identity.displayName, fallback.displayName),
    isWorktree: resolveIdentityBoolean(identity.isWorktree, fallback.isWorktree),
  };
}

function resolveIdentityString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length ? value : fallback;
}

function resolveIdentityBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
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

import {
  buildFallbackWorkspaceIdentityMap,
  buildResolvedWorkspaceIdentityMap,
  type RunDataset,
  sanitizeWorkspaceIdentity,
  type WorkspaceIdentityOverride,
  type WorkspaceIdentityOverrideMap,
} from "../shared/domain";
import {
  canResolveWorkspaceIdentityInTauri,
  resolveWorkspaceIdentityLookup,
  type WorkspaceIdentityLookup,
} from "./workspace-identity/tauriWorkspaceIdentityLookup";

interface CreateWorkspaceIdentityResolverOptions {
  cache?: Map<string, WorkspaceIdentityOverride>;
  canResolve?: () => boolean;
  lookup?: (repoPaths: string[]) => Promise<WorkspaceIdentityLookup>;
}

function resolveMissingRepoPaths(
  fallbackMap: WorkspaceIdentityOverrideMap,
  cache: Map<string, WorkspaceIdentityOverride>,
  failedRepoPaths: Set<string>,
) {
  return Object.keys(fallbackMap).filter(
    (repoPath) => !cache.has(repoPath) && !failedRepoPaths.has(repoPath),
  );
}

export function createWorkspaceIdentityResolver({
  cache = new Map<string, WorkspaceIdentityOverride>(),
  canResolve = canResolveWorkspaceIdentityInTauri,
  lookup = resolveWorkspaceIdentityLookup,
}: CreateWorkspaceIdentityResolverOptions = {}) {
  const failedRepoPaths = new Set<string>();

  return async function resolveWorkspaceIdentityOverrides(
    datasets: RunDataset[],
  ): Promise<WorkspaceIdentityOverrideMap> {
    const fallbackMap = buildFallbackWorkspaceIdentityMap(datasets);
    const missingRepoPaths = resolveMissingRepoPaths(fallbackMap, cache, failedRepoPaths);

    if (missingRepoPaths.length && canResolve()) {
      try {
        const resolved = await lookup(missingRepoPaths);

        Object.entries(resolved).forEach(([repoPath, identity]) => {
          const fallback = fallbackMap[repoPath];
          if (!fallback) {
            return;
          }
          cache.set(repoPath, sanitizeWorkspaceIdentity(identity, fallback));
        });
      } catch {
        // Web/Storybook should quietly keep fallback labels when native resolution is unavailable.
        missingRepoPaths.forEach((repoPath) => {
          failedRepoPaths.add(repoPath);
        });
      }
    }

    return buildResolvedWorkspaceIdentityMap(fallbackMap, cache);
  };
}

export const resolveWorkspaceIdentityOverrides = createWorkspaceIdentityResolver({
  cache: new Map<string, WorkspaceIdentityOverride>(),
});

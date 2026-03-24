import type { RunDataset } from "../../../entities/run";
import {
  buildFallbackWorkspaceIdentityMap,
  buildResolvedWorkspaceIdentityMap,
  sanitizeWorkspaceIdentity,
  type WorkspaceIdentityOverride,
  type WorkspaceIdentityOverrideMap,
} from "../../../entities/workspace";
import {
  canResolveWorkspaceIdentityInTauri,
  resolveWorkspaceIdentityLookup,
  type WorkspaceIdentityLookup,
} from "../api/tauriWorkspaceIdentityLookup";

interface CreateWorkspaceIdentityResolverOptions {
  cache?: Map<string, WorkspaceIdentityOverride>;
  canResolve?: () => boolean;
  lookup?: (repoPaths: string[]) => Promise<WorkspaceIdentityLookup>;
}

function resolveMissingRepoPaths(
  fallbackMap: WorkspaceIdentityOverrideMap,
  cache: Map<string, WorkspaceIdentityOverride>,
) {
  return Object.keys(fallbackMap).filter((repoPath) => !cache.has(repoPath));
}

export function createWorkspaceIdentityResolver({
  cache = new Map<string, WorkspaceIdentityOverride>(),
  canResolve = canResolveWorkspaceIdentityInTauri,
  lookup = resolveWorkspaceIdentityLookup,
}: CreateWorkspaceIdentityResolverOptions = {}) {
  return async function resolveWorkspaceIdentityOverrides(
    datasets: RunDataset[],
  ): Promise<WorkspaceIdentityOverrideMap> {
    const fallbackMap = buildFallbackWorkspaceIdentityMap(datasets);
    const missingRepoPaths = resolveMissingRepoPaths(fallbackMap, cache);

    if (missingRepoPaths.length && canResolve()) {
      try {
        const resolved = await lookup(missingRepoPaths);

        Object.entries(resolved).forEach(([repoPath, identity]) => {
          const fallback = fallbackMap[repoPath];
          if (!fallback) {
            return;
          }
          cache.set(repoPath, sanitizeWorkspaceIdentity({ identity, fallback }));
        });
      } catch {
        // Web/Storybook should quietly keep fallback labels when native resolution is unavailable.
      }
    }

    return buildResolvedWorkspaceIdentityMap(fallbackMap, cache);
  };
}

export const resolveWorkspaceIdentityOverrides = createWorkspaceIdentityResolver({
  cache: new Map<string, WorkspaceIdentityOverride>(),
});

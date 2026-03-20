import type { WorkspaceIdentityOverride } from "../../shared/domain";
import { invokeTauri } from "../tauri";

export type WorkspaceIdentityLookup = Record<string, Partial<WorkspaceIdentityOverride>>;

export function canResolveWorkspaceIdentityInTauri() {
  return (
    typeof window !== "undefined" &&
    typeof window.__TAURI_INTERNALS__?.invoke === "function"
  );
}

export function resolveWorkspaceIdentityLookup(
  repoPaths: string[],
): Promise<WorkspaceIdentityLookup> {
  return invokeTauri<WorkspaceIdentityLookup>("resolve_workspace_identities", {
    repoPaths,
  });
}

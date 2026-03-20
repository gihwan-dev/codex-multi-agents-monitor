export interface WorkspaceIdentityOverride {
  originPath: string;
  displayName: string;
  isWorktree: boolean;
}

export type WorkspaceIdentityOverrideMap = Record<string, WorkspaceIdentityOverride>;

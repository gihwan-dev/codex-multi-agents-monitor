import { useWorkspaceTreeSelectionSync } from "./workspaceTreeStateHelpers";

export function useWorkspaceTreeSelectionState(
  options: Parameters<typeof useWorkspaceTreeSelectionSync>[0],
) {
  useWorkspaceTreeSelectionSync(options);
}

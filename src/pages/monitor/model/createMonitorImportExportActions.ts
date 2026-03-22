import {
  type Dispatch,
  startTransition,
} from "react";
import {
  buildExportPayload,
  normalizeImportPayload,
  parseCompletedRunPayload,
} from "../../../features/import-run";
import type {
  MonitorAction,
  MonitorState,
} from "./state";

interface CreateMonitorImportExportActionsOptions {
  importText: string;
  allowRawImport: boolean;
  noRawStorage: boolean;
  dispatch: Dispatch<MonitorAction>;
  activeDataset: MonitorState["datasets"][number] | null;
}

export function createMonitorImportExportActions({
  importText,
  allowRawImport,
  noRawStorage,
  dispatch,
  activeDataset,
}: CreateMonitorImportExportActionsOptions) {
  return {
    setImportText(value: string) {
      dispatch({ type: "set-import-text", value });
    },
    setAllowRaw(value: boolean) {
      dispatch({ type: "set-allow-raw", value });
    },
    setNoRawStorage(value: boolean) {
      dispatch({ type: "set-no-raw", value });
    },
    importPayload() {
      try {
        const parsed = parseCompletedRunPayload(importText);
        const dataset = normalizeImportPayload(parsed, {
          allowRaw: allowRawImport,
          noRawStorage,
        });

        startTransition(() => {
          dispatch({ type: "import-dataset", dataset });
        });
      } catch (error) {
        dispatch({
          type: "set-export-text",
          value: error instanceof Error ? error.message : "Import failed.",
          open: true,
        });
      }
    },
    exportDataset(includeRaw = false) {
      if (!activeDataset) {
        dispatch({
          type: "set-export-text",
          value: "No run is loaded yet.",
          open: true,
        });
        return;
      }

      dispatch({
        type: "set-export-text",
        value: buildExportPayload(
          activeDataset,
          includeRaw && activeDataset.run.rawIncluded,
        ),
        open: true,
      });
    },
  };
}

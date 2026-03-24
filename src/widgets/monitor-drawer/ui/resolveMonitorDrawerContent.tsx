import type { ReactNode } from "react";

import type { DrawerTab } from "../../../entities/run";
import { ArtifactList } from "./MonitorDrawerArtifactList";
import { ContextTab } from "./MonitorDrawerContextTab";
import { ImportTab } from "./MonitorDrawerImportTab";
import { LogTab } from "./MonitorDrawerLogTab";
import { RawTab } from "./MonitorDrawerRawTab";
import type { MonitorDrawerContentProps } from "./MonitorDrawerSections";

export function resolveMonitorDrawerContent(options: MonitorDrawerContentProps): ReactNode {
  const renderers = {
    artifacts: () => <ArtifactList activeDataset={options.activeDataset} placeholder={options.placeholder} />,
    context: () => <ContextTab activeDataset={options.activeDataset} placeholder={options.placeholder} />,
    import: () => <ImportTab drawerState={options.drawerState} onImport={options.onImport} onImportTextChange={options.onImportTextChange} onAllowRawChange={options.onAllowRawChange} onNoRawChange={options.onNoRawChange} />,
    log: () => <LogTab exportText={options.drawerState.exportText} />,
    raw: () => <RawTab activeDataset={options.activeDataset} />,
  } satisfies Record<DrawerTab, () => ReactNode>;

  return renderers[options.drawerState.drawerTab]();
}

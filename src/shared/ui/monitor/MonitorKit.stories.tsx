import type { Meta } from "@storybook/react-vite";
import { useState } from "react";
import { InspectorTabs } from "./InspectorTabs";
import { MetricPill } from "./MetricPill";
import { Panel } from "./Panel";
import { StatusChip, type StatusChipStatus } from "./StatusChip";

const meta = {
  title: "Monitor Composites/Monitor Kit",
  render: () => <MonitorKitPreview />,
} satisfies Meta;

export default meta;

export const Default = {};

function MonitorKitPreview() {
  const [tab, setTab] = useState("artifacts");
  const statuses: StatusChipStatus[] = [
    "queued",
    "running",
    "waiting",
    "blocked",
    "done",
    "failed",
  ];

  return (
    <div className="grid gap-6 p-6">
      <Panel title="Status surfaces" className="gap-4">
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <StatusChip key={status} status={status} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <StatusChip key={`${status}-subtle`} status={status} subtle />
          ))}
        </div>
      </Panel>

      <Panel title="Summary strip pieces" className="gap-4">
        <div className="flex flex-wrap gap-2">
          <MetricPill label="Agents" value="12" />
          <MetricPill label="Tokens" value="44.2k" />
          <MetricPill label="Cost" value="$1.28" />
        </div>
      </Panel>

      <Panel title="Inspector tabs" className="gap-4">
        <InspectorTabs
          value={tab}
          options={[
            { value: "artifacts", label: "artifacts" },
            { value: "context", label: "context" },
            { value: "log", label: "log" },
          ]}
          onValueChange={setTab}
        />
      </Panel>
    </div>
  );
}

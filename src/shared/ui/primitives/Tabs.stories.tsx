import type { Meta } from "@storybook/react-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
  title: "Primitives/Tabs",
  render: () => <TabsShowcase />,
} satisfies Meta;

export default meta;

export const Default = {};

function TabsShowcase() {
  return (
    <div className="max-w-xl p-6">
      <Tabs defaultValue="graph">
        <TabsList className="bg-white/[0.04]">
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="context">Context</TabsTrigger>
          <TabsTrigger value="log">Log</TabsTrigger>
        </TabsList>
        <TabsContent value="graph" className="rounded-[var(--radius-panel)] border border-white/8 bg-[var(--color-panel)] p-4">
          Dense causal graph with lane-focused debugging.
        </TabsContent>
        <TabsContent value="context" className="rounded-[var(--radius-panel)] border border-white/8 bg-[var(--color-panel)] p-4">
          Prompt context layers and import policy.
        </TabsContent>
        <TabsContent value="log" className="rounded-[var(--radius-panel)] border border-white/8 bg-[var(--color-panel)] p-4">
          Export log and replay notes.
        </TabsContent>
      </Tabs>
    </div>
  );
}

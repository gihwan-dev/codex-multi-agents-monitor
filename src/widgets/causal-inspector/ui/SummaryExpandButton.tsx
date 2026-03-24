import { Maximize2Icon } from "lucide-react";
import { useState } from "react";
import type { InspectorCausalSummary } from "../../../entities/run";
import { TextViewerModal, type TextViewerSection } from "../../../shared/ui/monitor/TextViewerModal";
import { Button } from "../../../shared/ui/primitives";

function buildTextViewerSections(summary: InspectorCausalSummary): TextViewerSection[] {
  const input = summary.rawInput ?? summary.inputPreview;
  const output = summary.rawOutput ?? summary.outputPreview;
  const sections: TextViewerSection[] = [
    ...(input ? [{ label: "Input", content: input }] : []),
    ...(output ? [{ label: "Output", content: output }] : []),
  ];
  if (sections.length === 0) {
    sections.push({ label: "Preview", content: summary.preview !== "n/a" ? summary.preview : null });
  }
  return sections;
}

export function SummaryExpandButton({ summary }: { summary: InspectorCausalSummary }) {
  const [viewerOpen, setViewerOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        className="absolute top-2 right-2 z-10 opacity-60 hover:opacity-100"
        onClick={() => setViewerOpen(true)}
        aria-label="Expand preview"
      >
        <Maximize2Icon />
      </Button>
      <TextViewerModal
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        title={summary.title}
        sections={buildTextViewerSections(summary)}
      />
    </>
  );
}

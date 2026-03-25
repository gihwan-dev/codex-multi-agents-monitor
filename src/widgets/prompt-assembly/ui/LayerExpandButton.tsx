import { Maximize2Icon } from "lucide-react";
import { useState } from "react";
import { TextViewerModal } from "../../../shared/ui/monitor/TextViewerModal";
import { Button } from "../../../shared/ui/primitives";

export function LayerExpandButton({ label, content }: { label: string; content: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mb-2 flex justify-end">
        <Button
          variant="ghost"
          size="icon-xs"
          className="opacity-50 hover:opacity-100"
          onClick={() => setOpen(true)}
          aria-label="Expand layer content"
        >
          <Maximize2Icon />
        </Button>
      </div>
      <TextViewerModal
        open={open}
        onOpenChange={setOpen}
        title={label}
        sections={[{ label: "Content", content }]}
      />
    </>
  );
}

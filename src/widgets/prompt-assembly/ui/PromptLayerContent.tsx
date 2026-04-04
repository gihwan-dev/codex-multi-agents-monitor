import { LayerExpandButton } from "./LayerExpandButton";

interface PromptLayerContentProps {
  label: string;
  preview: string;
  rawContent: string | null;
}

export function PromptLayerContent({ label, preview, rawContent }: PromptLayerContentProps) {
  const displayText = rawContent ?? preview;
  return (
    <div
      data-slot="prompt-layer-content"
      className="px-3 pb-2"
    >
      <LayerExpandButton label={label} content={displayText} />
      <pre className="m-0 line-clamp-4 whitespace-pre-wrap break-words text-xs leading-6 font-mono text-muted-foreground" title={displayText}>
        {displayText}
      </pre>
    </div>
  );
}

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
      className="border-t border-[color:var(--color-prompt-layer-divider)] px-3 py-3"
    >
      <LayerExpandButton label={label} content={displayText} />
      <pre className="m-0 line-clamp-4 whitespace-pre-wrap break-words text-xs leading-6 font-mono text-muted-foreground">
        {displayText}
      </pre>
    </div>
  );
}

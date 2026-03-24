import { HIDDEN_RAW_MESSAGE } from "./promptLayerCardShared";

interface PromptLayerContentProps {
  rawContent: string | null;
  rawVisible: boolean;
}

export function PromptLayerContent({
  rawContent,
  rawVisible,
}: PromptLayerContentProps) {
  return (
    <div
      data-slot="prompt-layer-content"
      className="max-h-96 overflow-y-auto border-t border-[color:var(--color-prompt-layer-divider)] px-3 py-3"
    >
      {rawVisible ? (
        <pre className="m-0 whitespace-pre-wrap break-words text-xs leading-6 font-mono text-muted-foreground">
          {rawContent}
        </pre>
      ) : (
        <p className="m-0 text-xs leading-6 font-mono text-muted-foreground">
          {HIDDEN_RAW_MESSAGE}
        </p>
      )}
    </div>
  );
}

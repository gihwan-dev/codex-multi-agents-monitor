export function PromptLayerPreview({ preview }: { preview: string }) {
  return (
    <div
      data-slot="prompt-layer-preview"
      className="px-3 pb-3 text-xs leading-5 font-mono text-[var(--color-text-tertiary)]"
    >
      {preview}
    </div>
  );
}

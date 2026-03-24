export function PromptLayerPreview({ preview }: { preview: string }) {
  return (
    <p
      data-slot="prompt-layer-preview"
      className="m-0 line-clamp-1 px-3 pb-3 text-xs leading-5 font-mono text-[var(--color-text-tertiary)]"
    >
      {preview}
    </p>
  );
}

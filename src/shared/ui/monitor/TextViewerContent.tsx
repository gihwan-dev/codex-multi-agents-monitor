interface TextViewerContentProps {
  content: string | null;
  placeholder?: string;
}

export function TextViewerContent({
  content,
  placeholder = "No content available.",
}: TextViewerContentProps) {
  if (!content) {
    return (
      <p data-slot="text-viewer-placeholder" className="px-4 py-6 text-center text-sm text-muted-foreground">
        {placeholder}
      </p>
    );
  }

  return (
    <div className="max-h-[65vh] overflow-y-auto">
      <pre
        data-slot="text-viewer-pre"
        className="whitespace-pre-wrap break-words px-4 py-3 text-[0.82rem] leading-relaxed font-mono text-foreground"
      >
        {content}
      </pre>
    </div>
  );
}

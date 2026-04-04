import { ClipboardCopyIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../primitives";
import { TextViewerContent } from "./TextViewerContent";

export interface TextViewerSection {
  label: string;
  content: string | null;
  placeholder?: string;
}

interface TextViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  sections: TextViewerSection[];
}

export function TextViewerModal({
  open,
  onOpenChange,
  title,
  description,
  sections,
}: TextViewerModalProps) {
  const isSingleSection = sections.length === 1;
  const firstContent = sections[0]?.content ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="text-viewer-modal" className="gap-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 pb-3">
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle>{title}</DialogTitle>
            {isSingleSection ? <CopyButton content={firstContent} /> : null}
          </div>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {isSingleSection ? (
          <TextViewerContent content={firstContent} placeholder={sections[0]?.placeholder} />
        ) : (
          <MultiSectionBody sections={sections} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MultiSectionBody({ sections }: { sections: TextViewerSection[] }) {
  const [activeTab, setActiveTab] = useState(sections[0]?.label ?? "");
  const activeContent = sections.find((s) => s.label === activeTab)?.content ?? null;

  return (
    <>
      <div className="flex items-center justify-between gap-2 pb-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList variant="line">
            {sections.map((section) => (
              <TabsTrigger key={section.label} value={section.label}>
                {section.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <CopyButton content={activeContent} />
      </div>
      <Tabs value={activeTab}>
        {sections.map((section) => (
          <TabsContent key={section.label} value={section.label}>
            <TextViewerContent content={section.content} placeholder={section.placeholder} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

function CopyButton({ content }: { content: string | null }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = useCallback(() => {
    if (!content) return;
    navigator.clipboard
      .writeText(content)
      .then(() => {
        clearTimeout(timerRef.current);
        setCopied(true);
        timerRef.current = setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }, [content]);

  if (!content) return null;

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className="shrink-0 opacity-60 hover:opacity-100"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      <ClipboardCopyIcon className={copied ? "text-[var(--color-success)]" : undefined} />
    </Button>
  );
}

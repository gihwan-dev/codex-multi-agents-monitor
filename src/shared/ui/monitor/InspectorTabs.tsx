import { cn } from "../../lib";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "../primitives/tabs";

interface InspectorTabOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface InspectorTabsProps {
  value: string;
  options: InspectorTabOption[];
  onValueChange: (value: string) => void;
  className?: string;
}

export function InspectorTabs({
  value,
  options,
  onValueChange,
  className,
}: InspectorTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      className={cn("gap-0", className)}
    >
      <TabsList
        variant="line"
        className="w-full flex-wrap justify-start gap-2 rounded-none bg-transparent p-0"
      >
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="h-8 flex-none rounded-full border border-white/8 bg-white/[0.03] px-3 text-[0.78rem] capitalize text-muted-foreground data-[state=active]:border-[color:var(--color-active)]/45 data-[state=active]:bg-[color:color-mix(in_srgb,var(--color-active)_8%,transparent)] data-[state=active]:text-foreground data-[state=active]:after:hidden"
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

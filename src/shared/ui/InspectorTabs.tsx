import type { InspectorTab } from "../domain";

interface InspectorTabsProps {
  activeTab: InspectorTab;
  onChange: (tab: InspectorTab) => void;
  rawEnabled: boolean;
  showRawTab: boolean;
}

const tabs: InspectorTab[] = ["summary", "input", "output", "trace", "raw"];

export function InspectorTabs({
  activeTab,
  onChange,
  rawEnabled,
  showRawTab,
}: InspectorTabsProps) {
  return (
    <div className="tabs" role="tablist" aria-label="Inspector tabs">
      {tabs.filter((tab) => showRawTab || tab !== "raw").map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          className={`tabs__button ${activeTab === tab ? "tabs__button--active" : ""}`.trim()}
          aria-selected={activeTab === tab}
          disabled={tab === "raw" && !rawEnabled}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

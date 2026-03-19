import { useState } from "react";
import type { PromptAssembly, PromptLayerType } from "../../shared/domain/types";
import "./promptAssembly.css";

const DYNAMIC_LAYER_TYPES: ReadonlySet<PromptLayerType> = new Set([
  "user",
  "agents",
  "collaboration-mode",
  "skills-catalog",
  "automation",
  "delegated",
]);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb < 100 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`;
}

export function PromptAssemblyView({
  assembly,
}: {
  assembly: PromptAssembly;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggleLayer = (layerId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  };

  return (
    <div className="prompt-assembly">
      <div className="prompt-assembly__header">
        <span className="prompt-assembly__title">Prompt Context Assembly</span>
        <span className="prompt-assembly__size">
          {assembly.layers.length} layers &middot; {formatBytes(assembly.totalContentLength)}
        </span>
      </div>

      {assembly.layers.map((layer) => {
        const isExpanded = expandedIds.has(layer.layerId);
        const isDynamic = DYNAMIC_LAYER_TYPES.has(layer.layerType);
        const cssType = layer.layerType;

        return (
          <div
            key={layer.layerId}
            className={`layer-card layer-card--${cssType} ${isDynamic ? "layer-card--dynamic" : "layer-card--static"}`}
          >
            <div
              className="layer-card__header"
              onClick={() => toggleLayer(layer.layerId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleLayer(layer.layerId);
                }
              }}
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
            >
              <span
                className={`layer-card__chevron ${isExpanded ? "layer-card__chevron--expanded" : ""}`}
                aria-hidden="true"
              >
                &#9654;
              </span>
              <span className="layer-card__label">{layer.label}</span>
              <span className="layer-card__badge">{formatBytes(layer.contentLength)}</span>
            </div>

            <div className="layer-card__preview">{layer.preview}</div>

            {isExpanded ? (
              <div className="layer-card__content">
                <pre>{layer.rawContent}</pre>
              </div>
            ) : null}
          </div>
        );
      })}

      {assembly.layers.length === 0 ? (
        <p className="drawer__empty">No prompt assembly data available.</p>
      ) : null}
    </div>
  );
}

import type { WaterfallSegment } from "../../../shared/domain";
import { Panel } from "../../../shared/ui";

interface WaterfallViewProps {
  segments: WaterfallSegment[];
}

export function WaterfallView({ segments }: WaterfallViewProps) {
  return (
    <Panel title="Waterfall" className="canvas-panel">
      <div className="waterfall">
        {segments.map((segment) => (
          <div key={segment.eventId} className="waterfall__row">
            <span className="waterfall__title">{segment.title}</span>
            <div className="waterfall__track">
              <div
                className={`waterfall__bar waterfall__bar--${segment.status}`}
                style={{ left: `${segment.leftPercent}%`, width: `${segment.widthPercent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

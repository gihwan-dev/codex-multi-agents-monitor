import { TIME_GUTTER } from "../model/graphLayout";

interface GraphContinuationGuidesProps {
  availableCanvasHeight: number;
  contentWidth: number;
  continuationGuideYs: number[];
  scrollTop: number;
}

function isVisibleContinuationGuide(
  guideY: number,
  scrollTop: number,
  availableCanvasHeight: number,
) {
  return guideY >= scrollTop - 500 && guideY <= scrollTop + availableCanvasHeight + 500;
}

export function GraphContinuationGuides({
  availableCanvasHeight,
  contentWidth,
  continuationGuideYs,
  scrollTop,
}: GraphContinuationGuidesProps) {
  return continuationGuideYs
    .filter((guideY) => isVisibleContinuationGuide(guideY, scrollTop, availableCanvasHeight))
    .map((guideY) => (
      <line
        key={`continuation-guide-${guideY}`}
        data-slot="graph-row-guide"
        data-guide-kind="continuation"
        x1={TIME_GUTTER}
        y1={guideY}
        x2={contentWidth}
        y2={guideY}
        stroke="var(--color-graph-guide-continuation)"
        strokeWidth={1}
        strokeDasharray="2 7"
      />
    ));
}

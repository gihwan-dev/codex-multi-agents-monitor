import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useState,
} from "react";

interface UseGraphViewportMeasurementsOptions {
  laneHeaderHeightOverride?: number;
  laneStripRef: RefObject<HTMLDivElement | null>;
  viewportHeightOverride?: number;
  viewportRef: RefObject<HTMLDivElement | null>;
}

export function useGraphViewportMeasurements({
  laneHeaderHeightOverride,
  laneStripRef,
  viewportHeightOverride,
  viewportRef,
}: UseGraphViewportMeasurementsOptions) {
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(viewportHeightOverride ?? 0);
  const [laneHeaderHeight, setLaneHeaderHeight] = useState(laneHeaderHeightOverride ?? 0);

  useEffect(
    () =>
      observeViewportMeasurements({
        laneHeaderHeightOverride,
        laneStripRef,
        setLaneHeaderHeight,
        setViewportHeight,
        setViewportWidth,
        viewportHeightOverride,
        viewportRef,
      }),
    [laneHeaderHeightOverride, laneStripRef, viewportHeightOverride, viewportRef],
  );

  return { laneHeaderHeight, viewportHeight, viewportWidth };
}

interface ObserveViewportMeasurementsOptions {
  laneHeaderHeightOverride?: number;
  laneStripRef: RefObject<HTMLDivElement | null>;
  setLaneHeaderHeight: Dispatch<SetStateAction<number>>;
  setViewportHeight: Dispatch<SetStateAction<number>>;
  setViewportWidth: Dispatch<SetStateAction<number>>;
  viewportHeightOverride?: number;
  viewportRef: RefObject<HTMLDivElement | null>;
}

function observeViewportMeasurements(options: ObserveViewportMeasurementsOptions) {
  const viewportElement = options.viewportRef.current;
  if (!viewportElement) {
    return;
  }

  const updateMeasurements = createViewportMeasurementUpdater(options, viewportElement);
  updateMeasurements();

  return createViewportObserver(viewportElement, options.laneStripRef, updateMeasurements);
}

function createViewportMeasurementUpdater(
  options: ObserveViewportMeasurementsOptions,
  viewportElement: HTMLDivElement,
) {
  return () =>
    applyViewportMeasurements({
      laneHeaderHeightOverride: options.laneHeaderHeightOverride,
      laneStripRef: options.laneStripRef,
      setLaneHeaderHeight: options.setLaneHeaderHeight,
      setViewportHeight: options.setViewportHeight,
      setViewportWidth: options.setViewportWidth,
      viewportElement,
      viewportHeightOverride: options.viewportHeightOverride,
    });
}

function createViewportObserver(
  viewportElement: HTMLDivElement,
  laneStripRef: RefObject<HTMLDivElement | null>,
  updateMeasurements: () => void,
) {
  if (typeof ResizeObserver === "undefined") {
    return;
  }

  const observer = new ResizeObserver(updateMeasurements);
  observer.observe(viewportElement);
  observeMeasuredElement(observer, laneStripRef.current);

  return () => {
    observer.disconnect();
  };
}

function observeMeasuredElement(
  observer: ResizeObserver,
  element: HTMLDivElement | null,
) {
  if (element) {
    observer.observe(element);
  }
}

interface ApplyViewportMeasurementsOptions {
  laneHeaderHeightOverride?: number;
  laneStripRef: RefObject<HTMLDivElement | null>;
  setLaneHeaderHeight: Dispatch<SetStateAction<number>>;
  setViewportHeight: Dispatch<SetStateAction<number>>;
  setViewportWidth: Dispatch<SetStateAction<number>>;
  viewportElement: HTMLDivElement;
  viewportHeightOverride?: number;
}

function applyViewportMeasurements({
  laneHeaderHeightOverride,
  laneStripRef,
  setLaneHeaderHeight,
  setViewportHeight,
  setViewportWidth,
  viewportElement,
  viewportHeightOverride,
}: ApplyViewportMeasurementsOptions) {
  const nextViewportWidth = Math.round(viewportElement.clientWidth);
  const nextViewportHeight = Math.round(viewportElement.clientHeight);
  const nextLaneHeaderHeight = laneStripRef.current?.offsetHeight ?? 0;

  setViewportWidth((current) => (current === nextViewportWidth ? current : nextViewportWidth));
  if (viewportHeightOverride === undefined) {
    setViewportHeight((current) =>
      current === nextViewportHeight ? current : nextViewportHeight,
    );
  }
  if (laneHeaderHeightOverride === undefined) {
    setLaneHeaderHeight((current) =>
      current === nextLaneHeaderHeight ? current : nextLaneHeaderHeight,
    );
  }
}

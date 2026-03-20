import type {
  EventLayout,
  Point,
  PortSide,
  Rect,
  RoutePort,
} from "./graphLayoutTypes";

export function getSortAxis(rect: Rect, side: PortSide): number {
  return side === "top" || side === "bottom" ? rectCenterX(rect) : rectCenterY(rect);
}

export function movePoint(
  point: Point,
  side: PortSide,
  distance: number,
): Point {
  switch (side) {
    case "top":
      return { x: point.x, y: point.y - distance };
    case "right":
      return { x: point.x + distance, y: point.y };
    case "bottom":
      return { x: point.x, y: point.y + distance };
    case "left":
      return { x: point.x - distance, y: point.y };
  }
}

export function simplifyOrthogonalPoints(points: Point[]): Point[] {
  const result: Point[] = [];

  points.forEach((point) => {
    const previous = result[result.length - 1];
    if (previous && previous.x === point.x && previous.y === point.y) {
      return;
    }

    result.push(point);
    if (result.length < 3) {
      return;
    }

    const a = result[result.length - 3];
    const b = result[result.length - 2];
    const c = result[result.length - 1];

    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) {
      result.splice(result.length - 2, 1);
    }
  });

  return result;
}

export function toSvgPath(points: Point[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

export function rectCenterX(rect: Rect) {
  return rect.x + rect.width / 2;
}

export function rectCenterY(rect: Rect) {
  return rect.y + rect.height / 2;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function buildRoutePort(
  layout: EventLayout,
  side: PortSide,
  offset: number,
  edgePadding: number,
): RoutePort {
  const centerX = rectCenterX(layout.cardRect);
  const centerY = rectCenterY(layout.cardRect);

  if (side === "top" || side === "bottom") {
    return {
      eventId: layout.eventId,
      side,
      x: clamp(
        centerX + offset,
        layout.cardRect.x + edgePadding,
        layout.cardRect.x + layout.cardRect.width - edgePadding,
      ),
      y: side === "top" ? layout.cardRect.y : layout.cardRect.y + layout.cardRect.height,
      offset,
    };
  }

  return {
    eventId: layout.eventId,
    side,
    x: side === "left" ? layout.cardRect.x : layout.cardRect.x + layout.cardRect.width,
    y: clamp(
      centerY + offset,
      layout.cardRect.y + edgePadding,
      layout.cardRect.y + layout.cardRect.height - edgePadding,
    ),
    offset,
  };
}

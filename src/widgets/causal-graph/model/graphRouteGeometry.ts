import type {
  EventLayout,
  Point,
  PortSide,
  Rect,
  RoutePort,
} from "./graphLayoutTypes";

interface MovePointOptions {
  point: Point;
  side: PortSide;
  distance: number;
}

interface VerticalRoutePortOptions {
  layout: EventLayout;
  side: "top" | "bottom";
  offset: number;
  edgePadding: number;
}

interface HorizontalRoutePortOptions {
  layout: EventLayout;
  side: "left" | "right";
  offset: number;
  edgePadding: number;
}

interface BuildRoutePortOptions {
  layout: EventLayout;
  side: PortSide;
  offset: number;
  edgePadding: number;
}

export function getSortAxis(rect: Rect, side: PortSide): number {
  return side === "top" || side === "bottom" ? rectCenterX(rect) : rectCenterY(rect);
}

export function movePoint(options: MovePointOptions): Point {
  const { point, side, distance } = options;
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

function isDuplicatePoint(previous: Point | undefined, point: Point) {
  return previous ? previous.x === point.x && previous.y === point.y : false;
}

function shouldCollapseMiddlePoint(points: Point[]) {
  if (points.length < 3) {
    return false;
  }

  const [a, b, c] = points.slice(-3);
  return (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
}

export function simplifyOrthogonalPoints(points: Point[]): Point[] {
  const result: Point[] = [];

  for (const point of points) {
    if (isDuplicatePoint(result[result.length - 1], point)) {
      continue;
    }

    result.push(point);
    if (shouldCollapseMiddlePoint(result)) {
      result.splice(result.length - 2, 1);
    }
  }

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

function buildVerticalRoutePort(args: VerticalRoutePortOptions): RoutePort {
  return {
    eventId: args.layout.eventId,
    side: args.side,
    x: clamp(
      rectCenterX(args.layout.cardRect) + args.offset,
      args.layout.cardRect.x + args.edgePadding,
      args.layout.cardRect.x + args.layout.cardRect.width - args.edgePadding,
    ),
    y:
      args.side === "top"
        ? args.layout.cardRect.y
        : args.layout.cardRect.y + args.layout.cardRect.height,
    offset: args.offset,
  };
}

function buildHorizontalRoutePort(args: HorizontalRoutePortOptions): RoutePort {
  return {
    eventId: args.layout.eventId,
    side: args.side,
    x:
      args.side === "left"
        ? args.layout.cardRect.x
        : args.layout.cardRect.x + args.layout.cardRect.width,
    y: clamp(
      rectCenterY(args.layout.cardRect) + args.offset,
      args.layout.cardRect.y + args.edgePadding,
      args.layout.cardRect.y + args.layout.cardRect.height - args.edgePadding,
    ),
    offset: args.offset,
  };
}

export function buildRoutePort(options: BuildRoutePortOptions): RoutePort {
  const { layout, side, offset, edgePadding } = options;
  return side === "top" || side === "bottom"
    ? buildVerticalRoutePort({ layout, side, offset, edgePadding })
    : buildHorizontalRoutePort({ layout, side, offset, edgePadding });
}

import type { GraphSceneModel } from "../../../entities/run";

export function buildLaneIds(scene: GraphSceneModel) {
  return scene.lanes.map((lane) => lane.laneId);
}

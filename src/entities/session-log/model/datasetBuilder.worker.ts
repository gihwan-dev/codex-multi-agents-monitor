/// <reference lib="webworker" />

import type { RunDataset } from "../../run";
import { buildDatasetFromSessionLog } from "./datasetBuilder";
import type { SessionLogSnapshot } from "./types";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<SessionLogSnapshot>) => {
  const dataset: RunDataset | null = buildDatasetFromSessionLog(event.data);
  self.postMessage(dataset);
};

import type { RunDataset } from "../../run";
import { buildDatasetFromSessionLog } from "./datasetBuilder";
import type { SessionLogSnapshot } from "./types";

export async function buildDatasetFromSessionLogAsync(
  snapshot: SessionLogSnapshot,
): Promise<RunDataset | null> {
  if (typeof Worker === "undefined") {
    return buildDatasetFromSessionLog(snapshot);
  }

  return new Promise<RunDataset | null>((resolve, reject) => {
    const worker = new Worker(
      new URL("./datasetBuilder.worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (event: MessageEvent<RunDataset | null>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(event.error ?? new Error("Dataset hydration worker failed."));
    };
    worker.onmessageerror = () => {
      worker.terminate();
      reject(new Error("Dataset hydration worker: message deserialization failed."));
    };

    worker.postMessage(snapshot);
  });
}

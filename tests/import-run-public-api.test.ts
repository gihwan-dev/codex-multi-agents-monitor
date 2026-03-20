import { describe, expect, it } from "vitest";
import * as importRun from "../src/features/import-run/index.js";

describe("import-run public api", () => {
  it("slice root는 import/export 진입점만 노출한다", () => {
    expect(Object.keys(importRun).sort()).toEqual([
      "buildExportPayload",
      "normalizeImportPayload",
      "parseCompletedRunPayload",
    ]);
  });
});

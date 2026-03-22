import { describe, expect, it } from "vitest";
import type { RawImportPayload } from "../src/entities/run/index.js";
import { FIXTURE_IMPORT_TEXT } from "../src/entities/run/index.js";
import { parseCompletedRunPayload } from "../src/features/import-run/index.js";

function buildFixture(): RawImportPayload {
  return JSON.parse(FIXTURE_IMPORT_TEXT) as RawImportPayload;
}

describe("완료된 run payload 검증", () => {
  it("run 종료 시각이 시작 시각보다 빠르면 거부한다", () => {
    const fixture = buildFixture();

    expect(() =>
      parseCompletedRunPayload(
        JSON.stringify({
          ...fixture,
          run: {
            ...fixture.run,
            startTs: 100,
            endTs: 50,
          },
        }),
      ),
    ).toThrow(/run end timestamp/i);
  });

  it("중복된 event id를 가진 payload를 거부한다", () => {
    const fixture = buildFixture();

    expect(() =>
      parseCompletedRunPayload(
        JSON.stringify({
          ...fixture,
          events: [fixture.events[0], { ...fixture.events[0] }],
          edges: [],
          artifacts: [],
        }),
      ),
    ).toThrow(/duplicate event id/i);
  });

  it("중복된 edge id를 가진 payload를 거부한다", () => {
    const fixture = buildFixture();
    const firstEdge = fixture.edges[0];

    if (!firstEdge) {
      throw new Error("fixture must include at least one edge");
    }

    expect(() =>
      parseCompletedRunPayload(
        JSON.stringify({
          ...fixture,
          edges: [firstEdge, { ...firstEdge }],
        }),
      ),
    ).toThrow(/duplicate edge id/i);
  });

  it("존재하지 않는 finalArtifactId를 거부한다", () => {
    const fixture = buildFixture();

    expect(() =>
      parseCompletedRunPayload(
        JSON.stringify({
          ...fixture,
          run: {
            ...fixture.run,
            finalArtifactId: "missing-artifact",
          },
        }),
      ),
    ).toThrow(/finalArtifactId/i);
  });
});

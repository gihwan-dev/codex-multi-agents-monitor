import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadArchivedSessionIndex } from "../src/app/sessionLogLoader.js";
import { invokeTauri } from "../src/app/tauri.js";

vi.mock("../src/app/tauri.js", () => ({
  invokeTauri: vi.fn(),
}));

const mockedInvokeTauri = vi.mocked(invokeTauri);

beforeEach(() => {
  mockedInvokeTauri.mockReset();
});

describe("loadArchivedSessionIndex", () => {
  it("공백-only 검색어를 null로 정규화한다", async () => {
    const archiveResult = {
      items: [],
      total: 0,
      hasMore: false,
    };
    mockedInvokeTauri.mockResolvedValue(archiveResult);

    const result = await loadArchivedSessionIndex(20, 50, "   ");

    expect(mockedInvokeTauri).toHaveBeenCalledWith("load_archived_session_index", {
      offset: 20,
      limit: 50,
      search: null,
    });
    expect(result).toEqual(archiveResult);
  });

  it("검색어 앞뒤 공백을 제거한 뒤 브리지로 전달한다", async () => {
    const archiveResult = {
      items: [],
      total: 0,
      hasMore: false,
    };
    mockedInvokeTauri.mockResolvedValue(archiveResult);

    const result = await loadArchivedSessionIndex(20, 50, "  codex  ");

    expect(mockedInvokeTauri).toHaveBeenCalledWith("load_archived_session_index", {
      offset: 20,
      limit: 50,
      search: "codex",
    });
    expect(result).toEqual(archiveResult);
  });
});

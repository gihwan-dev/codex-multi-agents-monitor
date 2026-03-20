import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  buildExportPayload,
  normalizeImportPayload,
  parseCompletedRunPayload,
} from "../src/features/import-run/index.js";
import {
  createMonitorImportExportActions,
  createMonitorInitialState,
} from "../src/pages/monitor/index.js";

vi.mock("../src/features/import-run/index.js", () => ({
  buildExportPayload: vi.fn(),
  normalizeImportPayload: vi.fn(),
  parseCompletedRunPayload: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function expectDefined<T>(value: T | null | undefined, message: string): T {
  expect(value).toBeDefined();
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

function createHarness() {
  const state = createMonitorInitialState();
  const activeDataset = expectDefined(state.datasets[0], "dataset missing");
  const dispatch = vi.fn();
  const actions = createMonitorImportExportActions({
    importText: state.importText,
    allowRawImport: state.allowRawImport,
    noRawStorage: state.noRawStorage,
    dispatch,
    activeDataset,
  });

  return {
    state,
    activeDataset,
    dispatch,
    actions,
  };
}

describe("createMonitorImportExportActions", () => {
  it("import 성공 시 parsed payload를 정규화해서 dataset import action을 보낸다", () => {
    const { state, dispatch, actions } = createHarness();
    const parsed = { kind: "payload" };
    const dataset = expectDefined(state.datasets[1], "import dataset missing");
    vi.mocked(parseCompletedRunPayload).mockReturnValueOnce(parsed as never);
    vi.mocked(normalizeImportPayload).mockReturnValueOnce(dataset);

    actions.importPayload();

    expect(parseCompletedRunPayload).toHaveBeenCalledWith(state.importText);
    expect(normalizeImportPayload).toHaveBeenCalledWith(parsed, {
      allowRaw: state.allowRawImport,
      noRawStorage: state.noRawStorage,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "import-dataset",
      dataset,
    });
  });

  it("import 실패 시 에러를 export text drawer에 노출한다", () => {
    const { dispatch, actions } = createHarness();
    vi.mocked(parseCompletedRunPayload).mockImplementationOnce(() => {
      throw new Error("broken payload");
    });

    actions.importPayload();

    expect(normalizeImportPayload).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({
      type: "set-export-text",
      value: "broken payload",
      open: true,
    });
  });

  it("export는 raw 포함 가능 여부를 dataset contract에 맞춰 전달한다", () => {
    const { activeDataset, dispatch, actions } = createHarness();
    vi.mocked(buildExportPayload).mockReturnValueOnce("{\"ok\":true}");

    actions.exportDataset(true);

    expect(buildExportPayload).toHaveBeenCalledWith(
      activeDataset,
      activeDataset.run.rawIncluded,
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "set-export-text",
      value: "{\"ok\":true}",
      open: true,
    });
  });
});

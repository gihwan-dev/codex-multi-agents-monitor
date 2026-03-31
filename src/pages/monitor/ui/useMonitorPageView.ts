import {
  type MutableRefObject,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  type DrawerTab,
  focusContextObservability,
} from "../../../entities/run";
import { useWorkspaceIdentityOverrides } from "../../../features/workspace-identity";
import { useCompactViewport } from "../lib/useCompactViewport";
import { useSearchFocusShortcut } from "../lib/useSearchFocusShortcut";
import { useMonitorPageState } from "../model/useMonitorPageState";
import { usePreservedChromeState } from "./usePreservedChromeState";
import {
  resolveInitialViewportFocusEventId,
  useViewportFocusState,
} from "./useViewportFocusState";

function resolveFocusTarget(target?: HTMLElement | null) {
  if (target) {
    return target;
  }

  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}
function useDrawerAndShortcutControls(
  actions: ReturnType<typeof useMonitorPageState>["actions"],
  shortcutHelpOpen: boolean,
) {
  const drawerTriggerRef = useRef<HTMLElement | null>(null);
  const shortcutTriggerRef = useRef<HTMLElement | null>(null);
  const previousShortcutOpenRef = useRef(shortcutHelpOpen);

  useEffect(() => {
    restoreShortcutFocus(
      previousShortcutOpenRef.current,
      shortcutHelpOpen,
      shortcutTriggerRef.current,
    );
    previousShortcutOpenRef.current = shortcutHelpOpen;
  }, [shortcutHelpOpen]);

  const openDrawer = createOpenDrawer(actions, drawerTriggerRef);
  const closeDrawer = createCloseDrawer(actions, drawerTriggerRef);
  const toggleShortcuts = createToggleShortcuts(
    actions,
    shortcutHelpOpen,
    shortcutTriggerRef,
  );

  return {
    drawerTriggerRef,
    shortcutTriggerRef,
    openDrawer,
    closeDrawer,
    toggleShortcuts,
  };
}
function restoreShortcutFocus(
  wasShortcutHelpOpen: boolean,
  shortcutHelpOpen: boolean,
  shortcutTarget: HTMLElement | null,
) {
  if (wasShortcutHelpOpen && !shortcutHelpOpen) {
    shortcutTarget?.focus();
  }
}

function createOpenDrawer(
  actions: ReturnType<typeof useMonitorPageState>["actions"],
  drawerTriggerRef: MutableRefObject<HTMLElement | null>,
) {
  return function openDrawer(tab: DrawerTab, target?: HTMLElement | null) {
    drawerTriggerRef.current = resolveFocusTarget(target);
    actions.setDrawerTab(tab, true);
  };
}

function createCloseDrawer(
  actions: ReturnType<typeof useMonitorPageState>["actions"],
  drawerTriggerRef: MutableRefObject<HTMLElement | null>,
) {
  return function closeDrawer() {
    actions.setDrawerOpen(false);
    window.requestAnimationFrame(() => {
      drawerTriggerRef.current?.focus();
    });
  };
}

function createToggleShortcuts(
  actions: ReturnType<typeof useMonitorPageState>["actions"],
  shortcutHelpOpen: boolean,
  shortcutTriggerRef: MutableRefObject<HTMLElement | null>,
) {
  return function toggleShortcuts(target?: HTMLElement | null) {
    if (!shortcutHelpOpen) {
      shortcutTriggerRef.current = resolveFocusTarget(target);
    }

    actions.toggleShortcuts();
  };
}

function useFocusedContextObservability(
  contextObservability: ReturnType<typeof useMonitorPageState>["contextObservability"],
  hasSelection: boolean,
  viewportFocusEventId: string | null,
) {
  return useMemo(() => {
    if (!contextObservability) {
      return null;
    }

    if (hasSelection) {
      return focusContextObservability({
        observability: contextObservability,
        activeEventId: contextObservability.activeEventId,
        activeSource: "selection",
      });
    }

    if (viewportFocusEventId) {
      return focusContextObservability({
        observability: contextObservability,
        activeEventId: viewportFocusEventId,
        activeSource: "viewport",
      });
    }

    return focusContextObservability({
      observability: contextObservability,
      activeEventId: contextObservability.activeEventId,
      activeSource: "latest",
    });
  }, [contextObservability, hasSelection, viewportFocusEventId]);
}

function useMonitorChromeView(
  pageState: ReturnType<typeof useMonitorPageState>,
  viewportFocusEventId: string | null,
) {
  const { activeDataset, activeFollowLive, activeLiveConnection, anomalyJumps } = pageState;
  const contextObservability = useFocusedContextObservability(
    pageState.contextObservability,
    Boolean(pageState.state.selection),
    viewportFocusEventId,
  );

  return usePreservedChromeState({
    activeDataset,
    activeFollowLive,
    activeLiveConnection,
    anomalyJumps,
    contextObservability,
    inspectorTitle: pageState.inspectorSummary?.title ?? null,
    rawTabAvailable: pageState.rawTabAvailable,
    selectionLoadStateActive: Boolean(pageState.selectionLoadState),
    summaryFacts: pageState.summaryFacts,
  });
}

function useMonitorPageChromeBindings(
  pageState: ReturnType<typeof useMonitorPageState>,
  viewportFocusEventId: string | null,
) {
  return {
    chromeView: useMonitorChromeView(pageState, viewportFocusEventId),
    controls: useDrawerAndShortcutControls(
      pageState.actions,
      pageState.state.shortcutHelpOpen,
    ),
  };
}

export function useMonitorPageView() {
  const pageState = useMonitorPageState();
  const searchRef = useRef<HTMLInputElement>(null);
  const { viewportFocusEventId, setViewportFocusEventId } = useViewportFocusState(
    pageState.activeDataset?.run.traceId ?? null,
    resolveInitialViewportFocusEventId(pageState.graphScene.rows),
  );
  const { chromeView, controls } = useMonitorPageChromeBindings(
    pageState,
    viewportFocusEventId,
  );
  const isCompactViewport = useCompactViewport();
  const workspaceIdentityOverrides = useWorkspaceIdentityOverrides(pageState.state.datasets);

  useSearchFocusShortcut(searchRef);

  return {
    ...pageState,
    ...chromeView,
    ...controls,
    isCompactViewport,
    workspaceIdentityOverrides,
    searchRef,
    setViewportFocusEventId,
    drawerState: {
      drawerOpen: pageState.state.drawerOpen,
      drawerTab: pageState.state.drawerTab,
      allowRawImport: pageState.state.allowRawImport,
      noRawStorage: pageState.state.noRawStorage,
      importText: pageState.state.importText,
      exportText: pageState.state.exportText,
    },
  };
}

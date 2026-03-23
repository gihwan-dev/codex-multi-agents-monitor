import { useEffect, useRef } from "react";
import type { DrawerTab } from "../../../entities/run";
import { useWorkspaceIdentityOverrides } from "../../../features/workspace-identity";
import { useCompactViewport } from "../lib/useCompactViewport";
import { useSearchFocusShortcut } from "../lib/useSearchFocusShortcut";
import { useMonitorPageState } from "../model/useMonitorPageState";
import { usePreservedChromeState } from "./usePreservedChromeState";

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
    if (previousShortcutOpenRef.current && !shortcutHelpOpen) {
      shortcutTriggerRef.current?.focus();
    }

    previousShortcutOpenRef.current = shortcutHelpOpen;
  }, [shortcutHelpOpen]);

  const openDrawer = (tab: DrawerTab, target?: HTMLElement | null) => {
    drawerTriggerRef.current = resolveFocusTarget(target);
    actions.setDrawerTab(tab, true);
  };

  const closeDrawer = () => {
    actions.setDrawerOpen(false);
    window.requestAnimationFrame(() => {
      drawerTriggerRef.current?.focus();
    });
  };

  const toggleShortcuts = (target?: HTMLElement | null) => {
    if (!shortcutHelpOpen) {
      shortcutTriggerRef.current = resolveFocusTarget(target);
    }

    actions.toggleShortcuts();
  };

  return {
    drawerTriggerRef,
    shortcutTriggerRef,
    openDrawer,
    closeDrawer,
    toggleShortcuts,
  };
}

function useMonitorChromeView(pageState: ReturnType<typeof useMonitorPageState>) {
  const { activeDataset, activeFollowLive, activeLiveConnection, anomalyJumps } = pageState;

  return usePreservedChromeState({
    activeDataset,
    activeFollowLive,
    activeLiveConnection,
    anomalyJumps,
    inspectorTitle: pageState.inspectorSummary?.title ?? null,
    rawTabAvailable: pageState.rawTabAvailable,
    selectionLoadStateActive: Boolean(pageState.selectionLoadState),
    summaryFacts: pageState.summaryFacts,
  });
}

export function useMonitorPageView() {
  const pageState = useMonitorPageState();
  const searchRef = useRef<HTMLInputElement>(null);
  const chromeView = useMonitorChromeView(pageState);
  const controls = useDrawerAndShortcutControls(
    pageState.actions,
    pageState.state.shortcutHelpOpen,
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

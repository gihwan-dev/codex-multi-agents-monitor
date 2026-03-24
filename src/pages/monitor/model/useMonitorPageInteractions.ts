import { useEffect, useRef } from "react";
import type { DrawerTab } from "../../../entities/run";

interface UseMonitorPageInteractionsOptions {
  setDrawerOpen: (open: boolean) => void;
  setDrawerTab: (tab: DrawerTab, open: boolean) => void;
  shortcutHelpOpen: boolean;
  toggleShortcuts: () => void;
}

export function useMonitorPageInteractions({
  setDrawerOpen,
  setDrawerTab,
  shortcutHelpOpen,
  toggleShortcuts,
}: UseMonitorPageInteractionsOptions) {
  const searchRef = useRef<HTMLInputElement>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);
  const shortcutTriggerRef = useRef<HTMLElement | null>(null);
  const previousShortcutOpenRef = useRef(shortcutHelpOpen);

  const registerDrawerTrigger = (target?: HTMLElement | null) => {
    drawerTriggerRef.current =
      target ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  };

  const openDrawer = (tab: DrawerTab, target?: HTMLElement | null) => {
    registerDrawerTrigger(target);
    setDrawerTab(tab, true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => {
      drawerTriggerRef.current?.focus();
    });
  };

  const toggleShortcutDialog = (target?: HTMLElement | null) => {
    if (!shortcutHelpOpen) {
      shortcutTriggerRef.current =
        target ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    }

    toggleShortcuts();
  };

  useEffect(() => {
    if (previousShortcutOpenRef.current && !shortcutHelpOpen) {
      shortcutTriggerRef.current?.focus();
    }
    previousShortcutOpenRef.current = shortcutHelpOpen;
  }, [shortcutHelpOpen]);

  return {
    closeDrawer,
    openDrawer,
    registerDrawerTrigger,
    searchRef,
    shortcutTriggerRef,
    toggleShortcutDialog,
  };
}

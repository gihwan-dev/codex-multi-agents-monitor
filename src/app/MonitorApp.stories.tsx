import { useEffect } from "react";
import { MonitorApp } from "./MonitorApp";

const meta = {
  title: "App/MonitorApp",
  render: () => <MonitorApp />,
};

export default meta;

export const Default = {};

export const WaterfallMode = {
  render: () => <StoryScenario mode="w" />,
};

export const MapMode = {
  render: () => <StoryScenario mode="m" />,
};

export const DenseParallelRun = {
  render: () => <StoryScenario selectRunLabel="FIX-004 Dense parallel run" />,
};

export const ImportDrawerOpen = {
  render: () => <StoryScenario openButtonLabel="Import" />,
};

function StoryScenario({
  mode,
  openButtonLabel,
  selectRunLabel,
}: {
  mode?: "w" | "m";
  openButtonLabel?: string;
  selectRunLabel?: string;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (selectRunLabel) {
        clickButton(selectRunLabel);
      }
      if (mode) {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: mode, bubbles: true }));
      }
      if (openButtonLabel) {
        clickButton(openButtonLabel);
      }
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [mode, openButtonLabel, selectRunLabel]);

  return <MonitorApp />;
}

function clickButton(label: string) {
  const button = Array.from(document.querySelectorAll("button")).find((item) =>
    item.textContent?.includes(label),
  );
  button?.click();
}

import { useEffect } from "react";
import { MonitorApp } from "./MonitorApp";

const meta = {
  title: "App/MonitorApp",
  render: () => <MonitorApp />,
};

export default meta;

export const Default = {};

export const MinimalCompletedRun = {
  render: () => <StoryScenario selectRunLabel="FIX-001 Minimal completed run" />,
};

export const WaitingChainRun = {
  render: () => <StoryScenario selectRunLabel="FIX-002 Waiting chain run" />,
};

export const DenseParallelRun = {
  render: () => <StoryScenario selectRunLabel="FIX-004 Dense parallel run" />,
};

export const ImportDrawerOpen = {
  render: () => <StoryScenario openButtonLabel="Import" />,
};

function StoryScenario({
  openButtonLabel,
  selectRunLabel,
}: {
  openButtonLabel?: string;
  selectRunLabel?: string;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (selectRunLabel) {
        clickButton(selectRunLabel);
      }
      if (openButtonLabel) {
        clickButton(openButtonLabel);
      }
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [openButtonLabel, selectRunLabel]);

  return <MonitorApp />;
}

function clickButton(label: string) {
  const button = Array.from(document.querySelectorAll("button")).find((item) =>
    item.textContent?.includes(label),
  );
  button?.click();
}

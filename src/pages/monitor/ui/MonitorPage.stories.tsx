import { useEffect } from "react";
import { MonitorPage } from "./MonitorPage";

const meta = {
  title: "Screens/MonitorPage",
  render: () => <MonitorPage />,
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
    if (selectRunLabel) {
      clickButton(selectRunLabel);
    }
    if (openButtonLabel) {
      clickButton(openButtonLabel);
    }
  }, [openButtonLabel, selectRunLabel]);

  return <MonitorPage />;
}

function clickButton(label: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (item) => item.getAttribute("title") === label || item.textContent?.trim() === label,
  );
  button?.click();
}

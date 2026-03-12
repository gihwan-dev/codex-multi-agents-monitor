import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono";
import { AppQueryProvider } from "@/shared/query";
import { AppShell } from "./app-shell";
import "./styles.css";

async function resolveShell() {
  if (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "ui-qa"
  ) {
    const { AppShellDemo } = await import("./app-shell-demo");
    return AppShellDemo;
  }

  return AppShell;
}

void resolveShell().then((Shell) => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <AppQueryProvider>
        <Shell />
      </AppQueryProvider>
    </React.StrictMode>,
  );
});

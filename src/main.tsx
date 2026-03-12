import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono";
import { AppQueryProvider } from "@/shared/query";
import { AppShell } from "./app-shell";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppQueryProvider>
      <AppShell />
    </AppQueryProvider>
  </React.StrictMode>,
);

import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Fresh Start</p>
        <h1>Hello World</h1>
        <p className="subtitle">Minimal Tauri + React starter for rebuilding from scratch.</p>
      </section>
    </main>
  </React.StrictMode>,
);

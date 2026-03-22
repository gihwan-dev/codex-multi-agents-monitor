import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./app/styles/index.css";
import "./app/styles/layout.css";
import { initializeThemeDocument } from "./shared/theme";

initializeThemeDocument();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />,
);

import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./theme/tokens.css";
import "./theme/primitives.css";
import "./theme/motion.css";
import "./app/styles/layout.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />,
);

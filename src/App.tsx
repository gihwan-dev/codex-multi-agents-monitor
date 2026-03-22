import { MonitorPage } from "./pages/monitor";
import { ThemeProvider } from "./shared/theme";

export function App() {
  return (
    <ThemeProvider>
      <MonitorPage />
    </ThemeProvider>
  );
}

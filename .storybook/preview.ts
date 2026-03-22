import type { Preview } from "@storybook/react-vite";
import "../src/app/styles/index.css";
import "../src/app/styles/layout.css";
import { applyThemePreferenceToDocument, type ThemePreference } from "../src/shared/theme";

const preview: Preview = {
  layout: "fullscreen",
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Theme preview",
      defaultValue: "dark",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "system", title: "System" },
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = (context.globals.theme ?? "dark") as ThemePreference;
      applyThemePreferenceToDocument(theme);

      return Story();
    },
  ],
};

export default preview;

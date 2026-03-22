import type { Preview } from "@storybook/react-vite";
import { createElement } from "react";
import "../src/app/styles/index.css";
import "../src/app/styles/layout.css";
import { initializeThemeDocument, isThemePreference, ThemeProvider } from "../src/shared/theme";

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
      const theme = isThemePreference(context.globals.theme) ? context.globals.theme : "dark";
      initializeThemeDocument({ preference: theme });

      return createElement(
        ThemeProvider,
        { preferenceOverride: theme },
        createElement(Story),
      );
    },
  ],
};

export default preview;

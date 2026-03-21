import type { Preview } from "@storybook/react-vite";
import "../src/app/styles/index.css";
import "../src/app/styles/layout.css";

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
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme ?? "dark";
      document.documentElement.dataset.theme = theme;
      document.body.dataset.theme = theme;

      return Story();
    },
  ],
};

export default preview;

import type { Preview } from "@storybook/react";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    backgrounds: {
      default: "parser",
      values: [{ name: "parser", value: "rgb(17, 24, 39)" }],
    },
    controls: {
      expanded: true,
    },
  },
};

export default preview;

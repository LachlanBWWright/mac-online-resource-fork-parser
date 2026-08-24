import type { Meta, StoryObj } from "@storybook/react-vite";
import App from "../src/App";

const meta = {
  title: "User journeys/Parser application",
  component: App,
  parameters: {
    docs: {
      description: {
        component: "Full-page screenshots for the resource fork parser, including the entry point and loaded sample journeys.",
      },
    },
  },
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyWorkspace: Story = {
  name: "Empty workspace / upload entry point",
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "@storybook/test";
import ResourceForkParser from "../src/components/ResourceForkParser";

const meta = {
  title: "User journeys/Resource fork parser",
  component: ResourceForkParser,
  parameters: {
    docs: {
      description: {
        component: "Integration-style stories that exercise the same sample-loading paths a user takes in the application.",
      },
    },
  },
} satisfies Meta<typeof ResourceForkParser>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoadSampleWithSpecs: Story = {
  name: "Load sample and configure structs",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /With struct data/i }).first());
    await expect(canvas.findByText("EarthFarm.ter.rsrc")).resolves.toBeTruthy();
    await expect(canvas.findByText("Four-Letter Code Specifications")).resolves.toBeTruthy();
  },
};

export const LoadSampleAndBrowseData: Story = {
  name: "Load sample and browse parsed data",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Browse data/i }));
    await expect(canvas.findByTestId("data-browser")).resolves.toBeTruthy();
  },
};

export const DefineOwnSpecs: Story = {
  name: "Load sample and define own structs",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Without struct data/i }).first());
    await expect(canvas.findByText(/Struct Specification Not Defined/i)).resolves.toBeTruthy();
  },
};

export const FilterSampleCatalog: Story = {
  name: "Filter the sample catalog by category and search",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Icons" }));
    await expect(canvas.findByText("Rezilla — Plugin Icon Resource")).resolves.toBeTruthy();
    await userEvent.type(canvas.getByLabelText("Search samples"), "Glider");
    await expect(canvas.findByText("No samples match this search.")).resolves.toBeTruthy();
  },
};

export const GliderPictBrowser: Story = {
  name: "Load Glider artwork and render a PICT resource",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Search samples"), "B&W");
    await userEvent.click(canvas.getByRole("button", { name: /With inferred fields/i }));
    await expect(canvas.findByRole("tab", { name: "Browse Data" })).resolves.toBeTruthy();
    await userEvent.click(canvas.getByRole("tab", { name: "Browse Data" }));
    await userEvent.click(await canvas.findByTestId("resource-type-PICT"));
    await userEvent.click(canvas.getByTestId(/^resource-PICT-/));
    await expect(canvas.findByText("QuickDraw picture renderer")).resolves.toBeTruthy();
    await expect(canvas.findByLabelText(/Rendered QuickDraw picture PICT/)).resolves.toBeTruthy();
  },
};

export const GliderColorPictBrowser: Story = {
  name: "Load Glider color artwork and render a PICT resource",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Search samples"), "Color Art");
    await userEvent.click(canvas.getByRole("button", { name: /With inferred fields/i }));
    await expect(canvas.findByRole("tab", { name: "Browse Data" })).resolves.toBeTruthy();
    await userEvent.click(canvas.getByRole("tab", { name: "Browse Data" }));
    await userEvent.click(await canvas.findByTestId("resource-type-PICT"));
    await userEvent.click(canvas.getByTestId(/^resource-PICT-/));
    await expect(canvas.findByLabelText(/Rendered QuickDraw picture PICT/)).resolves.toBeTruthy();
  },
};

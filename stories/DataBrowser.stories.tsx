import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "@storybook/test";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../src/components/ui/card";
import { Database } from "lucide-react";
import DataBrowser from "../src/components/resource-fork-parser/DataBrowser";
import { browseData } from "./fixtures";

function DataBrowserScreen() {
  const [data, setData] = useState(browseData);

  return (
    <main className="min-h-screen bg-gray-900 p-8 text-gray-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><Database className="h-5 w-5" />EarthFarm.ter.rsrc</CardTitle>
            <CardDescription className="text-gray-400">Parsed resource fork · 3 resource types · editable working copy</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-gray-400">Browse, search, expand, and edit decoded resources before exporting them.</CardContent>
        </Card>
        <DataBrowser
          data={data}
          onDataChange={(fourCC, resourceId, newData) => {
            setData((current) => ({
              ...current,
              [fourCC]: {
                ...(current[fourCC] as Record<string, unknown>),
                [resourceId]: {
                  ...((current[fourCC] as Record<string, Record<string, unknown>>)[resourceId]),
                  obj: newData,
                },
              },
            }));
          }}
        />
      </div>
    </main>
  );
}

const meta = {
  title: "User journeys/Browse data",
  component: DataBrowserScreen,
} satisfies Meta<typeof DataBrowserScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SearchExpandAndEdit: Story = {
  name: "Search resources and edit a decoded field",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId("resource-type-Hedr"));
    await userEvent.click(canvas.getByTestId("resource-Hedr-128"));
    await expect(canvas.findByText(/Resource inspector/i)).resolves.toBeTruthy();
    const search = canvas.getByPlaceholderText(/Search fields, values, IDs/i);
    await userEvent.type(search, "palette");
    await expect(canvas.findByText(/Terrain palette/i)).resolves.toBeTruthy();
  },
};

export const FullResourceInventory: Story = {
  name: "Full inventory with collapsed resource types",
  parameters: { viewport: { defaultViewport: "responsive" } },
};

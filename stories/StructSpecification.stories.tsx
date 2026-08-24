import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "@storybook/test";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../src/components/ui/card";
import FourLetterCodeSpecification from "../src/components/resource-fork-parser/FourLetterCodeSpecification";
import type { FourLetterCodeSpec } from "../src/components/resource-fork-parser/types";
import { dataTypeOptions, definedSpec, undefinedSpec } from "./fixtures";

function SpecificationScreen({ initialSpec }: { initialSpec: FourLetterCodeSpec }) {
  const [spec, setSpec] = useState(initialSpec);

  return (
    <main className="min-h-screen bg-gray-900 p-8 text-gray-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Struct specifications</CardTitle>
            <CardDescription className="text-gray-400">Review the binary layout and refine how this resource type is decoded.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-gray-400">Changes are reflected in the canonical spec preview and sample data area.</CardContent>
        </Card>
        <Card className="border-gray-700 bg-gray-800">
          <CardContent className="pt-6">
            <FourLetterCodeSpecification
              spec={spec}
              specIndex={0}
              onFourCCChange={(_, fourCC) => setSpec((current) => ({ ...current, fourCC }))}
              updateFourLetterCodeSpec={(_, updates) => setSpec((current) => ({ ...current, ...updates }))}
              addDataTypeToSpec={() => setSpec((current) => ({ ...current, dataTypes: [...current.dataTypes, { id: String(current.dataTypes.length + 1), type: "i", count: 1, description: "new_field" }] }))}
              addArrayFieldToSpec={() => undefined}
              removeDataTypeFromSpec={(_, id) => setSpec((current) => ({ ...current, dataTypes: current.dataTypes.filter((field) => field.id !== id) }))}
              updateDataType={(_, id, updates) => setSpec((current) => ({ ...current, dataTypes: current.dataTypes.map((field) => field.id === id ? { ...field, ...updates } : field) }))}
              dataTypeOptions={dataTypeOptions}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

const meta = {
  title: "User journeys/Struct specifications",
  component: SpecificationScreen,
  argTypes: {
    initialSpec: { control: false },
  },
} satisfies Meta<typeof SpecificationScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefinedStruct: Story = { args: { initialSpec: definedSpec } };
export const DefinedStructEditing: Story = {
  name: "Edit a four-letter code and field name",
  args: { initialSpec: definedSpec },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Edit four-letter code Hedr/ }));
    await userEvent.fill(canvas.getByLabelText("Four-letter code for Hedr"), "Head");
    await userEvent.click(canvas.getByRole("button", { name: "Save four-letter code" }));
    const field = canvas.getByLabelText("Field name for version");
    await userEvent.fill(field, "formatVersion");
    await expect(canvas.findByDisplayValue("formatVersion")).resolves.toBeTruthy();
  },
};

export const UndefinedStruct: Story = {
  args: { initialSpec: undefinedSpec },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByText("Struct Specification Not Defined")).resolves.toBeTruthy();
    await expect(canvas.findByRole("button", { name: /Define Data Structure/i })).resolves.toBeTruthy();
  },
};

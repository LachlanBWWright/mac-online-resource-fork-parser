import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "@storybook/test";
import { isOk, load } from "@lachlanbwwright/rsrcdump-ts";
import ResourceDataEditor from "../src/components/resource-fork-parser/ResourceDataEditor";

function EditorScreen({ fourCC, initialHex, resourceId = "128" }: { fourCC: string; initialHex: string; resourceId?: string }) {
  const [hex, setHex] = useState(initialHex);
  return (
    <main className="min-h-screen bg-gray-950 p-8 text-gray-100">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="border-b border-gray-800 pb-4">
          <p className="text-xs uppercase tracking-[0.18em] text-blue-300">Resource inspector</p>
          <h1 className="mt-2 text-2xl font-semibold">{fourCC} / {resourceId}</h1>
          <p className="mt-1 text-sm text-gray-400">Specialized editing surface for raw resource bytes.</p>
        </header>
        <ResourceDataEditor fourCC={fourCC} resourceId={resourceId} hex={hex} onChange={setHex} />
      </div>
    </main>
  );
}

function PictResourceStory() {
  const [hex, setHex] = useState<string | null>(null);
  useEffect(() => {
    fetch("test-files/opensource/glider/Glider-BW-Art.rsrc")
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        const result = load(new Uint8Array(buffer));
        if (!isOk(result)) return;
        const pict = result.value.tree.get("PICT")?.values().next().value;
        if (pict) setHex(Array.from(pict.data, (byte) => byte.toString(16).padStart(2, "0")).join(""));
      });
  }, []);
  if (!hex) return <div className="min-h-screen bg-gray-950 p-8 text-sm text-gray-400">Loading Glider PICT resource…</div>;
  return <EditorScreen fourCC="PICT" initialHex={hex} resourceId="128" />;
}

const meta = {
  title: "User journeys/Resource data editors",
  component: EditorScreen,
  parameters: {
    docs: { description: { component: "Screenshot-ready editors for text, classic bitmap, and QuickDraw PICT resource data." } },
  },
} satisfies Meta<typeof EditorScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AsciiText: Story = {
  args: { fourCC: "TEXT", initialHex: "4F74746F204D61746963207265736F7572636520646174612E0A" },
};

export const MonochromeIcon: Story = {
  args: {
    fourCC: "ICN#",
    initialHex: Array.from({ length: 256 }, (_, index) => (index % 33 === 0 || index % 47 === 0 ? "ff" : "00")).join(""),
    resourceId: "128",
  },
};

export const GliderPict: Story = {
  name: "Real Glider B&W PICT renderer",
  render: () => <PictResourceStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByText("QuickDraw picture renderer")).resolves.toBeTruthy();
    await expect(canvas.findByLabelText(/Rendered QuickDraw picture PICT/)).resolves.toBeTruthy();
  },
};

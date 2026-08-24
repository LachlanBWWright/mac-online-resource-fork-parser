import { expect, test } from "@playwright/test";

const STORYBOOK_URL = "http://localhost:6006/mac-online-resource-fork-parser";

const stories = [
  { id: "user-journeys-parser-application--empty-workspace", name: "app-empty" },
  { id: "user-journeys-browse-data--search-expand-and-edit", name: "browser-search-edit", text: "Data Browser" },
  { id: "user-journeys-browse-data--full-resource-inventory", name: "browser-inventory" },
  { id: "user-journeys-resource-data-editors--ascii-text", name: "editor-text", text: "ASCII text editor" },
  { id: "user-journeys-resource-data-editors--monochrome-icon", name: "editor-icon", label: /Edit ICN# bitmap/ },
  { id: "user-journeys-resource-data-editors--glider-pict", name: "editor-pict", label: /Rendered QuickDraw picture PICT/ },
  { id: "user-journeys-resource-fork-parser--load-sample-with-specs", name: "parser-specs", text: "Four-Letter Code Specifications" },
  { id: "user-journeys-resource-fork-parser--load-sample-and-browse-data", name: "parser-browser", testId: "data-browser" },
  { id: "user-journeys-resource-fork-parser--define-own-specs", name: "parser-undefined", text: "Struct Specification Not Defined" },
  { id: "user-journeys-resource-fork-parser--filter-sample-catalog", name: "parser-filter", text: "No samples match this search." },
  { id: "user-journeys-resource-fork-parser--glider-pict-browser", name: "parser-pict", label: /Rendered QuickDraw picture PICT/ },
  { id: "user-journeys-resource-fork-parser--glider-color-pict-browser", name: "parser-color-pict", label: /Rendered QuickDraw picture PICT/ },
  { id: "user-journeys-struct-specifications--defined-struct", name: "spec-defined", text: "Data Type Fields" },
  { id: "user-journeys-struct-specifications--defined-struct-editing", name: "spec-editing", text: "Data Type Fields" },
  { id: "user-journeys-struct-specifications--undefined-struct", name: "spec-undefined", text: "Struct Specification Not Defined" },
] as const;

async function driveParserStory(page: import("@playwright/test").Page, storyId: string) {
  const click = async (locator: ReturnType<typeof page.getByRole>) => locator.click({ force: true });
  if (storyId.endsWith("load-sample-with-specs")) {
    await click(page.getByRole("button", { name: /With struct data/i }).first());
  } else if (storyId.endsWith("load-sample-and-browse-data")) {
    await expect(page.getByTestId("data-browser")).toBeVisible({ timeout: 30_000 });
  } else if (storyId.endsWith("define-own-specs")) {
    await click(page.getByRole("button", { name: /Without struct data/i }).first());
  } else if (storyId.endsWith("filter-sample-catalog")) {
    await click(page.getByRole("button", { name: "Icons" }));
    await page.getByLabel("Search samples").fill("Glider");
  } else if (storyId.endsWith("glider-pict-browser") || storyId.endsWith("glider-color-pict-browser")) {
    await expect(page.getByTestId("data-browser")).toBeVisible({ timeout: 30_000 });
    const dataBrowser = page.getByTestId("data-browser");
    const browseTab = page.getByRole("tab", { name: "Browse Data" });
    if (!(await dataBrowser.isVisible())) {
      await page.getByLabel("Search samples").fill(storyId.includes("color") ? "Color Art" : "B&W");
      const sampleId = storyId.includes("color") ? "sample-glider-color-art" : "sample-glider-bw-art";
      await click(page.getByTestId(sampleId).getByRole("button", { name: /With inferred fields/i }));
      await expect(browseTab).toBeVisible({ timeout: 30_000 });
      await click(browseTab);
    }
    const pictType = page.getByTestId("resource-type-PICT");
    if ((await pictType.getAttribute("aria-label"))?.startsWith("Expand")) await click(pictType);
    await click(page.locator('[data-testid^="resource-PICT-"]').first());
  } else if (storyId.endsWith("struct-specifications--defined-struct-editing")) {
    const specSection = page.getByTestId("flc-section-Hedr");
    await click(specSection.locator('button[aria-label^="Edit four-letter code"]').first());
    await specSection.locator('input[aria-label^="Four-letter code for"]').fill("Head");
    await click(page.getByRole("button", { name: "Save four-letter code" }));
    await specSection.getByLabel("Field name for version").fill("formatVersion");
  }
}

test.describe("Storybook integration screenshot matrix", () => {
  for (const story of stories) {
    test(`captures ${story.name}`, async ({ page }) => {
      await page.goto(`${STORYBOOK_URL}/iframe.html?id=${story.id}&viewMode=story`);
      await expect(page.locator("#storybook-root")).not.toBeEmpty({ timeout: 30_000 });
      if (story.id.includes("resource-fork-parser")) await driveParserStory(page, story.id);
      else if (story.id.endsWith("struct-specifications--undefined-struct")) await expect(page.getByRole("heading", { name: "Struct Specification Not Defined" })).toBeVisible({ timeout: 30_000 });
      else if (story.text) await expect(page.getByText(story.text, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
      if (story.testId) await expect(page.getByTestId(story.testId)).toBeVisible({ timeout: 30_000 });
      if (story.label) await expect(page.getByLabel(story.label).first()).toBeVisible({ timeout: 30_000 });
      if (story.id.endsWith("glider-color-pict-browser")) {
        const canvas = page.getByLabel(/Rendered QuickDraw picture PICT/).first();
        await expect.poll(() => canvas.evaluate((element) => {
          const pixel = (element as HTMLCanvasElement).getContext("2d")?.getImageData(256, 171, 1, 1).data;
          return pixel ? Array.from(pixel) : [];
        })).not.toEqual([255, 0, 255, 255]);
      }
      await page.screenshot({ path: `test-results/storybook-${story.name}.png`, fullPage: true });
    });
  }
});

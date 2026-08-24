import { expect, test } from "@playwright/test";
import path from "node:path";

const ottoMaticPath = path.resolve("public/test-files/EarthFarm.ter.rsrc");

test.describe("Otto Matic browse performance", () => {
  test.setTimeout(120_000);

  test("keeps parsing, browsing, expand-all, and search within usable budgets", async ({ page }, testInfo) => {
    const metrics: Record<string, number> = {};
    const startedAt = Date.now();

    await page.goto("/");
    await page.locator('input[type="file"][accept=".rsrc"]').setInputFiles(ottoMaticPath);
    await expect(page.getByText("EarthFarm.ter.rsrc")).toBeVisible({ timeout: 30_000 });
    metrics.parseAndLoadMs = Date.now() - startedAt;

    await expect(page.getByRole("tab", { name: "Browse Data" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("tab", { name: "Browse Data" }).click();
    const browser = page.getByTestId("data-browser");
    await expect(browser).toBeVisible({ timeout: 30_000 });
    metrics.browseReadyMs = Date.now() - startedAt - metrics.parseAndLoadMs;

    const expandChildren = browser.getByRole("button", { name: /children of Hedr/ });
    const expandStartedAt = Date.now();
    await expandChildren.click({ timeout: 30_000 });
    await expect(browser.getByText(/Resource #/).first()).toBeVisible();
    metrics.expandFirstResourceMs = Date.now() - expandStartedAt;

    await expect(expandChildren).toHaveAccessibleName(/Collapse children of/, { timeout: 30_000 });
    metrics.expandAllCompleteMs = Date.now() - expandStartedAt;

    const searchStartedAt = Date.now();
    await browser.getByPlaceholder("Search fields, values, IDs…").fill("1000");
    await expect(browser.getByText(/Resource #1000/).first()).toBeVisible({ timeout: 15_000 });
    metrics.workerSearchResponseMs = Date.now() - searchStartedAt;

    testInfo.annotations.push({ type: "performance", description: JSON.stringify(metrics) });
    console.log(`Otto Matic performance: ${JSON.stringify(metrics)}`);

    // These are intentionally broad CI budgets. The test is intended to catch
    // accidental regressions, not fail because of normal runner variance.
    expect(metrics.parseAndLoadMs).toBeLessThan(30_000);
    expect(metrics.browseReadyMs).toBeLessThan(5_000);
    expect(metrics.expandFirstResourceMs).toBeLessThan(5_000);
    expect(metrics.expandAllCompleteMs).toBeLessThan(45_000);
    expect(metrics.workerSearchResponseMs).toBeLessThan(15_000);
  });
});

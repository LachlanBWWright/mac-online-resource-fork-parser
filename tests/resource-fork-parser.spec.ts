import { test, expect } from '@playwright/test';

test.describe('Resource Fork Parser', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should load the application', async ({ page }) => {
    await expect(page).toHaveTitle(/Vite \+ React/);
    await expect(page.locator('h1')).toContainText('Mac Resource Fork Parser');
  });

  test('should show default custom spec', async ({ page }) => {
    await expect(page.locator('input[placeholder="e.g. Hedr"]')).toHaveValue('Hedr');
    await expect(page.locator('input[placeholder="e.g. L5i3f5i40x"]')).toHaveValue('L5i3f5i40x');
  });

  test('should load and parse EarthFarm sample file', async ({ page }) => {
    // Take a screenshot before loading
    await page.screenshot({ path: 'tests/screenshots/01-initial-load.png', fullPage: true });

    // Click the sample file button
    await page.click('button:has-text("Load Sample File (EarthFarm.ter.rsrc)")');

    // Wait for processing to complete
    await page.waitForSelector('.bg-green-50', { timeout: 30000 });

    // Take a screenshot after parsing
    await page.screenshot({ path: 'tests/screenshots/02-sample-parsed.png', fullPage: true });

    // Check that parsing was successful
    await expect(page.locator('.bg-green-50')).toContainText('Parsing Successful!');
    await expect(page.locator('.bg-green-50')).toContainText('EarthFarm.ter.rsrc');

    // Click download JSON button
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download JSON")');
    const download = await downloadPromise;

    // Take a screenshot showing download success
    await page.screenshot({ path: 'tests/screenshots/03-json-downloaded.png', fullPage: true });

    // Verify download
    expect(download.suggestedFilename()).toBe('EarthFarm.ter.rsrc.json');
  });

  test('should allow adding custom specs', async ({ page }) => {
    // Add a new custom spec
    await page.click('button:has-text("Add Spec")');

    // Take a screenshot with new spec form
    await page.screenshot({ path: 'tests/screenshots/04-add-custom-spec.png', fullPage: true });

    // Fill in the new spec
    const specInputs = page.locator('.border.border-gray-200').last();
    await specInputs.locator('input[placeholder="e.g. Hedr"]').fill('Test');
    await specInputs.locator('input[placeholder="e.g. L5i3f5i40x"]').fill('H2i');
    await specInputs.locator('input[placeholder="e.g. version,numItems,width,height"]').fill('field1,field2,field3');

    // Take a screenshot with filled spec
    await page.screenshot({ path: 'tests/screenshots/05-custom-spec-filled.png', fullPage: true });

    // Verify the spec was added
    await expect(specInputs.locator('input[placeholder="e.g. Hedr"]')).toHaveValue('Test');
  });

  test('should show Otto specs when enabled', async ({ page }) => {
    // Verify Otto specs are shown by default
    await expect(page.locator('h3:has-text("Otto Matic Default Specs")')).toBeVisible();
    await expect(page.locator('.font-mono')).toContainText('Hedr:L5i3f5i40x');

    // Take a screenshot showing Otto specs
    await page.screenshot({ path: 'tests/screenshots/06-otto-specs-visible.png', fullPage: true });

    // Disable Otto specs
    await page.uncheck('input[type="checkbox"]');

    // Verify Otto specs are hidden
    await expect(page.locator('h3:has-text("Otto Matic Default Specs")')).not.toBeVisible();

    // Take a screenshot with Otto specs disabled
    await page.screenshot({ path: 'tests/screenshots/07-otto-specs-disabled.png', fullPage: true });
  });

  test('should show format help', async ({ page }) => {
    // Verify format help is visible
    await expect(page.locator('h4:has-text("Format Characters:")')).toBeVisible();
    await expect(page.locator('code:has-text("L")')).toBeVisible();
    await expect(page.locator('text=Unsigned long (4 bytes)')).toBeVisible();

    // Take a screenshot showing format help
    await page.screenshot({ path: 'tests/screenshots/08-format-help.png', fullPage: true });
  });
});
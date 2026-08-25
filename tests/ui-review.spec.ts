import { expect, test } from '@playwright/test';

test.describe('visual review captures', () => {
  test('captures the landing catalog and data browser at desktop and mobile widths', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Sample files' })).toBeVisible();
    await page.screenshot({ path: 'test-results/ui-review-landing-desktop.png', fullPage: true });

    await page.getByRole('button', { name: 'Browse data', exact: true }).click();
    await expect(page.getByTestId('data-browser')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: 'test-results/ui-review-browser-desktop.png', fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Sample files' })).toBeVisible();
    await page.screenshot({ path: 'test-results/ui-review-landing-mobile.png', fullPage: true });

    await page.getByRole('button', { name: 'Browse data', exact: true }).click();
    await expect(page.getByTestId('data-browser')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: 'test-results/ui-review-browser-mobile.png', fullPage: true });
  });

  test('captures the specification master-detail editor', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'With struct data' }).first().click();
    await expect(page.getByRole('heading', { name: 'Four-Letter Code Specifications' })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: 'test-results/ui-review-specs-desktop.png', fullPage: true });
  });

  test('renders a real Glider QuickDraw PICT resource', async ({ page }) => {
    await page.goto('/');
    const sample = page.getByTestId('sample-glider-bw-art');
    await sample.getByRole('button', { name: 'With inferred fields' }).click();
    await expect(page.getByRole('tab', { name: 'Browse Data' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: 'Browse Data' }).click();
    await expect(page.getByTestId('data-browser')).toBeVisible();
    const pictType = page.getByTestId('resource-type-PICT');
    await expect(pictType).toBeVisible();
    await pictType.click();
    const firstPict = page.locator('[data-testid^="resource-PICT-"]').first();
    await firstPict.click();
    await expect(page.getByText('QuickDraw picture renderer').first()).toBeVisible();
    await page.locator('[data-testid^="resource-PICT-"]').nth(1).click();
    await expect(page.getByText('QuickDraw picture renderer')).toHaveCount(2);
    await page.getByRole('button', { name: '2×' }).first().click();
    await expect.poll(() => page.getByLabel(/Rendered QuickDraw picture PICT/).first().evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(512);
    const pngDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export PNG' }).first().click();
    expect((await pngDownload).suggestedFilename()).toMatch(/PICT-\d+\.png/);
    const canvas = page.getByLabel(/Rendered QuickDraw picture PICT/).first();
    await expect(canvas).toBeVisible();
    await expect.poll(() => canvas.evaluate((element) => ({ width: (element as HTMLCanvasElement).width, height: (element as HTMLCanvasElement).height }))).toEqual({ width: 512, height: 342 });
    await page.screenshot({ path: 'test-results/ui-review-pict-renderer.png', fullPage: true });
  });

  test('renders a color QuickDraw PICT resource', async ({ page }) => {
    await page.goto('/');
    const sample = page.getByTestId('sample-glider-color-art');
    await sample.getByRole('button', { name: 'With inferred fields' }).click();
    await page.getByRole('tab', { name: 'Browse Data' }).click();
    await expect(page.getByTestId('data-browser')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('resource-type-PICT').click();
    await page.locator('[data-testid^="resource-PICT-"]').first().click();
    const canvas = page.getByLabel(/Rendered QuickDraw picture PICT/).first();
    await expect(canvas).toBeVisible();
    await expect.poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).width)).toBeGreaterThan(0);
  });
});

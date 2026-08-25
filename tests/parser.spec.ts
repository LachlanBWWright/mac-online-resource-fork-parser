import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const samplePath = path.resolve('public/test-files/EarthFarm.ter.rsrc');
const retro68Fixtures = [
  'Dialog.rsrc',
  'WDEFShell.rsrc',
  'Raytracer.rsrc',
  'Raytracer2.rsrc',
].map((filename) => ({
  filename,
  path: path.resolve(`public/test-files/retro68/${filename}`),
}));
const additionalFixtures = [
  'Retro68-SystemExtension.rsrc',
  'RezillaPlugin.icns.rsrc',
  'RecklessDrivin.Data.rsrc',
  'glider/Glider-BW-Art.rsrc',
  'glider/Glider-Color-Art.rsrc',
  'glider/Glider-Project.rsrc',
  'pangea/nanosaur-deinon-skeleton.rsrc',
  'pangea/bugdom-lawn.rsrc',
  'pangea/nanosaur2-level1.rsrc',
  'pangea/billy-frontier-town-shootout.rsrc',
  'pangea/bugdom2-level1-garden.rsrc',
  'pangea/cromag-stoneage-jungle.rsrc',
  'classic-games/glider-pro-empty-house.rsrc',
  'classic-games/pararena2-para-sounds.rsrc',
].map((filename) => ({
  filename: filename.slice(filename.lastIndexOf('/') + 1),
  path: path.resolve(`public/test-files/opensource/${filename}`),
}));

async function closeLoadedFile(page: Page) {
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close file' }).click();
}

async function expectLandingPage(page: Page) {
  await expect(page.getByRole('heading', { name: 'Mac Resource Fork Parser' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sample files' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload .rsrc File' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'With struct data' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Without struct data' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Browse data' })).toBeVisible();
  await expect(page.getByText('Otto Matic — Level 1 Data')).toBeVisible();
}

async function waitForCollapsibleAnimations(page: Page) {
  await page.waitForFunction(() =>
    document
      .querySelectorAll('[data-radix-collapsible-content]')
      .length === 0 ||
    [...document.querySelectorAll('[data-radix-collapsible-content]')].every((element) =>
      element.getAnimations().every((animation) => animation.playState === 'finished' || animation.playState === 'idle'),
    ),
  );
}

async function loadSampleWithSpecs(page: Page) {
  await page.getByRole('button', { name: 'With struct data' }).first().click();
  await expect(page.getByText('EarthFarm.ter.rsrc')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Four-Letter Code Specifications' })).toBeVisible({ timeout: 30_000 });
}

test.describe('Resource fork parser user journeys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows a complete, actionable landing state', async ({ page }) => {
    await expectLandingPage(page);
    await expect(page.getByRole('heading', { name: 'Sample files' })).toBeVisible();
    await expect(page.getByText(/Open a .rsrc file to inspect, edit, and export/)).toBeVisible();
    await expect(page.getByText(/Work In Progress/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'With struct data' }).first()).toBeEnabled();
  });

  test('loads the bundled sample with specifications and exposes the editor workflow', async ({ page }) => {
    await loadSampleWithSpecs(page);

    await expect(page.getByRole('tab', { name: /Struct Specs/ })).toHaveAttribute('data-state', 'active');
    await expect(page.getByRole('tab', { name: /Browse Data/ })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Load Specs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Specs' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Export JSON' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Export TypeScript' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Pack to RSRC' })).toBeEnabled();

    const specification = page.getByTestId(/^flc-section-/).first();
    await expect(specification).toBeVisible();
    await expect(specification.getByText('Data Type Fields')).toBeVisible();
    await expect(specification.getByRole('button', { name: 'Add Field' })).toBeVisible();
  });

  test('edits a four-letter code and field name in the specification editor', async ({ page }) => {
    await loadSampleWithSpecs(page);

    const specification = page.getByTestId(/^flc-section-/).first();
    await specification.getByRole('button', { name: /Edit four-letter code/ }).click();
    const codeInput = page.getByRole('textbox', { name: /Four-letter code for/ });
    await codeInput.fill('TEST');
    await page.getByRole('button', { name: 'Save four-letter code' }).click();

    const renamedSpecification = page.getByTestId('flc-section-TEST');
    await expect(renamedSpecification).toBeVisible();
    const fieldName = renamedSpecification.getByRole('textbox', { name: /Field name/ }).first();
    await fieldName.fill('renamedField');
    await expect(fieldName).toHaveValue('renamedField');
  });

  test('uploads a resource fork through the real file input', async ({ page }) => {
    await page.locator('input[type="file"][accept=".rsrc"]').setInputFiles(samplePath);

    await expect(page.getByText('EarthFarm.ter.rsrc')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Four-Letter Code Specifications' })).toBeVisible({ timeout: 30_000 });
  });

  test('parses the additional classic Mac application fixtures', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept=".rsrc"]');

    for (const fixture of [...retro68Fixtures, ...additionalFixtures]) {
      await fileInput.setInputFiles(fixture.path);
      await expect(page.getByText(fixture.filename)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole('heading', { name: 'Four-Letter Code Specifications' })).toBeVisible({ timeout: 30_000 });

      if (fixture !== additionalFixtures.at(-1)) {
        await closeLoadedFile(page);
        await expect(page.getByRole('heading', { name: 'Sample files' })).toBeVisible();
      }
    }
  });

  test('supports defining an unknown struct and applying a valid layout', async ({ page }) => {
    await page.getByRole('button', { name: 'Without struct data' }).first().click();
    await expect(page.getByText('EarthFarm.ter.rsrc')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Struct Specification Not Defined').first()).toBeVisible({ timeout: 30_000 });

    const undefinedSpec = page.getByRole('button', { name: /Struct Specification Not Defined/ }).first();
    await undefinedSpec.click();
    const specification = page.getByTestId(/^flc-section-/).filter({ hasText: 'Struct Specification Not Defined' }).first();
    await specification.getByRole('button', { name: 'Define Data Structure' }).click();
    await expect(page.getByText(/Define Struct Specification for/)).toBeVisible();
    await expect(page.getByText(/Total Data Size:/)).toBeVisible();

    await page.getByRole('button', { name: 'Candidate templates' }).click();
    await expect(page.getByText(/bytes · .* records/).first()).toBeVisible();
    await page.getByRole('button', { name: /Add Field/ }).last().click();
    await expect(page.getByPlaceholder('Field name')).toHaveCount(2);
  });

  test('browse mode expands resources, searches fields, and edits a value', async ({ page }) => {
    await page.getByRole('button', { name: 'Browse data' }).click();
    const browser = page.getByTestId('data-browser');
    await expect(browser).toBeVisible({ timeout: 30_000 });
    await expect(browser.getByText('Data Browser')).toBeVisible();
    await expect(browser.getByPlaceholder('Search fields, values, IDs…')).toBeVisible();
    await expect(browser.getByPlaceholder('Filter by code')).toBeVisible();
    for (const toastClose of await page.locator('[data-rht-toaster] button').all()) {
      await toastClose.click({ force: true });
    }

    const expandChildren = browser.getByRole('button', { name: /children of Hedr/ });
    const tooltipId = await expandChildren.getAttribute('aria-describedby');
    expect(tooltipId).toBeTruthy();
    await expandChildren.click({ timeout: 30_000 });
    await expect(browser.getByText(/Resource #/).first()).toBeVisible();
    await waitForCollapsibleAnimations(page);
    await expect(expandChildren).toHaveAccessibleName(/Collapse children of/, { timeout: 30_000 });
    await expandChildren.hover();
    await expect(page.locator(`#${tooltipId}`)).toHaveText('Collapse all child resources');
    await expect(page.locator(`#${tooltipId}`)).toHaveCSS('opacity', '1');
    const expandFields = browser.getByRole('button', { name: /Expand fields in/ }).first();
    await expandFields.click({ timeout: 30_000 });

    const search = browser.getByPlaceholder('Search fields, values, IDs…');
    await search.fill('version');
    await expect(browser.getByText(/No results found/)).not.toBeVisible();
    await expect(browser.getByText('version:', { exact: true })).toBeVisible();

    const valueRow = browser.getByText('version:', { exact: true }).locator('..');
    await valueRow.getByRole('button').last().click();
    await expect(valueRow.locator('input')).toBeVisible();
    await valueRow.locator('input').fill('99');
    await valueRow.getByRole('button').first().click();
    await expect(valueRow.getByText('99', { exact: true })).toBeVisible();
    await expect(browser.getByText('1 unsaved change')).toBeVisible();
    await browser.getByRole('button', { name: 'Revert version' }).click();
    await expect(browser.getByText('1 unsaved change')).not.toBeVisible();
  });

  test('provides a paged hex editor for raw resource data', async ({ page }) => {
    await page.getByRole('button', { name: 'Without struct data' }).first().click();
    await expect(page.getByText('EarthFarm.ter.rsrc')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: /Browse Data/ }).click();
    const browser = page.getByTestId('data-browser');
    await expect(browser).toBeVisible({ timeout: 30_000 });

    const rawType = browser.getByTestId('resource-type-STgd');
    await expect(rawType).toBeVisible({ timeout: 30_000 });
    await rawType.click();
    const resource = browser.getByTestId('resource-STgd-1000');
    await expect(resource).toBeVisible({ timeout: 30_000 });
    await resource.click();

    const editor = browser.getByTestId('hex-editor');
    await expect(editor).toBeVisible({ timeout: 30_000 });
    await expect(editor.getByText('Hex editor')).toBeVisible();
    await expect(editor.getByText(/bytes$/)).toBeVisible();
    await expect(editor.getByRole('columnheader', { name: 'Offset' })).toBeVisible();
    await expect(editor.getByRole('columnheader', { name: 'ASCII' })).toBeVisible();
    await expect(editor.getByTestId('hex-byte-0')).toHaveValue(/^[0-9A-F]{2}$/);

    const firstByte = editor.getByTestId('hex-byte-0');
    await firstByte.fill('FF');
    await expect(firstByte).toHaveValue('FF');
    await editor.getByLabel('Import binary').setInputFiles({
      name: 'replacement.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
    });
    await expect(editor.getByTestId('hex-byte-0')).toHaveValue('DE');
    await expect(editor.getByTestId('hex-byte-3')).toHaveValue('EF');
    await editor.getByRole('button', { name: 'Apply changes' }).click();
    await expect(page.getByText('Resource bytes modified')).toBeVisible();
    await expect(page.getByText('modified').first()).toBeVisible();
  });

  test('opens the hex editor for decoded hexadecimal fields and renames resources', async ({ page }) => {
    await loadSampleWithSpecs(page);
    await page.getByRole('tab', { name: /Browse Data/ }).click();
    const browser = page.getByTestId('data-browser');
    await expect(browser).toBeVisible({ timeout: 30_000 });

    const search = browser.getByPlaceholder('Search fields, values, IDs…');
    await search.fill('alias_data');
    await browser.getByRole('button', { name: /Expand fields in alis resource/ }).first().click();
    await browser.getByText('Object (1 fields)', { exact: true }).first().click();
    const aliasField = browser.getByText('alias_data:', { exact: true }).first();
    await expect(aliasField).toBeVisible({ timeout: 30_000 });
    await browser.getByRole('button', { name: /Edit .*alias_data/ }).first().click();
    const fieldEditor = browser.getByTestId('hex-editor');
    await expect(fieldEditor).toBeVisible();
    await expect(fieldEditor.getByTestId('hex-byte-0')).toBeVisible();

    const hedreType = browser.getByTestId('resource-type-Hedr');
    await search.fill('');
    await hedreType.click();
    const resource = browser.getByTestId('resource-Hedr-1000');
    await browser.getByTestId('edit-resource-name-Hedr-1000').click();
    const nameInput = browser.getByRole('textbox', { name: 'Resource name for Hedr 1000' });
    await nameInput.fill('Renamed header');
    await browser.getByRole('button', { name: 'Save resource name 1000' }).click();
    await expect(resource.getByText('(Renamed header)', { exact: true })).toBeVisible();
  });

  test('allows a named field to opt into a visual preview format', async ({ page }) => {
    await loadSampleWithSpecs(page);
    await page.getByRole('button', { name: /^alis\b/ }).click();
    const alisSpec = page.getByTestId('flc-section-alis');
    await expect(alisSpec).toBeVisible();
    const previewSelect = alisSpec.getByRole('combobox', { name: 'Preview format for alias_data' });
    await previewSelect.click();
    await page.getByRole('option', { name: 'QuickDraw PICT' }).click();

    await page.getByRole('tab', { name: /Browse Data/ }).click();
    const browser = page.getByTestId('data-browser');
    await browser.getByPlaceholder('Search fields, values, IDs…').fill('alias_data');
    await browser.getByRole('button', { name: /Expand fields in alis resource/ }).first().click();
    await browser.getByText('Object (1 fields)', { exact: true }).first().click();
    await expect(browser.getByText('QuickDraw picture renderer')).toBeVisible({ timeout: 30_000 });
    await browser.getByRole('button', { name: /Expand fields in alis resource/ }).nth(1).click();
    await browser.getByText('Object (1 fields)', { exact: true }).nth(1).click();
    await expect(browser.getByText('QuickDraw picture renderer')).toHaveCount(2);
  });

  test('exports JSON, TypeScript, specifications, and the packed resource fork', async ({ page }) => {
    await loadSampleWithSpecs(page);

    const downloads = [
      { button: 'Export JSON', filename: /EarthFarm\.ter\.rsrc\.json/ },
      { button: 'Export TypeScript', filename: /EarthFarm.*-types\.ts/ },
      { button: 'Save Specs', filename: 'specifications.txt' },
      { button: 'Pack to RSRC', filename: /EarthFarm.*-edited\.rsrc/ },
    ];

    for (const item of downloads) {
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: item.button }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(item.filename);
      const toastClose = page.locator('[data-rht-toaster] button').last();
      if (await toastClose.count()) await toastClose.click({ force: true });
    }
  });

  test('closes a loaded resource and returns to a clean landing state', async ({ page }) => {
    await loadSampleWithSpecs(page);
    await closeLoadedFile(page);
    await expectLandingPage(page);
    await expect(page.getByRole('button', { name: 'Close' })).not.toBeVisible();
  });

  test('recovers visibly when a sample resource cannot be loaded', async ({ page }) => {
    await page.route('**/test-files/EarthFarm.ter.rsrc', async (route) => {
      await route.fulfill({ status: 503, body: 'sample unavailable' });
    });

    await page.getByRole('button', { name: 'With struct data' }).first().click();
    await expect(page.getByText('Failed to load Otto Matic — Level 1 Data')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/^Error:/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sample files' })).toBeVisible();
  });

  test('keeps controls usable on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expectLandingPage(page);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 24, 39)');
    const browseButton = page.getByRole('button', { name: 'Browse data' });
    await browseButton.scrollIntoViewIfNeeded();
    await expect(browseButton).toBeVisible();
  });

  test('keeps the loaded toolbar usable with a long filename', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.locator('input[type="file"][accept=".rsrc"]').setInputFiles(
      path.resolve('public/test-files/opensource/Retro68-SystemExtension.rsrc'),
    );

    await expect(page.getByText('Retro68-SystemExtension.rsrc')).toBeVisible({ timeout: 30_000 });
    const toolbar = page.getByTestId('loaded-file-toolbar');
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Convert JSON to RSRC' })).toBeVisible();
    const fitsViewport = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fitsViewport).toBe(true);
  });
});

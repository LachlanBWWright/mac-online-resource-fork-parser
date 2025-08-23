import { test, expect } from '@playwright/test';

test.describe('Mac Resource Fork Parser E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5174');
  });

  test('displays main interface correctly', async ({ page }) => {
    // Check main title and description
    await expect(page.getByRole('heading', { name: 'Mac Resource Fork Parser' })).toBeVisible();
    await expect(page.getByText('Upload a resource fork file to analyze and experiment with data types')).toBeVisible();
    
    // Check key sections are present
    await expect(page.getByText('Save & Load Specifications')).toBeVisible();
    await expect(page.getByText('File Operations')).toBeVisible();
    
    // Check main action buttons
    await expect(page.getByRole('button', { name: /Choose \.rsrc File/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Convert from JSON/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Load EarthFarm Sample/i })).toBeVisible();
  });

  test('has proper dark theme styling', async ({ page }) => {
    // Check main container has dark background
    const mainContainer = page.locator('div').filter({ hasText: 'Mac Resource Fork Parser' }).first();
    await expect(mainContainer).toHaveClass(/bg-gray-900/);
    await expect(mainContainer).toHaveClass(/text-gray-100/);
  });

  test('save/load specifications section is collapsible', async ({ page }) => {
    // Initially collapsed - content should not be visible
    await expect(page.getByText('Save Current Specifications')).not.toBeVisible();
    
    // Click to expand
    await page.getByText('Save & Load Specifications').click();
    
    // Content should now be visible
    await expect(page.getByText('Save Current Specifications')).toBeVisible();
    await expect(page.getByText('Load Specifications from File')).toBeVisible();
  });

  test('loads EarthFarm sample and shows four-letter codes', async ({ page }) => {
    // Load the sample
    await page.getByRole('button', { name: /Load EarthFarm Sample/i }).click();
    
    // Wait for processing to complete
    await expect(page.getByText('Processing...')).toBeVisible();
    await expect(page.getByText('Processing...')).not.toBeVisible({ timeout: 10000 });
    
    // Check that four-letter codes section appears
    await expect(page.getByText('Four-Letter Code Specifications')).toBeVisible();
    
    // Check that Hedr and Layr specifications are loaded
    await expect(page.getByText('Hedr')).toBeVisible();
    await expect(page.getByText('Layr')).toBeVisible();
    
    // Check download button appears
    await expect(page.getByRole('button', { name: /Download as JSON/i })).toBeVisible();
  });

  test('displays sample data for each four-letter code', async ({ page }) => {
    // Load the sample
    await page.getByRole('button', { name: /Load EarthFarm Sample/i }).click();
    await expect(page.getByText('Processing...')).not.toBeVisible({ timeout: 10000 });
    
    // Check sample data sections are present
    const sampleDataHeadings = page.getByText('Sample Data:');
    await expect(sampleDataHeadings).toHaveCount(2);
    
    // Check that sample data is displayed (not just empty)
    await expect(page.locator('pre').first()).toContainText('{');
  });

  test('type dropdowns are properly sized and functional', async ({ page }) => {
    // Load the sample
    await page.getByRole('button', { name: /Load EarthFarm Sample/i }).click();
    await expect(page.getByText('Processing...')).not.toBeVisible({ timeout: 10000 });
    
    // Check that dropdowns exist and are properly sized
    const dropdowns = page.getByRole('combobox');
    await expect(dropdowns.first()).toBeVisible();
    
    // Click first dropdown to open it
    await dropdowns.first().click();
    
    // Check that options are visible and properly labeled
    await expect(page.getByRole('option', { name: /L - Unsigned Long/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /i - Signed Int/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /f - Float/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /s - String/ })).toBeVisible();
  });

  test('can change data type and see updated parsing', async ({ page }) => {
    // Load the sample
    await page.getByRole('button', { name: /Load EarthFarm Sample/i }).click();
    await expect(page.getByText('Processing...')).not.toBeVisible({ timeout: 10000 });
    
    // Find the first type dropdown for Hedr
    const firstDropdown = page.getByRole('row', { name: /header_data/ }).getByRole('combobox');
    
    // Change type to String
    await firstDropdown.click();
    await page.getByRole('option', { name: /s - String/ }).click();
    
    // Wait for re-parsing to complete
    await page.waitForTimeout(1000);
    
    // Check that the selection was applied
    await expect(firstDropdown).toContainText('s - String');
  });

  test('shows status indicators for validation', async ({ page }) => {
    // Load the sample
    await page.getByRole('button', { name: /Load EarthFarm Sample/i }).click();
    await expect(page.getByText('Processing...')).not.toBeVisible({ timeout: 10000 });
    
    // Check for success status indicators
    await expect(page.getByText('Successfully parsed data')).toHaveCount(2);
    
    // Check for checkmark icons (success indicators)
    const checkIcons = page.locator('svg').filter({ hasText: '' }); // Look for check icons
    await expect(checkIcons.first()).toBeVisible();
  });

  test('can download JSON file', async ({ page }) => {
    // Setup download listener
    const downloadPromise = page.waitForEvent('download');
    
    // Load the sample
    await page.getByRole('button', { name: /Load EarthFarm Sample/i }).click();
    await expect(page.getByText('Processing...')).not.toBeVisible({ timeout: 10000 });
    
    // Click download button
    await page.getByRole('button', { name: /Download as JSON/i }).click();
    
    // Wait for download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('has single column layout with proper spacing', async ({ page }) => {
    // Check main container width and spacing
    const mainContainer = page.locator('div.max-w-5xl');
    await expect(mainContainer).toBeVisible();
    await expect(mainContainer).toHaveClass(/space-y-8/);
  });

  test('file operations are combined in single box', async ({ page }) => {
    // All file operation buttons should be in the same card
    const fileOpsCard = page.locator('div').filter({ hasText: 'File Operations' }).first();
    
    await expect(fileOpsCard.getByRole('button', { name: /Choose \.rsrc File/i })).toBeVisible();
    await expect(fileOpsCard.getByRole('button', { name: /Convert from JSON/i })).toBeVisible();
    await expect(fileOpsCard.getByRole('button', { name: /Load EarthFarm Sample/i })).toBeVisible();
  });

  test('toggle switches work correctly', async ({ page }) => {
    // Load the sample
    await page.getByRole('button', { name: /Load EarthFarm Sample/i }).click();
    await expect(page.getByText('Processing...')).not.toBeVisible({ timeout: 10000 });
    
    // Find "Is Array" checkbox for Hedr (should be unchecked initially)
    const hedrSection = page.locator('div').filter({ hasText: 'Hedr' }).first();
    const isArrayCheckbox = hedrSection.getByRole('checkbox', { name: 'Is Array' });
    
    await expect(isArrayCheckbox).not.toBeChecked();
    
    // Toggle it
    await isArrayCheckbox.check();
    await expect(isArrayCheckbox).toBeChecked();
    
    // Find "Is Array" checkbox for Layr (should be checked initially)
    const layrSection = page.locator('div').filter({ hasText: 'Layr' }).first();
    const layrIsArrayCheckbox = layrSection.getByRole('checkbox', { name: 'Is Array' });
    
    await expect(layrIsArrayCheckbox).toBeChecked();
  });

  test('can add and remove fields', async ({ page }) => {
    // Load the sample
    await page.getByRole('button', { name: /Load EarthFarm Sample/i }).click();
    await expect(page.getByText('Processing...')).not.toBeVisible({ timeout: 10000 });
    
    // Get initial field count for Hedr
    const hedrTable = page.locator('div').filter({ hasText: 'Hedr' }).locator('table').first();
    const initialRowCount = await hedrTable.locator('tbody tr').count();
    
    // Add a field
    const hedrSection = page.locator('div').filter({ hasText: 'Hedr' }).first();
    await hedrSection.getByRole('button', { name: /Add Field/i }).click();
    
    // Check that a new row was added
    await expect(hedrTable.locator('tbody tr')).toHaveCount(initialRowCount + 1);
    
    // Remove a field (click the last remove button)
    const removeButtons = hedrTable.locator('button').filter({ hasText: '' }); // Trash icons
    const lastRemoveButton = removeButtons.last();
    await lastRemoveButton.click();
    
    // Check that we're back to original count
    await expect(hedrTable.locator('tbody tr')).toHaveCount(initialRowCount);
  });

  test('does not show generated spec text', async ({ page }) => {
    // Load the sample
    await page.getByRole('button', { name: /Load EarthFarm Sample/i }).click();
    await expect(page.getByText('Processing...')).not.toBeVisible({ timeout: 10000 });
    
    // Should not show generated spec like "Hedr:L5i3f5i40xi+"
    await expect(page.getByText(/Hedr:L5i3f5i40xi\+/)).not.toBeVisible();
    await expect(page.getByText(/Generated Spec:/)).not.toBeVisible();
  });

  test('error handling works correctly', async ({ page }) => {
    // Mock a failed fetch to test error handling
    await page.route('/test-files/EarthFarm.ter.rsrc', route => {
      route.fulfill({ status: 404 });
    });
    
    // Try to load sample (should fail)
    await page.getByRole('button', { name: /Load EarthFarm Sample/i }).click();
    
    // Should show error message
    await expect(page.getByText(/Error:/)).toBeVisible();
    await expect(page.getByText(/Failed to load EarthFarm sample/)).toBeVisible();
  });
});
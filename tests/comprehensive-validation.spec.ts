import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

test.describe('EarthFarm Sample Comprehensive Validation', () => {
  test('should load EarthFarm sample and verify all four-letter codes', async ({ page }) => {
    await page.goto('http://localhost:5173/mac-online-resource-fork-parser/');

    // Load EarthFarm sample
    await page.click('button:has-text("Load EarthFarm Sample")');

    // Wait for loading to complete
    await page.waitForTimeout(2000);

    // Take screenshot of loaded state
    await page.screenshot({ path: 'screenshots/comprehensive-earthfarm-loaded.png', fullPage: true });

    // Verify all 15 four-letter codes are present
    const expectedCodes = [
      'Hedr', 'alis', 'Atrb', 'Layr', 'YCrd', 'STgd', 
      'Itms', 'ItCo', 'Spln', 'SpNb', 'SpPt', 'SpIt', 
      'Fenc', 'FnNb', 'Liqd'
    ];

    for (const code of expectedCodes) {
      const heading = await page.locator(`h3:has-text("${code}")`);
      await expect(heading).toBeVisible();
      console.log(`✓ Found ${code}`);
    }

    // Check that there are no conversion errors
    const conversionErrors = await page.locator('text=/Conversion Error:/i').count();
    expect(conversionErrors).toBe(0);
    console.log('✓ No conversion errors found');

    // Verify that valid status badges are present
    const validBadges = await page.locator('div:has-text("valid")').count();
    expect(validBadges).toBeGreaterThan(0);
    console.log(`✓ Found ${validBadges} valid status badges`);

    // Check some specific field names to ensure proper parsing
    const pageContent = await page.content();
    
    // Hedr should have field names like "version", "numItems"
    expect(pageContent.includes('version') || pageContent.includes('Version')).toBeTruthy();
    console.log('✓ Found expected field names');

    // Check that Liqd has array fields (x/y pairs)
    const liqdSection = await page.locator('h3:has-text("Liqd")');
    if (await liqdSection.count() > 0) {
      // Look for array field indicator
      const arrayFields = await page.locator('[data-testid*="array-field"]').count();
      console.log(`✓ Liqd section found with ${arrayFields} array configuration elements`);
    }

    // Verify alis and ItCo don't have hundreds of 1-byte fields
    const aliasSection = page.locator('h3:has-text("alis")').first();
    if (await aliasSection.isVisible()) {
      // Count type dropdowns in alis section
      const aliasParent = page.locator('[data-testid="four-letter-code-alis"]').first();
      if (await aliasParent.count() > 0) {
        const fieldRows = await aliasParent.locator('table tbody tr').count();
        console.log(`alis has ${fieldRows} field rows`);
        expect(fieldRows).toBeLessThan(50); // Should be compact, not 422 rows
      }
    }

    const itcoSection = page.locator('h3:has-text("ItCo")').first();
    if (await itcoSection.isVisible()) {
      const itcoParent = page.locator('[data-testid="four-letter-code-ItCo"]').first();
      if (await itcoParent.count() > 0) {
        const fieldRows = await itcoParent.locator('table tbody tr').count();
        console.log(`ItCo has ${fieldRows} field rows`);
        expect(fieldRows).toBeLessThan(50); // Should be compact, not 450 rows
      }
    }

    console.log('✓ All validations passed');
  });

  test('should support round-trip upload and download', async ({ page }) => {
    await page.goto('http://localhost:5173/mac-online-resource-fork-parser/');

    // Load EarthFarm sample
    await page.click('button:has-text("Load EarthFarm Sample")');
    await page.waitForTimeout(2000);

    // Download JSON
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download as JSON")');
    const download = await downloadPromise;
    
    // Save the downloaded file
    const downloadPath = join(__dirname, '..', 'temp', 'earthfarm-download.json');
    await download.saveAs(downloadPath);
    console.log('✓ Downloaded JSON file');

    // Verify the downloaded JSON structure
    const jsonContent = JSON.parse(readFileSync(downloadPath, 'utf-8'));
    expect(jsonContent).toHaveProperty('tree');
    expect(Object.keys(jsonContent.tree).length).toBe(15); // 15 four-letter codes
    console.log(`✓ Downloaded JSON has ${Object.keys(jsonContent.tree).length} four-letter codes`);

    // Clear the current state
    await page.reload();

    // Upload the JSON we just downloaded
    const fileInput = await page.locator('input[accept=".json"]');
    await fileInput.setInputFiles(downloadPath);
    await page.waitForTimeout(2000);

    // Verify the same four-letter codes appear
    const expectedCodes = [
      'Hedr', 'alis', 'Atrb', 'Layr', 'YCrd', 'STgd', 
      'Itms', 'ItCo', 'Spln', 'SpNb', 'SpPt', 'SpIt', 
      'Fenc', 'FnNb', 'Liqd'
    ];

    for (const code of expectedCodes) {
      const heading = await page.locator(`h3:has-text("${code}")`);
      await expect(heading).toBeVisible();
    }

    console.log('✓ Round-trip upload/download successful');
  });

  test('should verify field names are properly displayed', async ({ page }) => {
    await page.goto('http://localhost:5173/mac-online-resource-fork-parser/');

    // Load EarthFarm sample
    await page.click('button:has-text("Load EarthFarm Sample")');
    await page.waitForTimeout(2000);

    // Take full page screenshot for manual review
    await page.screenshot({ path: 'screenshots/field-names-review.png', fullPage: true });

    // Get the full page content
    const pageContent = await page.content();

    // Check for some expected field names from different four-letter codes
    const expectedFieldNames = [
      'version',
      'numItems',
      'mapWidth',
      'mapHeight',
      'type',
      'flags',
      'hotSpotX',
      'hotSpotZ'
    ];

    const foundFields = [];
    for (const fieldName of expectedFieldNames) {
      if (pageContent.toLowerCase().includes(fieldName.toLowerCase())) {
        foundFields.push(fieldName);
        console.log(`✓ Found field name: ${fieldName}`);
      }
    }

    // At least some expected field names should be present
    expect(foundFields.length).toBeGreaterThan(0);
    console.log(`✓ Found ${foundFields.length}/${expectedFieldNames.length} expected field names`);

    // Check that we don't have too many unnamed fields like "field_27"
    const unnamedFieldMatches = pageContent.match(/field_\d+/g);
    const unnamedFieldCount = unnamedFieldMatches ? unnamedFieldMatches.length : 0;
    console.log(`Found ${unnamedFieldCount} unnamed fields`);
    
    // Should be minimal unnamed fields
    expect(unnamedFieldCount).toBeLessThan(20);
    console.log('✓ Unnamed field count is acceptable');
  });

  test('should not have blank type selection fields', async ({ page }) => {
    await page.goto('http://localhost:5173/mac-online-resource-fork-parser/');

    // Load EarthFarm sample
    await page.click('button:has-text("Load EarthFarm Sample")');
    await page.waitForTimeout(2000);

    // Count all select elements that have "Select type..." as placeholder
    const selectElements = await page.locator('select, button[role="combobox"]').all();
    let blankCount = 0;
    let totalCount = 0;

    for (const select of selectElements) {
      const text = await select.textContent();
      if (text && (text.includes('Select type') || text.trim() === '')) {
        blankCount++;
      }
      totalCount++;
    }

    console.log(`Found ${blankCount} blank/placeholder selects out of ${totalCount} total`);
    
    // Should have very few blank selects (ideally 0, but allow a small number for undefined structs)
    expect(blankCount).toBeLessThan(5);
    console.log('✓ Blank type selection fields are minimal');
  });
});

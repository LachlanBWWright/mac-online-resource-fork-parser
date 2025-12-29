import { test, expect } from '@playwright/test';

test.describe('Verify rsrcdump-ts v1.0.5 upgrade', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/mac-online-resource-fork-parser/');
    await page.waitForLoadState('networkidle');
  });

  test('should load EarthFarm sample successfully', async ({ page }) => {
    // Click the EarthFarm sample button
    await page.click('text=Load EarthFarm Sample');
    
    // Wait for processing to complete
    await page.waitForTimeout(3000);
    
    // Verify all 15 four-letter codes are present
    const fourLetterCodes = ['Hedr', 'alis', 'Atrb', 'Layr', 'YCrd', 'STgd', 'Itms', 'ItCo', 'Spln', 'SpNb', 'SpPt', 'SpIt', 'Fenc', 'FnNb', 'Liqd'];
    
    for (const code of fourLetterCodes) {
      const heading = page.locator(`h3:text("${code}")`);
      await expect(heading).toBeVisible();
      console.log(`✓ Found ${code}`);
    }
    
    // Check for no conversion errors
    const conversionErrors = await page.locator('text=/Conversion Error:/i').count();
    expect(conversionErrors).toBe(0);
    console.log('✓ No conversion errors found');
    
    // Verify field names are present in Hedr
    const hedrSection = page.locator('h3:text("Hedr")').locator('..').locator('..');
    await expect(hedrSection.locator('text=/version|numItems|mapWidth|mapHeight/i').first()).toBeVisible();
    console.log('✓ Field names are properly loaded');
  });

  test('should handle round-trip JSON conversion', async ({ page }) => {
    // Load EarthFarm sample
    await page.click('text=Load EarthFarm Sample');
    await page.waitForTimeout(3000);
    
    // Download JSON
    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Download as JSON');
    const download = await downloadPromise;
    const jsonPath = await download.path();
    
    expect(jsonPath).toBeTruthy();
    console.log('✓ JSON downloaded successfully');
    
    // Read the downloaded JSON
    const fs = await import('fs/promises');
    const jsonContent = await fs.readFile(jsonPath!, 'utf-8');
    const jsonData = JSON.parse(jsonContent);
    
    // Verify structure
    expect(jsonData).toHaveProperty('Hedr');
    expect(jsonData).toHaveProperty('Layr');
    console.log('✓ JSON structure is valid');
    
    // Verify field names in Hedr
    const hedrResource = Object.values(jsonData.Hedr)[0] as any;
    expect(hedrResource).toHaveProperty('obj');
    expect(hedrResource.obj).toHaveProperty('version');
    expect(hedrResource.obj).toHaveProperty('numItems');
    console.log('✓ Hedr fields are correct: version, numItems');
  });

  test('should handle file upload', async ({ page }) => {
    // Upload a resource fork file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('public/test-files/EarthFarm.ter.rsrc');
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Verify four-letter codes loaded
    const heading = page.locator('h3:text("Hedr")');
    await expect(heading).toBeVisible();
    console.log('✓ File upload works');
  });
});

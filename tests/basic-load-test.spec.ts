import { test, expect } from '@playwright/test';

test('Basic EarthFarm sample loading test', async ({ page }) => {
  // Navigate to the application
  await page.goto('http://localhost:5173/mac-online-resource-fork-parser/');
  
  // Wait for page to load
  await page.waitForTimeout(1000);
  
  // Take screenshot of initial state
  await page.screenshot({ path: 'screenshots/initial-state.png', fullPage: true });
  
  // Check if the Load EarthFarm Sample button exists
  const sampleButton = page.locator('button:has-text("Load EarthFarm Sample")');
  await expect(sampleButton).toBeVisible({ timeout: 10000 });
  console.log('✓ Found Load EarthFarm Sample button');
  
  // Click the button
  await sampleButton.click();
  console.log('✓ Clicked Load EarthFarm Sample button');
  
  // Wait for loading
  await page.waitForTimeout(5000);
  
  // Take screenshot after loading
  await page.screenshot({ path: 'screenshots/after-sample-load.png', fullPage: true });
  
  // Check page content
  const pageContent = await page.content();
  console.log('Page content length:', pageContent.length);
  
  // Check for Four-Letter Code Specifications section
  const specificationsSection = page.locator('h2:has-text("Four-Letter Code Specifications"), h2:has-text("Specifications")');
  const sectionCount = await specificationsSection.count();
  console.log(`Found ${sectionCount} specifications sections`);
  
  // Check for any four-letter code sections
  const fourLetterSections = page.locator('[data-testid^="four-letter-code-"]');
  const fourLetterCount = await fourLetterSections.count();
  console.log(`Found ${fourLetterCount} four-letter code sections`);
  
  // Get all h3 headings
  const allH3 = await page.locator('h3').allTextContents();
  console.log('All H3 headings:', allH3);
  
  // Check if there are any conversion errors
  const errors = page.locator('text=/error/i, text=/failed/i');
  const errorCount = await errors.count();
  console.log(`Found ${errorCount} error messages`);
  
  if (errorCount > 0) {
    const errorTexts = await errors.allTextContents();
    console.log('Error messages:', errorTexts);
  }
});

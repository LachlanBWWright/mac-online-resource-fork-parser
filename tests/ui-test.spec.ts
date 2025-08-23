import { test, expect } from '@playwright/test';

test.describe('Mac Resource Fork Parser', () => {
  test('should load and display the updated interface', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Take a screenshot of the new interface
    await page.screenshot({ 
      path: 'tests/screenshots/new-interface.png',
      fullPage: true 
    });
    
    // Check if main elements are present
    await expect(page.locator('h1')).toContainText('Mac Resource Fork Parser');
    
    // Check for collapsible save/load section
    await expect(page.locator('text=Save & Load Specifications')).toBeVisible();
    
    // Check for file operations section
    await expect(page.locator('text=File Operations')).toBeVisible();
    
    // Test the save/load collapsible functionality
    const collapsibleTrigger = page.locator('text=Save & Load Specifications');
    await collapsibleTrigger.click();
    await page.screenshot({ 
      path: 'tests/screenshots/save-load-expanded.png',
      fullPage: true 
    });
  });

  test('should handle EarthFarm sample loading', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Click the EarthFarm sample button
    const earthFarmButton = page.locator('text=Load EarthFarm Sample');
    await earthFarmButton.click();
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Take screenshot after loading sample
    await page.screenshot({ 
      path: 'tests/screenshots/earthfarm-loaded.png',
      fullPage: true 
    });
    
    // Check if four-letter codes appear
    await expect(page.locator('text=Configure Four-Letter Codes')).toBeVisible({ timeout: 10000 });
    
    // Take screenshot of four-letter codes configuration
    await page.screenshot({ 
      path: 'tests/screenshots/four-letter-codes.png',
      fullPage: true 
    });
  });

  test('should test data type dropdown functionality', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Load sample first
    await page.locator('text=Load EarthFarm Sample').click();
    await page.waitForTimeout(3000);
    
    // Wait for four-letter codes to appear
    await page.waitForSelector('text=Configure Four-Letter Codes', { timeout: 10000 });
    
    // Find the first data type dropdown
    const firstDropdown = page.locator('select').first();
    if (await firstDropdown.isVisible()) {
      // Take screenshot before change
      await page.screenshot({ 
        path: 'tests/screenshots/before-dropdown-change.png',
        fullPage: true 
      });
      
      // Change the data type to something invalid for testing
      await firstDropdown.selectOption('s');
      
      // Click update parse button
      await page.locator('text=Update Parse').first().click();
      await page.waitForTimeout(2000);
      
      // Take screenshot after change
      await page.screenshot({ 
        path: 'tests/screenshots/after-dropdown-change.png',
        fullPage: true 
      });
    }
  });
});
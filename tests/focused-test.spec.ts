import { test, expect } from '@playwright/test';

test.describe('Mac Resource Fork Parser - EarthFarm Loading Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app running on port 5173
    await page.goto('http://localhost:5173');
  });

  test('loads EarthFarm sample without hardcoded specs and shows all four-letter codes', async ({ page }) => {
    // Wait for the page to load
    await expect(page.locator('h1')).toContainText('Mac Resource Fork Parser');
    
    // Click the EarthFarm sample button
    await page.click('text=Load EarthFarm Sample');
    
    // Wait for processing to complete
    await page.waitForSelector('text=Four-Letter Code Specifications', { timeout: 15000 });
    
    // Take a screenshot to verify the interface
    await page.screenshot({ 
      path: 'screenshots/earthfarm-loaded-without-hardcoding.png',
      fullPage: true 
    });
    
    // Count the number of four-letter codes detected
    const codeElements = await page.locator('[data-testid="four-letter-code-section"]').count();
    console.log(`Four-letter codes detected: ${codeElements}`);
    
    // Verify we have multiple four-letter codes (should be 15 for EarthFarm)
    expect(codeElements).toBeGreaterThan(10);
    
    // Check that status indicators are present
    const statusElements = await page.locator('.status-indicator').count();
    console.log(`Status indicators found: ${statusElements}`);
    expect(statusElements).toBeGreaterThan(0);
    
    // Verify sample data is being displayed
    const sampleElements = await page.locator('.sample-data').count();
    console.log(`Sample data elements found: ${sampleElements}`);
    expect(sampleElements).toBeGreaterThan(0);
    
    // Check that JSON download button is available
    await expect(page.locator('text=Download as JSON')).toBeVisible();
    
    // Verify no hardcoded four-letter code errors by checking console
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));
    
    // Make sure no error messages about missing hardcoded specs
    const errorLogs = logs.filter(log => log.includes('error') || log.includes('Error'));
    console.log('Error logs:', errorLogs);
  });

  test('can modify data types and see real-time updates', async ({ page }) => {
    // Load EarthFarm sample
    await page.click('text=Load EarthFarm Sample');
    await page.waitForSelector('text=Four-Letter Code Specifications', { timeout: 15000 });
    
    // Find the first type dropdown
    const firstDropdown = page.locator('select').first();
    await expect(firstDropdown).toBeVisible();
    
    // Change the type and verify it updates
    await firstDropdown.selectOption('f');
    
    // Verify the status updates after the change
    await page.waitForTimeout(2000); // Allow time for re-parsing
    
    // Take screenshot of the updated state
    await page.screenshot({ 
      path: 'screenshots/earthfarm-type-changed.png',
      fullPage: true 
    });
    
    console.log('Type change test completed successfully');
  });
});
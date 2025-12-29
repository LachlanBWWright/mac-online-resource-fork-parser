import { test } from '@playwright/test';

test('Check console logs during sample load', async ({ page }) => {
  // Listen to console messages
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`);
  });
  
  // Listen to page errors
  const pageErrors: string[] = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });
  
  // Navigate to the application
  await page.goto('http://localhost:5173/mac-online-resource-fork-parser/');
  await page.waitForTimeout(1000);
  
  // Click Load EarthFarm Sample button
  const sampleButton = page.locator('button:has-text("Load EarthFarm Sample")');
  await sampleButton.click();
  
  // Wait for operations to complete
  await page.waitForTimeout(5000);
  
  // Log all console messages
  console.log('\n=== Console Messages ===');
  consoleMessages.forEach(msg => console.log(msg));
  
  // Log all page errors
  console.log('\n=== Page Errors ===');
  if (pageErrors.length > 0) {
    pageErrors.forEach(err => console.log(err));
  } else {
    console.log('No page errors');
  }
  
  // Check the React component state by evaluating JS
  const componentInfo = await page.evaluate(() => {
    const root = document.getElementById('root');
    return {
      hasRoot: !!root,
      innerHTML: root?.innerHTML.substring(0, 500),
      fourLetterCodesCount: document.querySelectorAll('[data-testid^="four-letter-code-"]').length
    };
  });
  
  console.log('\n=== Component Info ===');
  console.log('Has root:', componentInfo.hasRoot);
  console.log('Four-letter codes rendered:', componentInfo.fourLetterCodesCount);
  console.log('Root innerHTML preview:', componentInfo.innerHTML);
});

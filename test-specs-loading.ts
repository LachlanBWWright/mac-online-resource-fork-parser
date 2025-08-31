import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function testSpecificationsLoading() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Navigate to the app
  await page.goto('http://localhost:5174');
  await page.waitForLoadState('networkidle');
  
  console.log('=== Testing EarthFarm Sample Loading ===');
  
  // Test 1: Load EarthFarm Sample
  await page.click('button:has-text("Load EarthFarm Sample")');
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'screenshots/test-earthfarm-loading.png', fullPage: true });
  
  // Check for conversion errors
  const conversionErrors = await page.locator('text="Conversion Error:"').count();
  console.log(`Found ${conversionErrors} conversion errors after loading EarthFarm sample`);
  
  // Check the page content for four-letter codes
  const fourLetterCodes = await page.locator('[data-testid="four-letter-code-spec"]').count();
  console.log(`Found ${fourLetterCodes} four-letter code specifications`);
  
  // Get list of four-letter codes
  const codeElements = await page.locator('[data-testid="four-letter-code-spec"]').all();
  for (let i = 0; i < codeElements.length; i++) {
    const codeTitle = await codeElements[i].locator('h3').textContent();
    const status = await codeElements[i].locator('[data-testid="status-icon"]').textContent();
    console.log(`Code ${i + 1}: ${codeTitle?.trim()} - Status: ${status?.trim()}`);
  }
  
  console.log('\n=== Testing Manual Spec File Upload ===');
  
  // Test 2: Manual upload of otto-specs.txt
  // First reload the page to start fresh
  await page.reload();
  await page.waitForLoadState('networkidle');
  
  // Upload EarthFarm.ter.rsrc first
  const fileInput = page.locator('input[type="file"][accept=".rsrc"]');
  await fileInput.setInputFiles('/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/public/test-files/EarthFarm.ter.rsrc');
  await page.waitForTimeout(3000);
  
  // Then upload spec file
  await page.click('button:has-text("Specification Management")');
  await page.waitForTimeout(1000);
  
  const specFileInput = page.locator('input[type="file"][accept=".txt,.spec"]');
  await specFileInput.setInputFiles('/home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/public/test-files/otto-specs.txt');
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'screenshots/test-manual-spec-upload.png', fullPage: true });
  
  // Check for conversion errors again
  const conversionErrors2 = await page.locator('text="Conversion Error:"').count();
  console.log(`Found ${conversionErrors2} conversion errors after uploading specs manually`);
  
  // Check the page content again
  const fourLetterCodes2 = await page.locator('[data-testid="four-letter-code-spec"]').count();
  console.log(`Found ${fourLetterCodes2} four-letter code specifications after manual upload`);
  
  // Get page content to search for errors
  const pageContent = await page.content();
  const hasConversionErrors = pageContent.includes('Conversion Error:');
  console.log(`Page contains conversion errors: ${hasConversionErrors}`);
  
  console.log('\n=== Raw Page Content Analysis ===');
  
  // Get sample data text
  const sampleElements = await page.locator('[data-testid="sample-data"]').all();
  for (let i = 0; i < Math.min(3, sampleElements.length); i++) {
    const sampleText = await sampleElements[i].textContent();
    console.log(`Sample ${i + 1}: ${sampleText?.substring(0, 200)}...`);
  }
  
  await browser.close();
}

testSpecificationsLoading().catch(console.error);
import { test } from '@playwright/test';
import { chromium } from 'playwright';

async function testConversionErrors() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Log console errors
    page.on('console', msg => {
      console.log('Browser console:', msg.type(), msg.text());
    });
    
    page.on('pageerror', error => {
      console.log('Page error:', error.message);
    });

    // Navigate to the app
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    console.log('=== Page loaded ===');
    
    // Log console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });
    
    // Check if there are already conversion errors visible
    const initialContent = await page.textContent('body');
    const hasInitialErrors = initialContent?.includes('Conversion Error:') || initialContent?.includes('conversion_error');
    console.log(`Initial page has conversion errors: ${hasInitialErrors}`);
    
    // Look for the EarthFarm button and click it
    const buttonExists = await page.locator('text=Load EarthFarm Sample').count() > 0;
    console.log(`Load EarthFarm Sample button exists: ${buttonExists}`);
    
    if (!buttonExists) {
      console.log('Button not found. Looking for other buttons...');
      const allButtons = await page.locator('button').allTextContents();
      console.log('Available buttons:', allButtons);
      console.log('Page content (first 500 chars):', initialContent?.substring(0, 500));
    }
    if (buttonExists) {
      console.log('Clicking Load EarthFarm Sample button...');
      await page.click('text=Load EarthFarm Sample');
      await page.waitForTimeout(5000);
      
      // Check for conversion errors
      const afterLoadContent = await page.textContent('body');
      const hasConversionErrors = afterLoadContent?.includes('Conversion Error:') || afterLoadContent?.includes('conversion_error');
      console.log(`After loading EarthFarm: has conversion errors = ${hasConversionErrors}`);
      
      if (hasConversionErrors) {
        console.log('=== FOUND CONVERSION ERRORS IN EARTHFARM SAMPLE ===');
        
        // Extract specific error messages - look for patterns like "Conversion Error:" followed by text
        const conversionErrorPattern = /Conversion Error:[^}]*}/g;
        const conversionErrorPattern2 = /"conversion_error":\s*"[^"]*"/g;
        
        const errorMatches1 = afterLoadContent?.match(conversionErrorPattern);
        const errorMatches2 = afterLoadContent?.match(conversionErrorPattern2);
        
        if (errorMatches1) {
          console.log(`Found ${errorMatches1.length} 'Conversion Error:' messages:`);
          errorMatches1.forEach((error, index) => {
            console.log(`Error ${index + 1}: ${error}`);
          });
        }
        
        if (errorMatches2) {
          console.log(`Found ${errorMatches2.length} 'conversion_error' fields:`);
          errorMatches2.forEach((error, index) => {
            console.log(`Field ${index + 1}: ${error}`);
          });
        }
        
        // Look for sample data that has conversion errors
        const sampleElements = await page.locator('[data-testid]').all();
        console.log(`Found ${sampleElements.length} test elements`);
        
        for (let i = 0; i < Math.min(sampleElements.length, 20); i++) {
          const element = sampleElements[i];
          const testId = await element.getAttribute('data-testid');
          const text = await element.textContent();
          
          if (text && (text.includes('Conversion Error:') || text.includes('conversion_error'))) {
            console.log(`Element with testid '${testId}' has conversion error:`);
            console.log(text.substring(0, 200) + '...');
          }
        }
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

testConversionErrors();
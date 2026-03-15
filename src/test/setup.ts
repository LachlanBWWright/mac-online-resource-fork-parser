import '@testing-library/jest-dom'
import { readFileSync } from 'fs'
import { join } from 'path'

// Mock fetch for loading test files in vitest
const originalFetch = global.fetch;

global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  // Handle test file requests
  if (url.startsWith('/test-files/')) {
    const filename = url.replace('/test-files/', '');
    const filepath = join(__dirname, '../../public/test-files', filename);

    try {
      const buffer = readFileSync(filepath);
      return new Response(buffer, {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'application/octet-stream',
        }),
      });
    } catch (error) {
      return new Response(null, {
        status: 404,
        statusText: 'Not Found',
      });
    }
  }

  // Fall back to original fetch for other requests
  return originalFetch(input, init);
};

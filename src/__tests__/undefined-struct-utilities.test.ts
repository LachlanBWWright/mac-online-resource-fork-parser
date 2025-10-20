import { describe, it, expect } from 'vitest';

// Mock the functions from UndefinedStructEditor
function bytesToHex(bytes: Uint8Array, maxLength = 64): string {
  const hex = Array.from(bytes.slice(0, maxLength))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  return bytes.length > maxLength ? hex + " ..." : hex;
}

function bytesToAscii(bytes: Uint8Array, maxLength = 64): string {
  const ascii = Array.from(bytes.slice(0, maxLength))
    .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
    .join("");
  return bytes.length > maxLength ? ascii + " ..." : ascii;
}

function getPossibleDivisors(size: number): number[] {
  const divisors: number[] = [];
  const commonSizes = [1, 2, 4, 8, 12, 16, 20, 24, 32, 48, 64, 128, 256];
  
  for (const div of commonSizes) {
    if (size % div === 0 && size / div > 0) {
      divisors.push(div);
    }
  }
  
  // Add the size itself if it's reasonable
  if (size <= 1024 && !divisors.includes(size)) {
    divisors.push(size);
  }
  
  return divisors.sort((a, b) => a - b);
}

describe('UndefinedStructEditor Utilities', () => {
  describe('bytesToHex', () => {
    it('should convert bytes to hex string with spaces', () => {
      const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      expect(bytesToHex(bytes)).toBe('48 65 6c 6c 6f');
    });

    it('should truncate long byte arrays and add ellipsis', () => {
      const bytes = new Uint8Array(100).fill(0xff);
      const result = bytesToHex(bytes, 5);
      expect(bytesToHex(result)).toBe('ff ff ff ff ff ...');
    });

    it('should handle empty byte array', () => {
      const bytes = new Uint8Array([]);
      expect(bytesToHex(bytes)).toBe('');
    });

    it('should pad single digit hex values with zero', () => {
      const bytes = new Uint8Array([0x01, 0x02, 0x0a, 0x0f]);
      expect(bytesToHex(bytes)).toBe('01 02 0a 0f');
    });
  });

  describe('bytesToAscii', () => {
    it('should convert printable ASCII to string', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      expect(bytesToAscii(bytes)).toBe('Hello');
    });

    it('should replace non-printable characters with dots', () => {
      const bytes = new Uint8Array([72, 0, 101, 255, 108]); // "H.e.l"
      expect(bytesToAscii(bytes)).toBe('H.e.l');
    });

    it('should handle spaces and special characters', () => {
      const bytes = new Uint8Array([32, 33, 64, 126]); // " !@~"
      expect(bytesToAscii(bytes)).toBe(' !@~');
    });

    it('should truncate long arrays', () => {
      const bytes = new Uint8Array(100).fill(65); // 100 'A's
      const result = bytesToAscii(bytes, 10);
      expect(result).toBe('AAAAAAAAAA ...');
    });

    it('should handle control characters', () => {
      const bytes = new Uint8Array([0, 1, 2, 31, 127]); // all non-printable
      expect(bytesToAscii(bytes)).toBe('.....');
    });
  });

  describe('getPossibleDivisors', () => {
    it('should find divisors for power of 2', () => {
      const divisors = getPossibleDivisors(64);
      expect(divisors).toContain(1);
      expect(divisors).toContain(2);
      expect(divisors).toContain(4);
      expect(divisors).toContain(8);
      expect(divisors).toContain(16);
      expect(divisors).toContain(32);
      expect(divisors).toContain(64);
    });

    it('should find divisors for 120', () => {
      const divisors = getPossibleDivisors(120);
      expect(divisors).toContain(1);
      expect(divisors).toContain(2);
      expect(divisors).toContain(4);
      expect(divisors).toContain(8);
      expect(divisors).toContain(12);
      expect(divisors).toContain(20);
      expect(divisors).toContain(24);
    });

    it('should return sorted divisors', () => {
      const divisors = getPossibleDivisors(96);
      expect(divisors).toEqual([...divisors].sort((a, b) => a - b));
    });

    it('should include size if under 1024', () => {
      const divisors = getPossibleDivisors(100);
      expect(divisors).toContain(100);
    });

    it('should not include size if over 1024', () => {
      const divisors = getPossibleDivisors(2048);
      expect(divisors).not.toContain(2048);
    });

    it('should handle prime numbers', () => {
      const divisors = getPossibleDivisors(17);
      expect(divisors).toContain(1);
      expect(divisors).toContain(17);
      expect(divisors.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle 1', () => {
      const divisors = getPossibleDivisors(1);
      expect(divisors).toContain(1);
    });
  });
});

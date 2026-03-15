import { describe, it, expect } from 'vitest';
import { saveToJson, loadBytesFromJsonAsync, load } from '@lachlanbwwright/rsrcdump-ts';
import type { FourLetterCodeSpec } from '../components/resource-fork-parser/types';

// Otto Matic terrain file specifications
const OTTO_TERRAIN_SPECS = [
  "Hedr:Liiiiifffiiiii40x:version,numItems,mapWidth,mapHeight,numTilePages,numTiles,tileSize,minY,maxY,numSplines,numFences,numUniqueSupertiles,numWaterPatches,numCheckpoints",
  "alis:422s+:alias_data",
  "Atrb:HBB+:flags,p0,p1",
  "STgd:x?H+:isEmpty,superTileId",
  "Layr:H+:TileAttributeIndex",
  "YCrd:f+:height",
  "ItCo:450i+:color_data",
  "Itms:LLHBBBBH+:x,z,type,p0,p1,p2,p3,flags",
  "Spln:h2x4xi4xh2x4xhhhh+:numNubs,numPoints,numItems,bbTop,bbLeft,bbBottom,bbRight",
  "SpNb:ff+:x,z",
  "SpPt:ff+:x,z",
  "SpIt:fHBBBBH+:placement,type,p0,p1,p2,p3,flags",
  "Fenc:HhLhhhh+:fenceType,numNubs,junkNubListPtr,bbTop,bbLeft,bbBottom,bbRight",
  "FnNb:ii+:x,z",
  "Liqd:HxxIihxxi200fffhhhh+:type,flags,height,numNubs,reserved,x`y[100],hotSpotX,hotSpotZ,bBoxTop,bBoxLeft,bBoxBottom,bBoxRight"
];

// Convert spec strings to the format expected by rsrcdump-ts
function specStringsToSpecs(specStrings: string[]): string[] {
  return specStrings.map(line => {
    const parts = line.split(':');
    const fourCC = parts[0];
    const structSpec = parts[1];
    return `${fourCC}:${structSpec}`;
  });
}

describe('Data Roundtrip Accuracy Tests', () => {
  describe('Parse → JSON → Parse Roundtrip', () => {
    it('should maintain data integrity through JSON roundtrip with specs', async () => {
      // Load the test file
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      expect(response.ok).toBe(true);

      const arrayBuffer = await response.arrayBuffer();
      const originalData = new Uint8Array(arrayBuffer);

      const specs = specStringsToSpecs(OTTO_TERRAIN_SPECS);

      // First parse: binary → JSON
      const jsonResult1 = await saveToJson(originalData, specs);
      expect((jsonResult1 as { value?: string }).value).toBeDefined();

      const json1 = (jsonResult1 as { value: string }).value;
      const parsed1 = JSON.parse(json1);

      // Second parse: binary → JSON again (should be identical)
      const jsonResult2 = await saveToJson(originalData, specs);
      expect((jsonResult2 as { value?: string }).value).toBeDefined();

      const json2 = (jsonResult2 as { value: string }).value;
      const parsed2 = JSON.parse(json2);

      // Both JSON representations should be identical
      expect(json1).toBe(json2);
      expect(parsed1).toEqual(parsed2);
    });

    it('should parse all resources without errors', async () => {
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      expect(response.ok).toBe(true);

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      const specs = specStringsToSpecs(OTTO_TERRAIN_SPECS);
      const jsonResult = await saveToJson(data, specs);

      expect((jsonResult as { value?: string }).value).toBeDefined();

      const parsed = JSON.parse((jsonResult as { value: string }).value);

      // Check that all expected four-letter codes are present
      const expectedCodes = ['Hedr', 'Atrb', 'STgd', 'Layr', 'YCrd', 'Itms', 'Spln', 'SpNb', 'SpPt', 'Fenc', 'FnNb'];

      for (const code of expectedCodes) {
        expect(parsed[code]).toBeDefined();
        expect(typeof parsed[code]).toBe('object');
      }
    });
  });

  describe('Parse → Pack → Parse Roundtrip', () => {
    it('should maintain binary data integrity through pack/unpack cycle', async () => {
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      expect(response.ok).toBe(true);

      const arrayBuffer = await response.arrayBuffer();
      const originalData = new Uint8Array(arrayBuffer);

      const specs = specStringsToSpecs(OTTO_TERRAIN_SPECS);

      // Parse to JSON
      const jsonResult = await saveToJson(originalData, specs);
      expect((jsonResult as { value?: string }).value).toBeDefined();
      const jsonString = (jsonResult as { value: string }).value;

      // Pack back to binary
      const packedResult = await loadBytesFromJsonAsync(jsonString, specs);

      // Check if packing succeeded
      if ((packedResult as { error?: string }).error) {
        console.error('Pack error:', (packedResult as { error: string }).error);
        throw new Error((packedResult as { error: string }).error);
      }

      expect((packedResult as { value?: Uint8Array }).value).toBeDefined();
      const packedData = (packedResult as { value: Uint8Array }).value;

      // Parse the packed data again
      const jsonResult2 = await saveToJson(packedData, specs);
      expect((jsonResult2 as { value?: string }).value).toBeDefined();
      const jsonString2 = (jsonResult2 as { value: string }).value;

      // The JSON should be identical after roundtrip
      const parsed1 = JSON.parse(jsonString);
      const parsed2 = JSON.parse(jsonString2);

      expect(parsed1).toEqual(parsed2);
    });

    it('should preserve resource counts through roundtrip', async () => {
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      expect(response.ok).toBe(true);

      const arrayBuffer = await response.arrayBuffer();
      const originalData = new Uint8Array(arrayBuffer);

      const specs = specStringsToSpecs(OTTO_TERRAIN_SPECS);

      // Parse to JSON
      const jsonResult1 = await saveToJson(originalData, specs);
      const json1 = JSON.parse((jsonResult1 as { value: string }).value);

      // Pack and reparse
      const packedResult = await loadBytesFromJsonAsync((jsonResult1 as { value: string }).value, specs);

      // Check if packing succeeded
      if ((packedResult as { error?: string }).error) {
        console.error('Pack error:', (packedResult as { error: string }).error);
        throw new Error((packedResult as { error: string }).error);
      }

      const packedData = (packedResult as { value: Uint8Array }).value;

      const jsonResult2 = await saveToJson(packedData, specs);
      const json2 = JSON.parse((jsonResult2 as { value: string }).value);

      // Count resources in each four-letter code
      for (const fourCC of Object.keys(json1)) {
        if (fourCC.length === 4) {
          const resources1 = json1[fourCC];
          const resources2 = json2[fourCC];

          expect(Object.keys(resources1).length).toBe(Object.keys(resources2).length);
        }
      }
    });
  });

  describe('Multiple File Format Tests', () => {
    const testFiles = [
      'EarthFarm.ter.rsrc',
      // Additional test files can be added here when available
    ];

    testFiles.forEach(filename => {
      it(`should parse ${filename} without errors`, async () => {
        const response = await fetch(`/test-files/${filename}`);
        expect(response.ok).toBe(true);

        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        const specs = specStringsToSpecs(OTTO_TERRAIN_SPECS);
        const jsonResult = await saveToJson(data, specs);

        expect((jsonResult as { value?: string }).value).toBeDefined();

        const parsed = JSON.parse((jsonResult as { value: string }).value);
        expect(typeof parsed).toBe('object');
        expect(Object.keys(parsed).length).toBeGreaterThan(0);
      });

      it(`should complete full roundtrip for ${filename}`, async () => {
        const response = await fetch(`/test-files/${filename}`);
        expect(response.ok).toBe(true);

        const arrayBuffer = await response.arrayBuffer();
        const originalData = new Uint8Array(arrayBuffer);

        const specs = specStringsToSpecs(OTTO_TERRAIN_SPECS);

        // Parse → Pack → Parse
        const json1Result = await saveToJson(originalData, specs);
        const json1 = (json1Result as { value: string }).value;

        const packedResult = await loadBytesFromJsonAsync(json1, specs);

        // Check if packing succeeded
        if ((packedResult as { error?: string }).error) {
          console.error('Pack error:', (packedResult as { error: string }).error);
          throw new Error((packedResult as { error: string }).error);
        }

        expect((packedResult as { value?: Uint8Array }).value).toBeDefined();
        const packed = (packedResult as { value: Uint8Array }).value;

        const json2Result = await saveToJson(packed, specs);
        const json2 = (json2Result as { value: string }).value;

        // Compare parsed data
        const parsed1 = JSON.parse(json1);
        const parsed2 = JSON.parse(json2);

        expect(parsed1).toEqual(parsed2);
      });
    });
  });

  describe('Data Modification and Re-packing', () => {
    it('should correctly repack data after modification', async () => {
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      expect(response.ok).toBe(true);

      const arrayBuffer = await response.arrayBuffer();
      const originalData = new Uint8Array(arrayBuffer);

      const specs = specStringsToSpecs(OTTO_TERRAIN_SPECS);

      // Parse to JSON
      const jsonResult = await saveToJson(originalData, specs);
      const parsed = JSON.parse((jsonResult as { value: string }).value);

      // Modify some data (if Hedr exists with version field)
      if (parsed.Hedr && parsed.Hedr['128'] && parsed.Hedr['128'].obj) {
        const originalVersion = parsed.Hedr['128'].obj.version;
        parsed.Hedr['128'].obj.version = 999;

        // Repack
        const modifiedJson = JSON.stringify(parsed);
        const packedResult = await loadBytesFromJsonAsync(modifiedJson, specs);
        const packed = (packedResult as { value: Uint8Array }).value;

        // Parse again
        const reparsedResult = await saveToJson(packed, specs);
        const reparsed = JSON.parse((reparsedResult as { value: string }).value);

        // Version should be modified
        expect(reparsed.Hedr['128'].obj.version).toBe(999);
        expect(reparsed.Hedr['128'].obj.version).not.toBe(originalVersion);
      }
    });
  });

  describe('Empty and Edge Cases', () => {
    it('should handle parsing with empty specs array', async () => {
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      expect(response.ok).toBe(true);

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // Parse with no specs - should still work but return raw hex data
      const jsonResult = await saveToJson(data, []);
      expect((jsonResult as { value?: string }).value).toBeDefined();

      const parsed = JSON.parse((jsonResult as { value: string }).value);
      expect(typeof parsed).toBe('object');
    });
  });
});

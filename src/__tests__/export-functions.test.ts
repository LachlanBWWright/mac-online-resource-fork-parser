import { describe, it, expect } from 'vitest';
import { saveToJson, loadBytesFromJsonAsync } from '@lachlanbwwright/rsrcdump-ts';
import { generateTypeScriptInterfacesFromSpecs } from '../components/resource-fork-parser/TypeScriptGenerator';
import type { FourLetterCodeSpec, DataTypeField } from '../components/resource-fork-parser/types';

const OTTO_TERRAIN_SPECS = [
  "Hedr:Liiiiifffiiiii40x:version,numItems,mapWidth,mapHeight,numTilePages,numTiles,tileSize,minY,maxY,numSplines,numFences,numUniqueSupertiles,numWaterPatches,numCheckpoints",
  "Atrb:HBB+:flags,p0,p1",
  "STgd:x?H+:isEmpty,superTileId",
];

function parseSpecString(specStr: string, nameTokens: string[]): DataTypeField[] {
  const dataTypes: DataTypeField[] = [];
  let currentIndex = 0;
  let fieldIndex = 1;
  let nameIndex = 0;

  while (currentIndex < specStr.length) {
    if (specStr[currentIndex] === ' ') {
      currentIndex++;
      continue;
    }

    const countTypeMatch = specStr.slice(currentIndex).match(/^(\d+)([A-Za-z?])/);
    if (countTypeMatch) {
      const count = parseInt(countTypeMatch[1]);
      const type = countTypeMatch[2] as any;
      currentIndex += countTypeMatch[0].length;

      if (type === 'x') {
        dataTypes.push({
          id: fieldIndex.toString(),
          type: 'x',
          count: count,
          description: '',
          isPadding: true,
        });
        fieldIndex++;
        continue;
      }

      const currentName = nameTokens[nameIndex];
      const arrayPatternMatch = currentName ? currentName.match(/^([a-zA-Z_]+(?:`[a-zA-Z_]+)*)\[(\d+)\]$/) : null;

      if (arrayPatternMatch) {
        const fieldNames = arrayPatternMatch[1].split('`');
        const arraySize = parseInt(arrayPatternMatch[2]);

        dataTypes.push({
          id: fieldIndex.toString(),
          type: type,
          count: count,
          description: currentName,
          isArrayField: true,
          arraySize: arraySize,
          arrayFields: fieldNames.map(name => ({ name: name.trim(), type: type })),
        });

        nameIndex++;
        fieldIndex++;
        continue;
      }

      const remainingNames = nameTokens.length - nameIndex;

      if (remainingNames >= count) {
        for (let j = 0; j < count; j++) {
          dataTypes.push({
            id: (fieldIndex + j).toString(),
            type: type,
            count: 1,
            description: nameTokens[nameIndex + j] || `field_${fieldIndex + j}`,
          });
        }
        nameIndex += count;
        fieldIndex += count;
      } else {
        dataTypes.push({
          id: fieldIndex.toString(),
          type: type,
          count: count,
          description: nameTokens[nameIndex] || `field_${fieldIndex}`,
        });
        nameIndex++;
        fieldIndex++;
      }
      continue;
    }

    const singleTypeMatch = specStr.slice(currentIndex).match(/^([A-Za-z?])/);
    if (singleTypeMatch) {
      const type = singleTypeMatch[1] as any;
      currentIndex += singleTypeMatch[0].length;

      if (type === 'x') {
        dataTypes.push({
          id: fieldIndex.toString(),
          type: 'x',
          count: 1,
          description: '',
          isPadding: true,
        });
        fieldIndex++;
        continue;
      }

      dataTypes.push({
        id: fieldIndex.toString(),
        type: type,
        count: 1,
        description: nameTokens[nameIndex] || `field_${fieldIndex}`,
      });
      nameIndex++;
      fieldIndex++;
      continue;
    }

    currentIndex++;
  }

  return dataTypes.length > 0 ? dataTypes : [{
    id: "1",
    type: "i",
    count: 1,
    description: "field_1",
  }];
}

function parseOttoSpecToFourLetterCodeSpec(specLine: string): FourLetterCodeSpec {
  const parts = specLine.split(":");
  const fourCC = parts[0];
  const structSpec = parts[1];
  const namesPart = parts.slice(2).join(":");
  const nameTokens = namesPart ? namesPart.split(",").map(s => s.trim()) : [];
  const isArray = structSpec.endsWith("+");
  const specStr = isArray ? structSpec.slice(0, -1) : structSpec;

  const dataTypes = parseSpecString(specStr, nameTokens);

  return {
    fourCC,
    dataTypes,
    isArray,
    status: "valid",
  };
}

describe('Export Functions Tests', () => {
  describe('Export to JSON', () => {
    it('should export valid JSON with proper structure', async () => {
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      expect(response.ok).toBe(true);

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      const specs = OTTO_TERRAIN_SPECS.map(line => {
        const parts = line.split(':');
        return `${parts[0]}:${parts[1]}`;
      });

      const jsonResult = await saveToJson(data, specs);
      expect((jsonResult as { value?: string }).value).toBeDefined();

      const jsonString = (jsonResult as { value: string }).value;

      // Should be valid JSON
      expect(() => JSON.parse(jsonString)).not.toThrow();

      const parsed = JSON.parse(jsonString);
      expect(typeof parsed).toBe('object');
      expect(parsed).not.toBeNull();
    });

    it('should export JSON with all expected properties', async () => {
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      expect(response.ok).toBe(true);

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      const specs = OTTO_TERRAIN_SPECS.map(line => {
        const parts = line.split(':');
        return `${parts[0]}:${parts[1]}`;
      });

      const jsonResult = await saveToJson(data, specs);
      const parsed = JSON.parse((jsonResult as { value: string }).value);

      // Check structure: each four-letter code should contain resources
      for (const key of Object.keys(parsed)) {
        if (key.length === 4) {
          expect(typeof parsed[key]).toBe('object');

          // Each resource should have either obj or data property
          for (const resourceId of Object.keys(parsed[key])) {
            const resource = parsed[key][resourceId];
            const hasObj = 'obj' in resource;
            const hasData = 'data' in resource;
            expect(hasObj || hasData).toBe(true);
          }
        }
      }
    });

    it('should create JSON that can be stringified and re-parsed', async () => {
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      expect(response.ok).toBe(true);

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      const specs = OTTO_TERRAIN_SPECS.map(line => {
        const parts = line.split(':');
        return `${parts[0]}:${parts[1]}`;
      });

      const jsonResult = await saveToJson(data, specs);
      const parsed1 = JSON.parse((jsonResult as { value: string }).value);

      // Re-stringify and re-parse
      const stringified = JSON.stringify(parsed1);
      const parsed2 = JSON.parse(stringified);

      expect(parsed1).toEqual(parsed2);
    });
  });

  describe('Pack to RSRC', () => {
    it('should pack JSON data back to RSRC format', async () => {
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      expect(response.ok).toBe(true);

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      const specs = OTTO_TERRAIN_SPECS.map(line => {
        const parts = line.split(':');
        return `${parts[0]}:${parts[1]}`;
      });

      // Parse to JSON
      const jsonResult = await saveToJson(data, specs);
      const jsonString = (jsonResult as { value: string }).value;

      // Pack back to binary
      const packedResult = await loadBytesFromJsonAsync(jsonString, specs);

      // Check if packing succeeded
      if ((packedResult as { error?: string }).error) {
        console.error('Pack error:', (packedResult as { error: string }).error);
        throw new Error((packedResult as { error: string }).error);
      }

      expect((packedResult as { value?: Uint8Array }).value).toBeDefined();

      const packed = (packedResult as { value: Uint8Array }).value;
      expect(packed).toBeInstanceOf(Uint8Array);
      expect(packed.length).toBeGreaterThan(0);
    });

    it('should produce binary data that can be re-parsed', async () => {
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      expect(response.ok).toBe(true);

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      const specs = OTTO_TERRAIN_SPECS.map(line => {
        const parts = line.split(':');
        return `${parts[0]}:${parts[1]}`;
      });

      // Parse → Pack → Parse
      const json1Result = await saveToJson(data, specs);
      const json1 = (json1Result as { value: string }).value;

      const packedResult = await loadBytesFromJsonAsync(json1, specs);

      // Check if packing succeeded
      if ((packedResult as { error?: string }).error) {
        console.error('Pack error:', (packedResult as { error: string }).error);
        throw new Error((packedResult as { error: string }).error);
      }

      const packed = (packedResult as { value: Uint8Array }).value;

      const json2Result = await saveToJson(packed, specs);
      expect((json2Result as { value?: string }).value).toBeDefined();
    });
  });

  describe('TypeScript Interface Generation', () => {
    it('should generate valid TypeScript code', () => {
      const specs = OTTO_TERRAIN_SPECS.map(parseOttoSpecToFourLetterCodeSpec);

      const tsCode = generateTypeScriptInterfacesFromSpecs(specs);

      // Should contain interface declarations
      expect(tsCode).toContain('interface');
      expect(tsCode).toContain('export');

      // Should define ResourceData base interface
      expect(tsCode).toContain('interface ResourceData');
    });

    it('should generate interfaces for each four-letter code', () => {
      const specs = OTTO_TERRAIN_SPECS.map(parseOttoSpecToFourLetterCodeSpec);

      const tsCode = generateTypeScriptInterfacesFromSpecs(specs);

      // Should have interfaces for each four-letter code
      expect(tsCode).toContain('HedrData');
      expect(tsCode).toContain('AtrbData');
      expect(tsCode).toContain('STgdData');
    });

    it('should include field names in generated interfaces', () => {
      const specs = OTTO_TERRAIN_SPECS.map(parseOttoSpecToFourLetterCodeSpec);

      const tsCode = generateTypeScriptInterfacesFromSpecs(specs);

      // Hedr fields
      expect(tsCode).toContain('version');
      expect(tsCode).toContain('numItems');
      expect(tsCode).toContain('mapWidth');

      // Atrb fields
      expect(tsCode).toContain('flags');
    });

    it('should map data types to TypeScript types correctly', () => {
      const specs = OTTO_TERRAIN_SPECS.map(parseOttoSpecToFourLetterCodeSpec);

      const tsCode = generateTypeScriptInterfacesFromSpecs(specs);

      // Should use number for numeric types
      expect(tsCode).toContain('number');

      // Should use boolean for boolean type
      expect(tsCode).toContain('boolean');
    });

    it('should handle array specs correctly', () => {
      const specs = OTTO_TERRAIN_SPECS.map(parseOttoSpecToFourLetterCodeSpec);

      const tsCode = generateTypeScriptInterfacesFromSpecs(specs);

      // Array types should be generated for specs with isArray=true
      // Atrb and STgd have the + suffix indicating arrays
      const atrbSpec = specs.find(s => s.fourCC === 'Atrb');
      expect(atrbSpec?.isArray).toBe(true);
    });
  });

  describe('Convert JSON to RSRC', () => {
    it('should convert exported JSON back to RSRC', async () => {
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      expect(response.ok).toBe(true);

      const arrayBuffer = await response.arrayBuffer();
      const originalData = new Uint8Array(arrayBuffer);

      const specs = OTTO_TERRAIN_SPECS.map(line => {
        const parts = line.split(':');
        return `${parts[0]}:${parts[1]}`;
      });

      // Export to JSON (simulating download)
      const jsonResult = await saveToJson(originalData, specs);
      const exportedJson = (jsonResult as { value: string }).value;

      // Convert back (simulating JSON upload and conversion)
      const convertedResult = await loadBytesFromJsonAsync(exportedJson, specs);

      // Check if conversion succeeded
      if ((convertedResult as { error?: string }).error) {
        console.error('Convert error:', (convertedResult as { error: string }).error);
        throw new Error((convertedResult as { error: string }).error);
      }

      expect((convertedResult as { value?: Uint8Array }).value).toBeDefined();

      const converted = (convertedResult as { value: Uint8Array }).value;
      expect(converted).toBeInstanceOf(Uint8Array);
      expect(converted.length).toBeGreaterThan(0);
    });

    it('should preserve data through JSON export/import cycle', async () => {
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      expect(response.ok).toBe(true);

      const arrayBuffer = await response.arrayBuffer();
      const originalData = new Uint8Array(arrayBuffer);

      const specs = OTTO_TERRAIN_SPECS.map(line => {
        const parts = line.split(':');
        return `${parts[0]}:${parts[1]}`;
      });

      // Original parse
      const json1Result = await saveToJson(originalData, specs);
      const json1 = (json1Result as { value: string }).value;
      const parsed1 = JSON.parse(json1);

      // Export → Import → Parse
      const exportedJson = json1; // Simulated file save/load
      const importedResult = await loadBytesFromJsonAsync(exportedJson, specs);

      // Check if import succeeded
      if ((importedResult as { error?: string }).error) {
        console.error('Import error:', (importedResult as { error: string }).error);
        throw new Error((importedResult as { error: string }).error);
      }

      const imported = (importedResult as { value: Uint8Array }).value;

      const json2Result = await saveToJson(imported, specs);
      const json2 = (json2Result as { value: string }).value;
      const parsed2 = JSON.parse(json2);

      // Data should be identical
      expect(parsed1).toEqual(parsed2);
    });
  });

  describe('Save Specifications', () => {
    it('should generate spec text in correct format', () => {
      const specs = OTTO_TERRAIN_SPECS.map(parseOttoSpecToFourLetterCodeSpec);

      // Generate spec strings (simulating save)
      const specLines = specs.map(spec => {
        const fourCC = spec.fourCC;

        // Rebuild struct spec
        let structSpec = '';
        for (const dt of spec.dataTypes) {
          if (dt.isPadding) {
            structSpec += dt.count > 1 ? `${dt.count}x` : 'x';
          } else if (dt.count > 1) {
            structSpec += `${dt.count}${dt.type}`;
          } else {
            structSpec += dt.type;
          }
        }
        if (spec.isArray) structSpec += '+';

        // Rebuild field names
        const fieldNames = spec.dataTypes
          .filter(dt => !dt.isPadding)
          .map(dt => dt.description)
          .join(',');

        return `${fourCC}:${structSpec}:${fieldNames}`;
      });

      // Check format
      for (const line of specLines) {
        expect(line).toMatch(/^[A-Za-z0-9]{4}:[^:]+:.+$/);
      }
    });

    it('should preserve spec data through save/load cycle', () => {
      const originalSpecs = OTTO_TERRAIN_SPECS;
      const parsedSpecs = originalSpecs.map(parseOttoSpecToFourLetterCodeSpec);

      // Regenerate spec strings
      const regeneratedSpecs = parsedSpecs.map(spec => {
        let structSpec = '';
        for (const dt of spec.dataTypes) {
          if (dt.isPadding) {
            structSpec += dt.count > 1 ? `${dt.count}x` : 'x';
          } else if (dt.count > 1) {
            structSpec += `${dt.count}${dt.type}`;
          } else {
            structSpec += dt.type;
          }
        }
        if (spec.isArray) structSpec += '+';

        const fieldNames = spec.dataTypes
          .filter(dt => !dt.isPadding)
          .map(dt => dt.description)
          .join(',');

        return `${spec.fourCC}:${structSpec}:${fieldNames}`;
      });

      // Parse again
      const reparsedSpecs = regeneratedSpecs.map(parseOttoSpecToFourLetterCodeSpec);

      // Should be equivalent
      expect(reparsedSpecs.length).toBe(parsedSpecs.length);

      for (let i = 0; i < parsedSpecs.length; i++) {
        expect(reparsedSpecs[i].fourCC).toBe(parsedSpecs[i].fourCC);
        expect(reparsedSpecs[i].isArray).toBe(parsedSpecs[i].isArray);
        expect(reparsedSpecs[i].dataTypes.length).toBe(parsedSpecs[i].dataTypes.length);
      }
    });
  });
});

import { describe, it, expect } from 'vitest';
import type { DataTypeField, FourLetterCodeSpec, StructDataType } from '../components/resource-fork-parser/types';

// parseSpecString implementation - same as in ResourceForkParser.tsx
// According to Python struct: ? = boolean (1 byte), x = padding (no field name)
function parseSpecString(specStr: string, nameTokens: string[]): DataTypeField[] {
  const dataTypes: DataTypeField[] = [];
  let currentIndex = 0;
  let fieldIndex = 1;
  let nameIndex = 0;

  while (currentIndex < specStr.length) {
    // Skip spaces
    if (specStr[currentIndex] === ' ') {
      currentIndex++;
      continue;
    }

    // Check for count+type pattern (e.g., "5i", "40x", "422B", "200f")
    const countTypeMatch = specStr.slice(currentIndex).match(/^(\d+)([A-Za-z?])/);
    if (countTypeMatch) {
      const count = parseInt(countTypeMatch[1]);
      const type = countTypeMatch[2] as StructDataType;
      currentIndex += countTypeMatch[0].length;

      if (type === 'x') {
        // Padding bytes - no name (description should be empty)
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
        // Expand to individual fields, one per name (count=1 each)
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

    // Single character type (e.g., "L", "H", "f", "h", "I", "?", "x")
    const singleTypeMatch = specStr.slice(currentIndex).match(/^([A-Za-z?])/);
    if (singleTypeMatch) {
      const type = singleTypeMatch[1] as StructDataType;
      currentIndex += singleTypeMatch[0].length;

      if (type === 'x') {
        // Single padding byte - no name
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

      // Regular type (including ? for boolean) gets a name
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

// generateStructSpec implementation - same as in ResourceForkParser.tsx
function generateStructSpec(spec: FourLetterCodeSpec): string {
  let result = "";
  for (const dataType of spec.dataTypes) {
    if (dataType.isPadding) {
      // Padding: x, 2x, 40x
      if (dataType.count > 1) {
        result += `${dataType.count}x`;
      } else {
        result += "x";
      }
    } else if (dataType.isArrayField && dataType.arraySize && dataType.arrayFields) {
      result += `${dataType.count}${dataType.type}`;
    } else if (dataType.count > 1) {
      result += `${dataType.count}${dataType.type}`;
    } else {
      result += dataType.type;
    }
  }
  return result + (spec.isArray ? "+" : "");
}

function generateDescriptions(dataTypes: DataTypeField[]): string {
  return dataTypes
    .filter(dt => !dt.isPadding)
    .map(dt => dt.description)
    .join(',');
}

function parseAndRoundtrip(specLine: string): string {
  const parts = specLine.split(":");
  const fourCC = parts[0];
  const structSpec = parts[1];
  const namesPart = parts.slice(2).join(":");
  const nameTokens = namesPart ? namesPart.split(",").map(s => s.trim()) : [];
  const isArray = structSpec.endsWith("+");
  const specStr = isArray ? structSpec.slice(0, -1) : structSpec;
  
  const dataTypes = parseSpecString(specStr, nameTokens);
  
  const spec: FourLetterCodeSpec = {
    fourCC,
    dataTypes,
    isArray,
    status: "valid",
  };
  
  const regenerated = generateStructSpec(spec);
  const regeneratedNames = generateDescriptions(dataTypes);
  
  return `${fourCC}:${regenerated}:${regeneratedNames}`;
}

describe('Spec Roundtrip', () => {
  // These specs match the otto-specs.txt file exactly (without numbered prefixes)
  // These are the specs as they appear after parsing and regenerating (roundtrip-stable form).
  // For specs like Hedr that have count+type patterns (e.g. 5i) with enough names, 
  // they are expanded to individual fields, so the roundtripped form differs from the original.
  const ottomaticSpecs = [
    // Hedr: 5i and 3f and 5i with enough names → expanded to individual i/f fields
    // Roundtrip form: Liiiiifffiiiii40x
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

  // Original otto specs before the roundtrip normalization
  const originalOttomaticSpecs = [
    "Hedr:L5i3f5i40x:version,numItems,mapWidth,mapHeight,numTilePages,numTiles,tileSize,minY,maxY,numSplines,numFences,numUniqueSupertiles,numWaterPatches,numCheckpoints",
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

  it('all stable-form specs roundtrip exactly', () => {
    for (const spec of ottomaticSpecs) {
      const result = parseAndRoundtrip(spec);
      expect(result).toBe(spec);
    }
  });

  it('original otto spec Hedr roundtrips to expanded individual-field form', () => {
    const original = "Hedr:L5i3f5i40x:version,numItems,mapWidth,mapHeight,numTilePages,numTiles,tileSize,minY,maxY,numSplines,numFences,numUniqueSupertiles,numWaterPatches,numCheckpoints";
    const expected = "Hedr:Liiiiifffiiiii40x:version,numItems,mapWidth,mapHeight,numTilePages,numTiles,tileSize,minY,maxY,numSplines,numFences,numUniqueSupertiles,numWaterPatches,numCheckpoints";
    const result = parseAndRoundtrip(original);
    expect(result).toBe(expected);
  });

  it('all non-Hedr original specs roundtrip exactly', () => {
    for (const spec of originalOttomaticSpecs.filter(s => !s.startsWith('Hedr'))) {
      const result = parseAndRoundtrip(spec);
      expect(result).toBe(spec);
    }
  });

  ottomaticSpecs.forEach((spec) => {
    const fourCC = spec.split(':')[0];
    it(`stable-form ${fourCC} roundtrips correctly`, () => {
      const result = parseAndRoundtrip(spec);
      expect(result).toBe(spec);
    });
  });

  it('parses Hedr with correct field count - each named field is its own entry', () => {
    const specLine = "Hedr:L5i3f5i40x:version,numItems,mapWidth,mapHeight,numTilePages,numTiles,tileSize,minY,maxY,numSplines,numFences,numUniqueSupertiles,numWaterPatches,numCheckpoints";
    const parts = specLine.split(":");
    const structSpec = parts[1];
    const namesPart = parts.slice(2).join(":");
    const nameTokens = namesPart.split(",").map(s => s.trim());
    const isArray = structSpec.endsWith("+");
    const specStr = isArray ? structSpec.slice(0, -1) : structSpec;
    
    const dataTypes = parseSpecString(specStr, nameTokens);
    
    // With the new behavior: 5i with 5 names → 5 individual fields (each count=1)
    // Should have: 1 (L:version) + 5 (5×i) + 3 (3×f) + 5 (5×i) + 1 (40x padding) = 15 fields
    expect(dataTypes.length).toBe(15);
    
    // First field: L with version
    expect(dataTypes[0].type).toBe('L');
    expect(dataTypes[0].count).toBe(1);
    expect(dataTypes[0].description).toBe('version');
    
    // Fields 1-5: 5 individual i fields with separate names
    expect(dataTypes[1].type).toBe('i');
    expect(dataTypes[1].count).toBe(1);
    expect(dataTypes[1].description).toBe('numItems');
    
    expect(dataTypes[2].type).toBe('i');
    expect(dataTypes[2].count).toBe(1);
    expect(dataTypes[2].description).toBe('mapWidth');
    
    expect(dataTypes[3].type).toBe('i');
    expect(dataTypes[3].count).toBe(1);
    expect(dataTypes[3].description).toBe('mapHeight');
    
    expect(dataTypes[4].type).toBe('i');
    expect(dataTypes[4].count).toBe(1);
    expect(dataTypes[4].description).toBe('numTilePages');
    
    expect(dataTypes[5].type).toBe('i');
    expect(dataTypes[5].count).toBe(1);
    expect(dataTypes[5].description).toBe('numTiles');
    
    // Fields 6-8: 3 individual f fields
    expect(dataTypes[6].type).toBe('f');
    expect(dataTypes[6].count).toBe(1);
    expect(dataTypes[6].description).toBe('tileSize');
    
    expect(dataTypes[7].type).toBe('f');
    expect(dataTypes[7].count).toBe(1);
    expect(dataTypes[7].description).toBe('minY');
    
    expect(dataTypes[8].type).toBe('f');
    expect(dataTypes[8].count).toBe(1);
    expect(dataTypes[8].description).toBe('maxY');
    
    // Fields 9-13: 5 individual i fields
    expect(dataTypes[9].type).toBe('i');
    expect(dataTypes[9].count).toBe(1);
    expect(dataTypes[9].description).toBe('numSplines');
    
    // Last non-padding field
    expect(dataTypes[13].type).toBe('i');
    expect(dataTypes[13].count).toBe(1);
    expect(dataTypes[13].description).toBe('numCheckpoints');
    
    // Last field: 40x padding
    expect(dataTypes[14].type).toBe('x');
    expect(dataTypes[14].count).toBe(40);
    expect(dataTypes[14].isPadding).toBe(true);
  });

  it('parses ItCo with single field having count=450', () => {
    const specLine = "ItCo:450i+:color_data";
    const parts = specLine.split(":");
    const structSpec = parts[1];
    const namesPart = parts.slice(2).join(":");
    const nameTokens = namesPart.split(",").map(s => s.trim());
    const isArray = structSpec.endsWith("+");
    const specStr = isArray ? structSpec.slice(0, -1) : structSpec;
    
    const dataTypes = parseSpecString(specStr, nameTokens);
    
    expect(dataTypes.length).toBe(1);
    expect(dataTypes[0].type).toBe('i');
    expect(dataTypes[0].count).toBe(450);
    expect(dataTypes[0].description).toBe('color_data');
    expect(dataTypes[0].isExpandedGroup).toBeUndefined();
  });

  it('parses STgd with padding, boolean, and unsigned short', () => {
    // STgd:x?H+ means: x (padding), ? (boolean), H (unsigned short)
    const specLine = "STgd:x?H+:isEmpty,superTileId";
    const parts = specLine.split(":");
    const structSpec = parts[1];
    const namesPart = parts.slice(2).join(":");
    const nameTokens = namesPart.split(",").map(s => s.trim());
    const isArray = structSpec.endsWith("+");
    const specStr = isArray ? structSpec.slice(0, -1) : structSpec;
    
    const dataTypes = parseSpecString(specStr, nameTokens);
    
    // Should have 3 fields: x (padding), ? (boolean), H (unsigned short)
    expect(dataTypes.length).toBe(3);
    
    // First field: padding (no name)
    expect(dataTypes[0].type).toBe('x');
    expect(dataTypes[0].isPadding).toBe(true);
    expect(dataTypes[0].description).toBe('');
    
    // Second field: ? (boolean) with name "isEmpty"
    expect(dataTypes[1].type).toBe('?');
    expect(dataTypes[1].description).toBe('isEmpty');
    
    // Third field: H with name "superTileId"
    expect(dataTypes[2].type).toBe('H');
    expect(dataTypes[2].description).toBe('superTileId');
  });

  // Multi-round-trip tests to ensure no data loss
  describe('Multi-Round-Trip Tests', () => {
    // Use the stable-form specs (after first-roundtrip normalization)
    const stableSpecs = [
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

    it('stable specs are stable through 10 consecutive roundtrips', () => {
      for (const originalSpec of stableSpecs) {
        let currentSpec = originalSpec;
        
        for (let i = 0; i < 10; i++) {
          const result = parseAndRoundtrip(currentSpec);
          expect(result).toBe(originalSpec);
          currentSpec = result;
        }
      }
    });

    it('parsed data types are identical after multiple roundtrips', () => {
      for (const originalSpec of stableSpecs) {
        // Parse original spec
        const parts1 = originalSpec.split(":");
        const specStr1 = parts1[1].endsWith("+") ? parts1[1].slice(0, -1) : parts1[1];
        const nameTokens1 = parts1.slice(2).join(":").split(",").map(s => s.trim());
        const dataTypes1 = parseSpecString(specStr1, nameTokens1);

        // Roundtrip and parse again
        const roundtripped = parseAndRoundtrip(originalSpec);
        const parts2 = roundtripped.split(":");
        const specStr2 = parts2[1].endsWith("+") ? parts2[1].slice(0, -1) : parts2[1];
        const nameTokens2 = parts2.slice(2).join(":").split(",").map(s => s.trim());
        const dataTypes2 = parseSpecString(specStr2, nameTokens2);

        // Compare data types
        expect(dataTypes1.length).toBe(dataTypes2.length);
        for (let i = 0; i < dataTypes1.length; i++) {
          expect(dataTypes2[i].type).toBe(dataTypes1[i].type);
          expect(dataTypes2[i].count).toBe(dataTypes1[i].count);
          expect(dataTypes2[i].description).toBe(dataTypes1[i].description);
          expect(dataTypes2[i].isPadding).toBe(dataTypes1[i].isPadding);
          expect(dataTypes2[i].isArrayField).toBe(dataTypes1[i].isArrayField);
        }
      }
    });

    it('all stable specs produce consistent output format after roundtrip', () => {
      for (const originalSpec of stableSpecs) {
        const fourCC = originalSpec.split(':')[0];
        
        const round1 = parseAndRoundtrip(originalSpec);
        const round2 = parseAndRoundtrip(round1);
        const round3 = parseAndRoundtrip(round2);
        
        expect(round1).toBe(originalSpec);
        expect(round2).toBe(originalSpec);
        expect(round3).toBe(originalSpec);
        
        if (round1 !== originalSpec || round2 !== originalSpec || round3 !== originalSpec) {
          console.error(`Roundtrip failed for ${fourCC}:`);
          console.error(`Original: ${originalSpec}`);
          console.error(`Round 1:  ${round1}`);
        }
      }
    });
  });
});

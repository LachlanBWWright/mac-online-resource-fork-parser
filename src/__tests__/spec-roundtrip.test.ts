import { describe, it, expect } from 'vitest';
import type { DataTypeField, FourLetterCodeSpec, StructDataType } from '../components/resource-fork-parser/types';

// parseSpecString implementation - same as in ResourceForkParser.tsx
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

    // Check for optional padding marker (x?)
    if (specStr.slice(currentIndex, currentIndex + 2) === 'x?') {
      dataTypes.push({
        id: fieldIndex.toString(),
        type: 'x',
        count: 1,
        description: nameTokens[nameIndex] || '',
        isOptionalPadding: true,
      });
      currentIndex += 2;
      nameIndex++;
      fieldIndex++;
      continue;
    }

    // Check for count+type pattern (e.g., "5i", "40x", "422B", "200f")
    const countTypeMatch = specStr.slice(currentIndex).match(/^(\d+)([A-Za-z])/);
    if (countTypeMatch) {
      const count = parseInt(countTypeMatch[1]);
      const type = countTypeMatch[2] as StructDataType;
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
        const groupNames: string[] = [];
        for (let j = 0; j < count; j++) {
          groupNames.push(nameTokens[nameIndex + j] || `field_${fieldIndex + j}`);
        }
        
        dataTypes.push({
          id: fieldIndex.toString(),
          type: type,
          count: count,
          description: groupNames.join(','),
          isExpandedGroup: true,
        });
        
        nameIndex += count;
        fieldIndex++;
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

    const singleTypeMatch = specStr.slice(currentIndex).match(/^([A-Za-z])(\?)?/);
    if (singleTypeMatch) {
      const type = singleTypeMatch[1] as StructDataType;
      const isOptional = singleTypeMatch[2] === '?';
      currentIndex += singleTypeMatch[0].length;

      if (type === 'x') {
        if (isOptional) {
          dataTypes.push({
            id: fieldIndex.toString(),
            type: 'x',
            count: 1,
            description: nameTokens[nameIndex] || '',
            isOptionalPadding: true,
          });
          nameIndex++;
        } else {
          dataTypes.push({
            id: fieldIndex.toString(),
            type: 'x',
            count: 1,
            description: '',
            isPadding: true,
          });
        }
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

// generateStructSpec implementation - same as in ResourceForkParser.tsx
function generateStructSpec(spec: FourLetterCodeSpec): string {
  let result = "";
  for (const dataType of spec.dataTypes) {
    if (dataType.isOptionalPadding) {
      result += "x?";
    } else if (dataType.isPadding) {
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
  const ottomaticSpecs = [
    "Hedr:L5i3f5i40x:version,numItems,mapWidth,mapHeight,numTilePages,numTiles,tileSize,minY,maxY,numSplines,numFences,numUniqueSupertiles,numWaterPatches,numCheckpoints",
    "alis:422B+:alias_data",
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
    "Liqd:HxxIihxxi200fffhhhh+:type,flags,height,numNubs,reserved,x\`y[100],hotSpotX,hotSpotZ,bBoxTop,bBoxLeft,bBoxBottom,bBoxRight"
  ];

  ottomaticSpecs.forEach((spec) => {
    const fourCC = spec.split(':')[0];
    it(`roundtrips ${fourCC} correctly`, () => {
      const result = parseAndRoundtrip(spec);
      expect(result).toBe(spec);
    });
  });

  it('parses Hedr with correct field count', () => {
    const specLine = "Hedr:L5i3f5i40x:version,numItems,mapWidth,mapHeight,numTilePages,numTiles,tileSize,minY,maxY,numSplines,numFences,numUniqueSupertiles,numWaterPatches,numCheckpoints";
    const parts = specLine.split(":");
    const structSpec = parts[1];
    const namesPart = parts.slice(2).join(":");
    const nameTokens = namesPart.split(",").map(s => s.trim());
    const isArray = structSpec.endsWith("+");
    const specStr = isArray ? structSpec.slice(0, -1) : structSpec;
    
    const dataTypes = parseSpecString(specStr, nameTokens);
    
    // Should have: 1 (L) + 1 (5i group) + 1 (3f group) + 1 (5i group) + 1 (40x padding) = 5 fields
    // But the names are: 14 (version + 5 ints + 3 floats + 5 ints)
    expect(dataTypes.length).toBe(5);
    
    // First field: L with version
    expect(dataTypes[0].type).toBe('L');
    expect(dataTypes[0].count).toBe(1);
    expect(dataTypes[0].description).toBe('version');
    
    // Second field: 5i with 5 names
    expect(dataTypes[1].type).toBe('i');
    expect(dataTypes[1].count).toBe(5);
    expect(dataTypes[1].description).toBe('numItems,mapWidth,mapHeight,numTilePages,numTiles');
    expect(dataTypes[1].isExpandedGroup).toBe(true);
    
    // Third field: 3f with 3 names
    expect(dataTypes[2].type).toBe('f');
    expect(dataTypes[2].count).toBe(3);
    expect(dataTypes[2].description).toBe('tileSize,minY,maxY');
    
    // Fourth field: 5i with 5 names
    expect(dataTypes[3].type).toBe('i');
    expect(dataTypes[3].count).toBe(5);
    expect(dataTypes[3].description).toBe('numSplines,numFences,numUniqueSupertiles,numWaterPatches,numCheckpoints');
    
    // Fifth field: 40x padding
    expect(dataTypes[4].type).toBe('x');
    expect(dataTypes[4].count).toBe(40);
    expect(dataTypes[4].isPadding).toBe(true);
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

  it('parses STgd with optional padding', () => {
    const specLine = "STgd:x?H+:isEmpty,superTileId";
    const parts = specLine.split(":");
    const structSpec = parts[1];
    const namesPart = parts.slice(2).join(":");
    const nameTokens = namesPart.split(",").map(s => s.trim());
    const isArray = structSpec.endsWith("+");
    const specStr = isArray ? structSpec.slice(0, -1) : structSpec;
    
    const dataTypes = parseSpecString(specStr, nameTokens);
    
    expect(dataTypes.length).toBe(2);
    
    // First field: optional padding with name
    expect(dataTypes[0].type).toBe('x');
    expect(dataTypes[0].isOptionalPadding).toBe(true);
    expect(dataTypes[0].description).toBe('isEmpty');
    
    // Second field: H with name
    expect(dataTypes[1].type).toBe('H');
    expect(dataTypes[1].description).toBe('superTileId');
  });
});

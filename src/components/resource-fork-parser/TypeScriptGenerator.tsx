import type { FourLetterCodeSpec, DataTypeField, StructDataType } from "./types";

/**
 * Maps struct data types to TypeScript types
 */
function getTypeScriptTypeFromStructType(type: StructDataType): string {
  switch (type) {
    case "L": // Unsigned Long (4 bytes)
    case "l": // Signed Long (4 bytes)
    case "i": // Signed Int (4 bytes)
    case "h": // Signed Short (2 bytes)
    case "H": // Unsigned Short (2 bytes)
    case "f": // Float (4 bytes)
    case "B": // Unsigned Byte (1 byte)
    case "b": // Signed Byte (1 byte)
      return "number";
    case "s": // String
    case "p": // Pascal String
      return "string";
    case "x": // Padding Byte - typically not included in output
      return "number";
    default:
      return "unknown";
  }
}

/**
 * Checks if a string is a valid JavaScript identifier
 */
function isValidIdentifier(str: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);
}

/**
 * Generates TypeScript field name (handles invalid identifiers)
 */
function getSafeFieldName(name: string): string {
  return isValidIdentifier(name) ? name : `"${name}"`;
}

/**
 * Capitalizes the first letter and lowercases the rest
 */
function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generates TypeScript interface fields from a spec's data types
 */
function generateFieldsFromDataTypes(dataTypes: DataTypeField[], indent: string): string {
  let fields = "";

  for (const dataType of dataTypes) {
    // Skip padding bytes (regular padding without meaning)
    if (dataType.isPadding) {
      continue;
    }

    // Skip padding bytes (x type) without descriptions
    if (dataType.type === "x" && !dataType.description) {
      continue;
    }

    // For expanded groups, generate separate fields for each name
    if (dataType.isExpandedGroup && dataType.description.includes(',')) {
      const names = dataType.description.split(',');
      const tsType = getTypeScriptTypeFromStructType(dataType.type);
      for (const name of names) {
        const fieldName = getSafeFieldName(name.trim());
        fields += `${indent}${fieldName}: ${tsType};\n`;
      }
      continue;
    }

    const fieldName = getSafeFieldName(dataType.description || `field_${dataType.id}`);
    
    if (dataType.isArrayField && dataType.arrayFields && dataType.arraySize) {
      // Array field with named sub-fields like x`y[100]
      // This becomes an array of objects with the sub-fields
      const subFields = dataType.arrayFields
        .map(af => `${getSafeFieldName(af.name)}: ${getTypeScriptTypeFromStructType(af.type)}`)
        .join("; ");
      fields += `${indent}${fieldName}: Array<{ ${subFields} }>;\n`;
    } else if (dataType.count > 1 && !dataType.isExpandedGroup) {
      // Array of values (non-expanded, like 450i with single name)
      const baseType = getTypeScriptTypeFromStructType(dataType.type);
      fields += `${indent}${fieldName}: ${baseType}[];\n`;
    } else {
      // Single value
      const tsType = getTypeScriptTypeFromStructType(dataType.type);
      fields += `${indent}${fieldName}: ${tsType};\n`;
    }
  }

  return fields;
}

/**
 * Generates TypeScript interfaces from struct specifications
 * This creates much smaller, more meaningful output than parsing actual data
 */
export function generateTypeScriptInterfacesFromSpecs(specs: FourLetterCodeSpec[]): string {
  if (!specs || specs.length === 0) {
    return "// No specifications available for TypeScript generation";
  }

  let result = "// Generated TypeScript interfaces from struct specifications\n\n";

  // Generate base resource interface
  result += "interface ResourceData<T = unknown> {\n";
  result += "  name?: string;\n";
  result += "  order?: number;\n";
  result += "  obj?: T;\n";
  result += "  data?: string; // hex-encoded raw data\n";
  result += "  conversionError?: string;\n";
  result += "}\n\n";

  // Generate interfaces for each four-letter code
  for (const spec of specs) {
    const interfaceName = `${capitalizeFirstLetter(spec.fourCC)}Data`;
    
    result += `interface ${interfaceName} {\n`;
    result += generateFieldsFromDataTypes(spec.dataTypes, "  ");
    result += "}\n\n";
  }

  // Generate typed resource interfaces
  for (const spec of specs) {
    const dataInterfaceName = `${capitalizeFirstLetter(spec.fourCC)}Data`;
    const resourceInterfaceName = `${capitalizeFirstLetter(spec.fourCC)}Resource`;
    
    if (spec.isArray) {
      result += `type ${resourceInterfaceName} = ResourceData<${dataInterfaceName}>[];\n\n`;
    } else {
      result += `type ${resourceInterfaceName} = Record<string, ResourceData<${dataInterfaceName}>>;\n\n`;
    }
  }

  // Generate main ResourceForkData interface
  result += "interface ResourceForkData {\n";
  for (const spec of specs) {
    const resourceInterfaceName = `${capitalizeFirstLetter(spec.fourCC)}Resource`;
    result += `  ${spec.fourCC}: ${resourceInterfaceName};\n`;
  }
  result += "}\n\n";

  result += "export type { ResourceForkData, ResourceData };\n";

  // Export individual data types
  const exportTypes = specs.map(s => `${capitalizeFirstLetter(s.fourCC)}Data`).join(", ");
  result += `export type { ${exportTypes} };\n`;

  return result;
}

/**
 * Legacy function for backward compatibility - generates from parsed data
 * @deprecated Use generateTypeScriptInterfacesFromSpecs instead
 */
export function generateTypeScriptInterfaces(parsedData: unknown): string {
  if (!parsedData || typeof parsedData !== "object") {
    return "// No data available for TypeScript generation";
  }

  // Simple generation from parsed data keys - much lighter than before
  let result = "// Generated TypeScript interfaces\n\n";

  result += "interface ResourceData {\n";
  result += "  name?: string;\n";
  result += "  order?: number;\n";
  result += "  obj?: Record<string, unknown>;\n";
  result += "  data?: string; // hex-encoded\n";
  result += "  conversionError?: string;\n";
  result += "}\n\n";

  const fourCCs = Object.keys(parsedData as Record<string, unknown>).filter(k => k !== "_metadata");
  
  result += "interface ResourceForkData {\n";
  for (const fourCC of fourCCs) {
    result += `  ${fourCC}: Record<string, ResourceData>;\n`;
  }
  result += "}\n\n";

  result += "export type { ResourceForkData, ResourceData };\n";

  return result;
}
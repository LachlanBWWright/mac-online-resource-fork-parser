import type { ParsedResourceCollection, ParsedResource } from "./types";

export function generateTypeScriptInterfaces(parsedData: unknown): string {
  if (!parsedData || typeof parsedData !== "object") {
    return "// No data available for TypeScript generation";
  }

  const generateInterface = (
    name: string,
    data: ParsedResourceCollection | ParsedResource[] | unknown,
    depth: number = 0,
  ): string => {
    const indent = "  ".repeat(depth);
    let interfaceStr = `${indent}interface ${name} {\n`;

    if (Array.isArray(data) && data.length > 0) {
      // For arrays, use first item as template
      const firstItem = data[0] as ParsedResource;
      if (firstItem && typeof firstItem === "object") {
        if (firstItem.obj) {
          interfaceStr += generateInterfaceFields(firstItem.obj, depth + 1);
        } else if (firstItem.conversionError) {
          interfaceStr += `${indent}  conversionError: string;\n`;
        } else if (firstItem.data) {
          interfaceStr += `${indent}  data: string; // hex-encoded\n`;
        } else {
          interfaceStr += generateInterfaceFields(firstItem as Record<string, unknown>, depth + 1);
        }
      }
    } else if (typeof data === "object" && data !== null) {
      // For resource collections, extract a sample resource
      const resourceIds = Object.keys(data as Record<string, unknown>);
      if (resourceIds.length > 0) {
        const sampleResource = (data as Record<string, ParsedResource>)[resourceIds[0]];
        if (sampleResource) {
          interfaceStr += generateResourceFields(sampleResource, depth + 1);
        }
      }
    }

    interfaceStr += `${indent}}\n\n`;
    return interfaceStr;
  };

  const generateResourceFields = (resource: ParsedResource, depth: number): string => {
    const indent = "  ".repeat(depth);
    let fields = "";

    // Standard resource fields
    if (resource.name !== undefined) {
      fields += `${indent}name?: string;\n`;
    }
    if (resource.order !== undefined) {
      fields += `${indent}order?: number;\n`;
    }
    if (resource.conversionError !== undefined) {
      fields += `${indent}conversionError?: string;\n`;
    }
    if (resource.data !== undefined) {
      fields += `${indent}data?: string; // hex-encoded\n`;
    }
    if (resource.obj !== undefined) {
      fields += `${indent}obj?: {\n`;
      fields += generateInterfaceFields(resource.obj, depth + 1);
      fields += `${indent}};\n`;
    }

    return fields;
  };

  const generateInterfaceFields = (obj: Record<string, unknown>, depth: number): string => {
    const indent = "  ".repeat(depth);
    let fields = "";

    for (const [key, value] of Object.entries(obj)) {
      if (key === "_metadata") continue;

      const fieldType = getTypeScriptType(value);
      const safeKey = isValidIdentifier(key) ? key : `"${key}"`;
      fields += `${indent}${safeKey}: ${fieldType};\n`;
    }

    return fields;
  };

  const getTypeScriptType = (value: unknown): string => {
    if (value === null || value === undefined) return "null | undefined";
    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (Array.isArray(value)) {
      if (value.length === 0) return "unknown[]";
      const firstItem = value[0];
      const itemType = getTypeScriptType(firstItem);
      return `${itemType}[]`;
    }
    if (typeof value === "object") {
      // Try to be more specific for objects
      const keys = Object.keys(value as Record<string, unknown>);
      if (keys.length === 0) return "Record<string, unknown>";
      
      // Check if it looks like a simple record
      if (keys.length <= 3) {
        let objectType = "{\n";
        for (const key of keys) {
          const val = (value as Record<string, unknown>)[key];
          const fieldType = getTypeScriptType(val);
          const safeKey = isValidIdentifier(key) ? key : `"${key}"`;
          objectType += `    ${safeKey}: ${fieldType};\n`;
        }
        objectType += "  }";
        return objectType;
      }
      return "Record<string, unknown>";
    }
    return "unknown";
  };

  const isValidIdentifier = (str: string): boolean => {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);
  };

  let result = "// Generated TypeScript interfaces\n\n";

  // Generate resource interface
  result += "interface ResourceData {\n";
  result += "  name?: string;\n";
  result += "  order?: number;\n";
  result += "  obj?: Record<string, unknown>;\n";
  result += "  data?: string; // hex-encoded\n";
  result += "  conversionError?: string;\n";
  result += "}\n\n";

  // Generate interfaces for each four-letter code
  Object.keys(parsedData as Record<string, unknown>).forEach((fourCC) => {
    if (fourCC !== "_metadata") {
      const capitalizedName =
        fourCC.charAt(0).toUpperCase() + fourCC.slice(1).toLowerCase();
      result += generateInterface(
        `${capitalizedName}ParsedData`,
        (parsedData as Record<string, unknown>)[fourCC],
      );
    }
  });

  // Generate main interface
  result += "interface ResourceForkData {\n";
  Object.keys(parsedData as Record<string, unknown>).forEach((fourCC) => {
    if (fourCC !== "_metadata") {
      result += `  ${fourCC}: Record<string, ResourceData>;\n`;
    }
  });
  result += "}\n\n";

  result += "export type { ResourceForkData, ResourceData };\n";

  return result;
}
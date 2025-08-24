import React, { useState, useCallback, useRef } from "react";
import {
  saveToJson,
  saveFromJson,
} from "../exten/rsrcdump/rsrcdump-ts/src/rsrcdump";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  ChevronDown,
  Upload,
  Download,
  FileText,
  Settings,
  Plus,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Code,
} from "lucide-react";
import { useToast } from "../lib/toast";

interface ParsedResult {
  success: boolean;
  data?: any;
  error?: string;
  filename?: string;
}

interface FourLetterCodeSpec {
  fourCC: string;
  dataTypes: DataTypeField[];
  isArray: boolean;
  autoPadding: boolean;
  status: "valid" | "error" | "warning";
  statusMessage?: string;
  sampleData?: any;
}

interface ArrayFieldSpec {
  name: string;
  type: "L" | "l" | "i" | "h" | "H" | "f" | "B" | "b" | "x" | "s" | "p";
}

interface DataTypeField {
  id: string;
  type: "L" | "l" | "i" | "h" | "H" | "f" | "B" | "b" | "x" | "s" | "p";
  count: number;
  description: string;
  isArrayField?: boolean;
  arraySize?: number;
  arrayFields?: ArrayFieldSpec[]; // Array of field specs with individual types
}

const DATA_TYPE_OPTIONS = [
  { value: "L", label: "L - Unsigned Long (4 bytes)" },
  { value: "l", label: "l - Signed Long (4 bytes)" },
  { value: "i", label: "i - Signed Int (4 bytes)" },
  { value: "h", label: "h - Signed Short (2 bytes)" },
  { value: "H", label: "H - Unsigned Short (2 bytes)" },
  { value: "f", label: "f - Float (4 bytes)" },
  { value: "B", label: "B - Unsigned Byte (1 byte)" },
  { value: "b", label: "b - Signed Byte (1 byte)" },
  { value: "x", label: "x - Padding Byte (1 byte)" },
  { value: "s", label: "s - String" },
  { value: "p", label: "p - Pascal String" },
] as const;

export default function ResourceForkParser() {
  const { success, error, warning, info } = useToast();
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [fourLetterCodes, setFourLetterCodes] = useState<FourLetterCodeSpec[]>(
    [],
  );
  const [parseError, setParseError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [saveLoadOpen, setSaveLoadOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const specFileInputRef = useRef<HTMLInputElement>(null);

  // Extract four-letter codes from uploaded file and set default specs
  const extractFourLetterCodes = useCallback(
    async (file: File): Promise<FourLetterCodeSpec[]> => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        // Parse with default otto specs enabled to get all available four-letter codes
        const result = saveToJson(data, [], [], [], true);

        // Extract unique four-letter codes from the result
        const fourLetterCodesSet = new Set<string>();

        if (result && typeof result === "object") {
          Object.keys(result).forEach((key) => {
            // Check for four-letter codes (excluding metadata)
            if (
              key.length === 4 &&
              /^[A-Za-z0-9]{4}$/.test(key) &&
              key !== "_metadata"
            ) {
              fourLetterCodesSet.add(key);
            }
          });
        }

        // Create default specs for each four-letter code
        const defaultSpecs: FourLetterCodeSpec[] = Array.from(
          fourLetterCodesSet,
        ).map((fourCC) => ({
          fourCC,
          dataTypes: [{ id: "1", type: "i", count: 1, description: "field_1" }],
          isArray: false,
          autoPadding: false,
          status: "valid" as const,
          sampleData: null,
        }));

        return defaultSpecs;
      } catch (error) {
        console.error("Error extracting four-letter codes:", error);
        return [];
      }
    },
    [],
  );

  const generateStructSpec = useCallback((spec: FourLetterCodeSpec): string => {
    let result = "";
    for (const dataType of spec.dataTypes) {
      if (dataType.isArrayField && dataType.arraySize && dataType.arrayFields) {
        // Handle array field like x`y[100] with individual types for each field
        const fieldSpecs = dataType.arrayFields.map(field => field.type).join(' ');
        const fieldNames = dataType.arrayFields.map(field => field.name).join('`');
        result += `${fieldSpecs} ${fieldNames}[${dataType.arraySize}]`;
      } else if (dataType.count > 1) {
        result += `${dataType.count}${dataType.type}`;
      } else {
        result += dataType.type;
      }
    }
    return result + (spec.isArray ? "+" : "");
  }, []);

  // Generate TypeScript interfaces from parsed data
  const generateTypeScriptInterfaces = useCallback((parsedData: any): string => {
    if (!parsedData || typeof parsedData !== 'object') {
      return "// No data available for TypeScript generation";
    }

    const generateInterface = (name: string, data: any, depth: number = 0): string => {
      const indent = "  ".repeat(depth);
      let interfaceStr = `${indent}interface ${name} {\n`;
      
      if (Array.isArray(data) && data.length > 0) {
        // For arrays, use first item as template
        const firstItem = data[0];
        if (firstItem && typeof firstItem === 'object') {
          if (firstItem.obj) {
            interfaceStr += generateInterfaceFields(firstItem.obj, depth + 1);
          } else if (firstItem.conversionError) {
            interfaceStr += `${indent}  conversionError: string;\n`;
          } else if (firstItem.data) {
            interfaceStr += `${indent}  data: string; // hex-encoded\n`;
          } else {
            interfaceStr += generateInterfaceFields(firstItem, depth + 1);
          }
        }
      } else if (typeof data === 'object') {
        interfaceStr += generateInterfaceFields(data, depth + 1);
      }
      
      interfaceStr += `${indent}}\n\n`;
      return interfaceStr;
    };

    const generateInterfaceFields = (obj: any, depth: number): string => {
      const indent = "  ".repeat(depth);
      let fields = "";
      
      for (const [key, value] of Object.entries(obj)) {
        if (key === '_metadata') continue;
        
        const fieldType = getTypeScriptType(value);
        fields += `${indent}${key}: ${fieldType};\n`;
      }
      
      return fields;
    };

    const getTypeScriptType = (value: any): string => {
      if (value === null || value === undefined) return "any";
      if (typeof value === "string") return "string";
      if (typeof value === "number") return "number";
      if (typeof value === "boolean") return "boolean";
      if (Array.isArray(value)) {
        if (value.length === 0) return "any[]";
        const itemType = getTypeScriptType(value[0]);
        return `${itemType}[]`;
      }
      if (typeof value === "object") return "any"; // Could be more specific
      return "any";
    };

    let result = "// Generated TypeScript interfaces\n\n";
    
    // Generate interfaces for each four-letter code
    Object.keys(parsedData).forEach(fourCC => {
      if (fourCC !== '_metadata') {
        const capitalizedName = fourCC.charAt(0).toUpperCase() + fourCC.slice(1).toLowerCase();
        result += generateInterface(`${capitalizedName}Data`, parsedData[fourCC]);
      }
    });

    // Generate main interface
    result += "interface ResourceForkData {\n";
    Object.keys(parsedData).forEach(fourCC => {
      if (fourCC !== '_metadata') {
        const capitalizedName = fourCC.charAt(0).toUpperCase() + fourCC.slice(1).toLowerCase();
        result += `  ${fourCC}: ${capitalizedName}Data[];\n`;
      }
    });
    result += "}\n\n";

    result += "export type { ResourceForkData };\n";
    
    return result;
  }, []);

  // Download TypeScript interfaces
  const downloadTypeScript = useCallback(() => {
    if (!parsedResult?.data) {
      error("No parsed data available for TypeScript generation");
      return;
    }

    try {
      const tsContent = generateTypeScriptInterfaces(parsedResult.data);
      const blob = new Blob([tsContent], { type: "text/typescript" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${parsedResult.filename?.replace(/\.[^/.]+$/, "") || "resource-fork"}-types.ts`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      success({
        title: "TypeScript Downloaded",
        description: "TypeScript interface file has been generated and downloaded"
      });
    } catch (err) {
      console.error("Error generating TypeScript:", err);
      error({
        title: "Generation Failed", 
        description: "Failed to generate TypeScript interfaces"
      });
    }
  }, [parsedResult, generateTypeScriptInterfaces, success, error]);

  const parseWithSpecs = useCallback(
    async (data: Uint8Array, specs: FourLetterCodeSpec[]) => {
      try {
        // Create struct specs array for parsing
        const structSpecs = specs.map((spec: FourLetterCodeSpec) => {
          const specStr = generateStructSpec(spec);
          const description = spec.dataTypes
            .map((dt) => dt.description)
            .join(",");
          return `${spec.fourCC}:${specStr}:${description}`;
        });

        const result = saveToJson(data, structSpecs, [], [], false);

        // Update specs with sample data and validation status
        const updatedSpecs = specs.map((spec) => {
          const sampleData =
            result && result[spec.fourCC] ? result[spec.fourCC] : null;

          let status: "valid" | "error" | "warning" = "error";
          let statusMessage = "Failed to parse data";

          if (sampleData) {
            if (Array.isArray(sampleData) && sampleData.length > 0) {
              status = "valid";
              statusMessage = `Successfully parsed ${sampleData.length} items`;
            } else if (
              typeof sampleData === "object" &&
              Object.keys(sampleData).length > 0
            ) {
              status = "valid";
              statusMessage = "Successfully parsed data";
            } else {
              status = "warning";
              statusMessage = "Parsed but no meaningful data found";
            }
          }

          return {
            ...spec,
            sampleData,
            status,
            statusMessage,
          };
        });

        return { result, updatedSpecs };
      } catch (error) {
        console.error("Error parsing with specs:", error);
        throw error;
      }
    },
    [generateStructSpec],
  );

  // Handle .rsrc file upload - main flow starts here
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setParseError("");
      setIsProcessing(true);

      try {
        // Extract four-letter codes automatically
        const extractedSpecs = await extractFourLetterCodes(file);
        setFourLetterCodes(extractedSpecs);

        // Parse with default specs to show initial samples
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const { result, updatedSpecs } = await parseWithSpecs(
          data,
          extractedSpecs,
        );

        setFourLetterCodes(updatedSpecs);
        setCurrentFile(file);

        if (result) {
          setParsedResult({
            success: true,
            data: result,
            filename: file.name,
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to parse file";
        setParseError(errorMessage);
        setParsedResult({
          success: false,
          error: errorMessage,
          filename: file.name,
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [extractFourLetterCodes, parseWithSpecs],
  );

  // Re-parse when specs change
  const reParseWithUpdatedSpecs = useCallback(
    async (updatedSpecs: FourLetterCodeSpec[]) => {
      if (!currentFile) return;

      try {
        const arrayBuffer = await currentFile.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const { result, updatedSpecs: newSpecs } = await parseWithSpecs(
          data,
          updatedSpecs,
        );

        setFourLetterCodes(newSpecs);

        if (result) {
          setParsedResult({
            success: true,
            data: result,
            filename: currentFile.name,
          });
        }
      } catch (error) {
        console.error("Error re-parsing:", error);
      }
    },
    [currentFile, parseWithSpecs],
  );

  // Update four-letter code spec
  const updateFourLetterCodeSpec = useCallback(
    (index: number, updates: Partial<FourLetterCodeSpec>) => {
      const updatedSpecs = [...fourLetterCodes];
      updatedSpecs[index] = { ...updatedSpecs[index], ...updates };
      setFourLetterCodes(updatedSpecs);
      reParseWithUpdatedSpecs(updatedSpecs);
    },
    [fourLetterCodes, reParseWithUpdatedSpecs],
  );

  // Add data type to spec
  const addDataTypeToSpec = useCallback(
    (specIndex: number) => {
      const updatedSpecs = [...fourLetterCodes];
      const newId = (updatedSpecs[specIndex].dataTypes.length + 1).toString();
      updatedSpecs[specIndex].dataTypes.push({
        id: newId,
        type: "i",
        count: 1,
        description: `field_${newId}`,
      });
      setFourLetterCodes(updatedSpecs);
      reParseWithUpdatedSpecs(updatedSpecs);
    },
    [fourLetterCodes, reParseWithUpdatedSpecs],
  );

  // Remove data type from spec
  const removeDataTypeFromSpec = useCallback(
    (specIndex: number, dataTypeId: string) => {
      const updatedSpecs = [...fourLetterCodes];
      updatedSpecs[specIndex].dataTypes = updatedSpecs[
        specIndex
      ].dataTypes.filter((dt) => dt.id !== dataTypeId);
      setFourLetterCodes(updatedSpecs);
      reParseWithUpdatedSpecs(updatedSpecs);
    },
    [fourLetterCodes, reParseWithUpdatedSpecs],
  );

  // Update data type
  const updateDataType = useCallback(
    (
      specIndex: number,
      dataTypeId: string,
      updates: Partial<DataTypeField>,
    ) => {
      const updatedSpecs = [...fourLetterCodes];
      const dataTypeIndex = updatedSpecs[specIndex].dataTypes.findIndex(
        (dt) => dt.id === dataTypeId,
      );
      if (dataTypeIndex !== -1) {
        const existing = updatedSpecs[specIndex].dataTypes[dataTypeIndex];
        const merged: DataTypeField = {
          ...existing,
          ...updates,
        } as DataTypeField;
        if (
          !(merged.type === "s" || merged.type === "p" || merged.type === "x")
        ) {
          merged.count = 1;
        } else if (!merged.count || merged.count < 1) {
          merged.count = 1;
        }

        updatedSpecs[specIndex].dataTypes[dataTypeIndex] = merged;
        setFourLetterCodes(updatedSpecs);
        reParseWithUpdatedSpecs(updatedSpecs);
      }
    },
    [fourLetterCodes, reParseWithUpdatedSpecs],
  );

  // Add array field to spec
  const addArrayFieldToSpec = useCallback(
    (specIndex: number) => {
      const updatedSpecs = [...fourLetterCodes];
      const newId = (updatedSpecs[specIndex].dataTypes.length + 1).toString();
      updatedSpecs[specIndex].dataTypes.push({
        id: newId,
        type: "i",
        count: 1,
        description: "array_field",
        isArrayField: true,
        arraySize: 100,
        arrayFields: [
          { name: "x", type: "i" as const },
          { name: "y", type: "i" as const }
        ], // Default to x and y with integer types
      });
      setFourLetterCodes(updatedSpecs);
      reParseWithUpdatedSpecs(updatedSpecs);
      
      info({
        title: "Array Field Added",
        description: "Added an array field. Configure the field names and size."
      });
    },
    [fourLetterCodes, reParseWithUpdatedSpecs, info],
  );

  // Load EarthFarm sample file
  const loadEarthFarmSample = useCallback(async () => {
    setParseError("");
    setIsProcessing(true);

    try {
      const response = await fetch("/test-files/EarthFarm.ter.rsrc");
      if (!response.ok) {
        throw new Error("Failed to load EarthFarm sample file");
      }

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const file = new File([data], "EarthFarm.ter.rsrc");

      // Try to load a paired specs file first (same base name with .specs.txt)
      let loadedSpecs: FourLetterCodeSpec[] | null = null;
      try {
        const specsResponse = await fetch("/test-files/EarthFarm.specs.txt");
        if (specsResponse.ok) {
          const text = await specsResponse.text();
          const lines = text.split("\n").filter((line) => line.trim());

          loadedSpecs = lines.map((line, index) => {
            // split into parts: fourCC:structSpec:desc1,desc2,...
            const parts = line.split(":");
            const fourCC = parts[0];
            const structSpec = parts[1] || "";
            const namesPart = parts.slice(2).join(":") || ""; // join remainder in case descriptions contain ':'
            // Preserve empty tokens so consecutive commas indicate a missing name.
            const nameTokens = namesPart
              ? namesPart.split(",").map((s) => s.trim())
              : [];

            const dataTypes: DataTypeField[] = [];
            let currentIndex = 0;
            let fieldIndex = 1;
            let nameIndex = 0; // index into nameTokens for non-padding fields
            const rawSpec = structSpec || "";
            const isArray = rawSpec.endsWith("+");
            const specStr = isArray ? rawSpec.slice(0, -1) : rawSpec;

            while (currentIndex < specStr.length) {
              const match = specStr
                .slice(currentIndex)
                .match(/^(\d+)([A-Za-z])/);
              if (match) {
                const count = parseInt(match[1]);
                const type = match[2];
                currentIndex += match[0].length;

                if (type === "s" || type === "p" || type === "x") {
                  // s/p keep a single field with count; x is padding and has no name
                  const desc =
                    type === "x"
                      ? ""
                      : nameTokens[nameIndex] &&
                        nameTokens[nameIndex].length > 0
                      ? nameTokens[nameIndex]
                      : `field_${fieldIndex}`;
                  if (type !== "x") nameIndex++;
                  dataTypes.push({
                    id: fieldIndex.toString(),
                    type: type as any,
                    count,
                    description: desc,
                  });
                  fieldIndex++;
                } else {
                  // expand numeric prefix into multiple single-count fields
                  for (let i = 0; i < count; i++) {
                    const desc =
                      nameTokens[nameIndex] && nameTokens[nameIndex].length > 0
                        ? nameTokens[nameIndex]
                        : `field_${fieldIndex}`;
                    nameIndex++;
                    dataTypes.push({
                      id: fieldIndex.toString(),
                      type: type as any,
                      count: 1,
                      description: desc,
                    });
                    fieldIndex++;
                  }
                }
              } else {
                const type: any = specStr[currentIndex];
                currentIndex++;
                const desc =
                  type === "x"
                    ? ""
                    : nameTokens[nameIndex] && nameTokens[nameIndex].length > 0
                    ? nameTokens[nameIndex]
                    : `field_${fieldIndex}`;
                if (type !== "x") nameIndex++;
                dataTypes.push({
                  id: fieldIndex.toString(),
                  type: type as any,
                  count: 1,
                  description: desc,
                });
                fieldIndex++;
              }
            }

            return {
              fourCC: fourCC || `Spec${index + 1}`,
              dataTypes,
              isArray,
              autoPadding: false,
              status: "valid" as const,
              sampleData: null,
            };
          });
        }
      } catch (e) {
        loadedSpecs = null;
      }

      let specsToUse: FourLetterCodeSpec[] = [];
      if (loadedSpecs && loadedSpecs.length > 0) {
        specsToUse = loadedSpecs;
        setFourLetterCodes(loadedSpecs);
      } else {
        // Extract all four-letter codes automatically
        const extractedSpecs = await extractFourLetterCodes(file);
        specsToUse = extractedSpecs;
        setFourLetterCodes(extractedSpecs);
      }

      // Parse with default specs to show initial samples
      const { result, updatedSpecs } = await parseWithSpecs(data, specsToUse);

      setFourLetterCodes(updatedSpecs);
      setCurrentFile(file);

      if (result) {
        setParsedResult({
          success: true,
          data: result,
          filename: "EarthFarm.ter.rsrc",
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load EarthFarm sample";
      setParseError(errorMessage);
      setParsedResult({
        success: false,
        error: errorMessage,
        filename: "EarthFarm.ter.rsrc",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [extractFourLetterCodes, parseWithSpecs]);

  // Handle JSON upload
  const handleJsonUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setParseError("");
      setIsProcessing(true);

      try {
        const jsonText = await file.text();
        const jsonData = JSON.parse(jsonText);

        // Convert JSON back to .rsrc
        const structSpecs = fourLetterCodes.map((spec: FourLetterCodeSpec) => {
          const specStr = generateStructSpec(spec);
          const description = spec.dataTypes
            .map((dt) => dt.description)
            .join(",");
          return `${spec.fourCC}:${specStr}:${description}`;
        });

        const rsrcData = saveFromJson(jsonData, structSpecs);

        // Download as .rsrc file
        // Ensure we pass an ArrayBuffer to Blob by wrapping the data in a Uint8Array
        const arrayBuffer = new Uint8Array(rsrcData as any).buffer;
        const blob = new Blob([arrayBuffer], {
          type: "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "converted.rsrc";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to convert JSON";
        setParseError(errorMessage);
      } finally {
        setIsProcessing(false);
      }
    },
    [fourLetterCodes, generateStructSpec],
  );

  // Download JSON
  const downloadJson = useCallback(() => {
    if (!parsedResult?.data) {
      error("No parsed data available for download");
      return;
    }

    try {
      const blob = new Blob([JSON.stringify(parsedResult.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${parsedResult.filename || "parsed"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      success({
        title: "JSON Downloaded",
        description: "Resource fork data has been exported to JSON"
      });
    } catch (err) {
      error({
        title: "Download Failed",
        description: "Failed to generate JSON file"
      });
    }
  }, [parsedResult, success, error]);

  // Save specifications to file
  const saveSpecifications = useCallback(() => {
    if (fourLetterCodes.length === 0) {
      warning("No specifications to save");
      return;
    }

    try {
      const specs = fourLetterCodes
        .map((spec) => {
          const structSpec = generateStructSpec(spec);
          const description = spec.dataTypes
            .map((dt) => dt.description)
            .join(",");
          return `${spec.fourCC}:${structSpec}:${description}`;
        })
        .join("\n");

      const blob = new Blob([specs], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "specifications.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      success({
        title: "Specifications Saved",
        description: "Struct specifications have been exported to text file"
      });
    } catch (err) {
      error({
        title: "Save Failed",
        description: "Failed to generate specifications file"
      });
    }
  }, [fourLetterCodes, generateStructSpec, success, error, warning]);

  // Load specifications from file
  const handleSpecUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const lines = text.split("\n").filter((line) => line.trim());

        const loadedSpecs: FourLetterCodeSpec[] = lines.map((line) => {
          const parts = line.split(":");
          const fourCC = parts[0];
          const structSpec = parts[1] || "";
          const namesPart = parts.slice(2).join(":") || "";
          // Preserve empty tokens so consecutive commas indicate a missing name.
          const nameTokens = namesPart
            ? namesPart.split(",").map((s) => s.trim())
            : [];

          const rawSpec = structSpec || "";
          const isArray = rawSpec.endsWith("+");
          const specStr = isArray ? rawSpec.slice(0, -1) : rawSpec;

          // Parse the struct spec back into data types
          const dataTypes: DataTypeField[] = [];
          let currentIndex = 0;
          let fieldIndex = 1;
          let nameIndex = 0;

          while (currentIndex < specStr.length) {
            const match = specStr.slice(currentIndex).match(/^(\d+)([A-Za-z])/);
            if (match) {
              const count = parseInt(match[1]);
              const type = match[2];
              currentIndex += match[0].length;

              if (type === "s" || type === "p" || type === "x") {
                const desc =
                  type === "x"
                    ? ""
                    : nameTokens[nameIndex] && nameTokens[nameIndex].length > 0
                    ? nameTokens[nameIndex]
                    : `field_${fieldIndex}`;
                if (type !== "x") nameIndex++;
                dataTypes.push({
                  id: fieldIndex.toString(),
                  type: type as any,
                  count,
                  description: desc,
                });
                fieldIndex++;
              } else {
                for (let i = 0; i < count; i++) {
                  const desc =
                    nameTokens[nameIndex] && nameTokens[nameIndex].length > 0
                      ? nameTokens[nameIndex]
                      : `field_${fieldIndex}`;
                  nameIndex++;
                  dataTypes.push({
                    id: fieldIndex.toString(),
                    type: type as any,
                    count: 1,
                    description: desc,
                  });
                  fieldIndex++;
                }
              }
            } else {
              const type: any = specStr[currentIndex];
              currentIndex++;
              const desc =
                type === "x"
                  ? ""
                  : nameTokens[nameIndex] && nameTokens[nameIndex].length > 0
                  ? nameTokens[nameIndex]
                  : `field_${fieldIndex}`;
              if (type !== "x") nameIndex++;
              dataTypes.push({
                id: fieldIndex.toString(),
                type: type as any,
                count: 1,
                description: desc,
              });
              fieldIndex++;
            }
          }

          return {
            fourCC,
            dataTypes,
            isArray,
            autoPadding: false,
            status: "valid" as const,
            sampleData: null,
          };
        });

        setFourLetterCodes(loadedSpecs);
        reParseWithUpdatedSpecs(loadedSpecs);
      } catch (error) {
        setParseError("Failed to load specifications file");
      }
    },
    [reParseWithUpdatedSpecs],
  );

  const getStatusIcon = (status: "valid" | "error" | "warning") => {
    switch (status) {
      case "valid":
        return <Check className="h-4 w-4 text-green-500" />;
      case "error":
        return <X className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const renderSampleDataUI = (sampleData: any) => {
    if (!sampleData) return <span className="text-gray-400">-</span>;
    console.log("sampledata", sampleData);
    
    const renderJson = (obj: any, title?: string) => (
      <div className="bg-gray-900 p-2 rounded">
        {title && <div className="text-xs text-gray-400 mb-1">{title}:</div>}
        <pre className="text-sm text-gray-200 overflow-x-auto">
          {JSON.stringify(obj, null, 2)}
        </pre>
      </div>
    );

    // Handle object with resource IDs (e.g., {1000: {name: "...", order: 1000, obj: {...}}})
    if (typeof sampleData === "object" && !Array.isArray(sampleData)) {
      const resourceIds = Object.keys(sampleData);
      if (resourceIds.length === 0) {
        return <div className="text-gray-400">No resource data</div>;
      }

      return (
        <div className="space-y-2">
          <div className="text-gray-300">
            Resources found: {resourceIds.length}
          </div>
          {resourceIds.slice(0, 3).map((resourceId) => {
            const resource = sampleData[resourceId];
            if (!resource) return null;
            
            return (
              <div key={resourceId} className="border border-gray-600 rounded p-2">
                <div className="text-sm text-gray-300 mb-2">
                  Resource ID: {resourceId}
                  {resource.name && <span> | Name: {resource.name}</span>}
                  {resource.order && <span> | Order: {resource.order}</span>}
                </div>
                
                {resource.conversionError && (
                  <div className="text-red-300 mb-2">
                    <strong>Conversion Error:</strong> {resource.conversionError}
                  </div>
                )}
                
                {resource.obj && renderJson(resource.obj, "Parsed Object")}
                
                {resource.data && !resource.obj && (
                  <div className="text-gray-200">
                    <div className="text-xs text-gray-400 mb-1">Raw Data:</div>
                    <code className="break-all text-sm bg-gray-800 p-2 rounded block">
                      {(resource.data as string).length > 200
                        ? (resource.data as string).substring(0, 200) + "..."
                        : resource.data}
                    </code>
                  </div>
                )}
              </div>
            );
          })}
          {resourceIds.length > 3 && (
            <div className="text-gray-400">Showing first 3 resources...</div>
          )}
        </div>
      );
    }

    // Handle array of resources (legacy support)
    if (Array.isArray(sampleData)) {
      if (sampleData.length === 0)
        return <div className="text-gray-400">Empty array</div>;

      return (
        <div className="space-y-2">
          <div className="text-gray-300">
            Array items: {sampleData.length}
          </div>
          {sampleData.slice(0, 3).map((item: any, idx: number) => (
            <div key={idx} className="border border-gray-600 rounded p-2">
              {item.conversionError && (
                <div className="text-red-300 mb-2">
                  Error: {item.conversionError}
                </div>
              )}
              {item.obj && renderJson(item.obj, `Item ${idx + 1} - Parsed Object`)}
              {item.data && !item.obj && (
                <div className="text-gray-200">
                  <div className="text-xs text-gray-400 mb-1">Raw Data:</div>
                  <code className="break-all text-sm bg-gray-800 p-2 rounded block">
                    {(item.data as string).length > 200
                      ? (item.data as string).substring(0, 200) + "..."
                      : item.data}
                  </code>
                </div>
              )}
            </div>
          ))}
          {sampleData.length > 3 && (
            <div className="text-gray-400">Showing first 3 items...</div>
          )}
        </div>
      );
    }

    // Fallback for simple values
    return <div className="text-gray-200">{String(sampleData)}</div>;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white">
            Mac Resource Fork Parser
          </h1>
          <p className="text-gray-400 text-lg">
            Upload a resource fork file to analyze and experiment with data
            types
          </p>
          <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4 max-w-2xl mx-auto">
            <div className="flex items-center gap-2 text-yellow-200">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Work In Progress</span>
            </div>
            <p className="text-yellow-100 text-sm mt-1">
              This application is under active development. Features may be incomplete, 
              and parsing results should be verified. Use with caution for production data.
            </p>
          </div>
        </div>

        {/* File Operations & Specifications - Combined */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <FileText className="h-5 w-5" />
              File Operations & Specifications
            </CardTitle>
            <CardDescription className="text-gray-400">
              Upload files to parse, manage specifications, or try the sample
              file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upload Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Upload .rsrc file */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">
                  Upload .rsrc File
                </label>
                <Input
                  type="file"
                  accept=".rsrc"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  disabled={isProcessing}
                  size="lg"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose .rsrc File
                </Button>
              </div>

              {/* Upload JSON file */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">
                  Upload .json File
                </label>
                <Input
                  type="file"
                  accept=".json"
                  onChange={handleJsonUpload}
                  ref={jsonInputRef}
                  className="hidden"
                />
                <Button
                  onClick={() => jsonInputRef.current?.click()}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={isProcessing || fourLetterCodes.length === 0}
                  size="lg"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Convert from JSON
                </Button>
              </div>

              {/* Sample file */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">
                  Sample File
                </label>
                <Button
                  onClick={loadEarthFarmSample}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  disabled={isProcessing}
                  size="lg"
                >
                  Load EarthFarm Sample
                </Button>
              </div>
            </div>

            {/* Specifications Management */}
            <Collapsible open={saveLoadOpen} onOpenChange={setSaveLoadOpen}>
              <CollapsibleTrigger asChild>
                <div className="border-t border-gray-700 pt-6">
                  <div className="flex items-center justify-between cursor-pointer hover:bg-gray-700 p-3 rounded transition-colors">
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      <span className="font-medium text-gray-200">
                        Specification Management
                      </span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        saveLoadOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">
                        Save Current Specifications
                      </label>
                      <Button
                        onClick={saveSpecifications}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={fourLetterCodes.length === 0}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Save Specifications
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">
                        Load Specifications from File
                      </label>
                      <Input
                        type="file"
                        accept=".txt"
                        onChange={handleSpecUpload}
                        ref={specFileInputRef}
                        className="hidden"
                      />
                      <Button
                        onClick={() => specFileInputRef.current?.click()}
                        className="w-full bg-gray-600 hover:bg-gray-700 text-white"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Load Specifications
                      </Button>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Download Buttons - Prominent */}
            {parsedResult?.success && (
              <div className="pt-6 border-t border-gray-700 space-y-3">
                <Button
                  onClick={downloadJson}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg py-4"
                  size="lg"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Download as JSON
                </Button>
                <Button
                  onClick={downloadTypeScript}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                  size="lg"
                  variant="outline"
                >
                  <Code className="h-5 w-5 mr-2" />
                  Download TypeScript Interfaces
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Display */}
        {parseError && (
          <Card className="bg-red-900 border-red-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-red-100">
                <X className="h-5 w-5" />
                <span className="font-medium">Error:</span>
                <span>{parseError}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-gray-300">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                <span>Processing...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Four-Letter Code Specifications */}
        {fourLetterCodes.length > 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">
                Four-Letter Code Specifications
              </CardTitle>
              <CardDescription className="text-gray-400">
                Configure data types for each four-letter code found in your
                file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {fourLetterCodes.map((spec, specIndex) => (
                <div
                  key={spec.fourCC}
                  className="border border-gray-600 rounded-lg p-6 space-y-6 bg-gray-750"
                >
                  {/* Four-letter code header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <h3 className="text-xl font-semibold text-white">
                        {spec.fourCC}
                      </h3>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(spec.status)}
                        <Badge
                          variant={
                            spec.status === "valid"
                              ? "default"
                              : spec.status === "error"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-sm"
                        >
                          {spec.statusMessage || spec.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={spec.isArray}
                          onChange={(e) =>
                            updateFourLetterCodeSpec(specIndex, {
                              isArray: e.target.checked,
                            })
                          }
                          className="rounded bg-gray-700 border-gray-600"
                        />
                        Is Array
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={spec.autoPadding}
                          onChange={(e) =>
                            updateFourLetterCodeSpec(specIndex, {
                              autoPadding: e.target.checked,
                            })
                          }
                          className="rounded bg-gray-700 border-gray-600"
                        />
                        Auto Padding
                      </label>
                    </div>
                  </div>

                  {/* Sample Data Display */}
                  {spec.sampleData && (
                    <div className="bg-gray-900 rounded p-4 space-y-2">
                      <h4 className="font-medium text-gray-300">
                        Sample Data:
                      </h4>
                      <div>{renderSampleDataUI(spec.sampleData)}</div>
                    </div>
                  )}

                  {/* Data types table */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-200">
                        Data Type Fields
                      </h4>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => addDataTypeToSpec(specIndex)}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Field
                        </Button>
                        <Button
                          onClick={() => addArrayFieldToSpec(specIndex)}
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Array Field
                        </Button>
                      </div>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-600">
                          <TableHead className="text-gray-300">Type</TableHead>
                          <TableHead className="text-gray-300">Count</TableHead>
                          <TableHead className="text-gray-300">
                            Description
                          </TableHead>
                          <TableHead className="text-gray-300">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {spec.dataTypes.map((dataType) => (
                          <React.Fragment key={dataType.id}>
                            <TableRow
                              className={`border-gray-600 ${
                                dataType.isArrayField ? "bg-gray-750" : ""
                              }`}
                            >
                              <TableCell>
                                {dataType.isArrayField ? (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">
                                      Array
                                    </Badge>
                                    <Select
                                      value={dataType.type}
                                      onValueChange={(value: any) =>
                                        updateDataType(specIndex, dataType.id, {
                                          type: value,
                                        })
                                      }
                                    >
                                      <SelectTrigger className="w-48 bg-gray-600 border-gray-500 text-white">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="bg-gray-700 border-gray-600">
                                        {DATA_TYPE_OPTIONS.map((option) => (
                                          <SelectItem
                                            key={option.value}
                                            value={option.value}
                                            className="text-white hover:bg-gray-600"
                                          >
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ) : (
                                  <Select
                                    value={dataType.type}
                                    onValueChange={(value: any) =>
                                      updateDataType(specIndex, dataType.id, {
                                        type: value,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="w-64 bg-gray-700 border-gray-600 text-white">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-700 border-gray-600">
                                      {DATA_TYPE_OPTIONS.map((option) => (
                                        <SelectItem
                                          key={option.value}
                                          value={option.value}
                                          className="text-white hover:bg-gray-600"
                                        >
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </TableCell>
                              <TableCell>
                                {dataType.isArrayField ? (
                                  <Input
                                    type="number"
                                    value={dataType.arraySize || 100}
                                    onChange={(e) =>
                                      updateDataType(specIndex, dataType.id, {
                                        arraySize: parseInt(e.target.value) || 1,
                                      })
                                    }
                                    className="w-20 bg-gray-600 border-gray-500 text-white"
                                    min="1"
                                    placeholder="Size"
                                  />
                                ) : (
                                  <Input
                                    type="number"
                                    value={dataType.count}
                                    onChange={(e) =>
                                      updateDataType(specIndex, dataType.id, {
                                        count: parseInt(e.target.value) || 1,
                                      })
                                    }
                                    className="w-20 bg-gray-700 border-gray-600 text-white"
                                    min="1"
                                    disabled={
                                      !(
                                        dataType.type === "s" ||
                                        dataType.type === "p" ||
                                        dataType.type === "x"
                                      )
                                    }
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {dataType.isArrayField ? (
                                  <div className="space-y-3 bg-gray-700 p-3 rounded">
                                    <div className="text-sm text-gray-300 font-medium">Array Field Configuration:</div>
                                    {(dataType.arrayFields || [{ name: "x", type: "i" as const }, { name: "y", type: "i" as const }]).map((arrayField, idx) => (
                                      <div key={idx} className="flex gap-2 items-center bg-gray-600 p-2 rounded">
                                        <Input
                                          value={arrayField.name}
                                          onChange={(e) => {
                                            const newArrayFields = [...(dataType.arrayFields || [{ name: "x", type: "i" as const }, { name: "y", type: "i" as const }])];
                                            newArrayFields[idx] = { ...newArrayFields[idx], name: e.target.value };
                                            updateDataType(specIndex, dataType.id, {
                                              arrayFields: newArrayFields,
                                            });
                                          }}
                                          className="w-24 bg-gray-700 border-gray-500 text-white"
                                          placeholder="Field name"
                                        />
                                        <Select
                                          value={arrayField.type}
                                          onValueChange={(value: "L" | "l" | "i" | "h" | "H" | "f" | "B" | "b" | "x" | "s" | "p") => {
                                            const newArrayFields = [...(dataType.arrayFields || [{ name: "x", type: "i" as const }, { name: "y", type: "i" as const }])];
                                            newArrayFields[idx] = { ...newArrayFields[idx], type: value };
                                            updateDataType(specIndex, dataType.id, {
                                              arrayFields: newArrayFields,
                                            });
                                          }}
                                        >
                                          <SelectTrigger className="w-40 bg-gray-700 border-gray-500 text-white">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent className="bg-gray-800 border-gray-600">
                                            {DATA_TYPE_OPTIONS.map((option) => (
                                              <SelectItem
                                                key={option.value}
                                                value={option.value}
                                                className="text-white hover:bg-gray-700"
                                              >
                                                {option.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Button
                                          onClick={() => {
                                            const newArrayFields = [...(dataType.arrayFields || [{ name: "x", type: "i" as const }, { name: "y", type: "i" as const }])];
                                            newArrayFields.splice(idx, 1);
                                            updateDataType(specIndex, dataType.id, {
                                              arrayFields: newArrayFields.length > 0 ? newArrayFields : [{ name: "field", type: "i" as const }]
                                            });
                                          }}
                                          size="sm"
                                          className="bg-red-500 hover:bg-red-600 text-white h-8 w-8 p-0"
                                          disabled={(dataType.arrayFields || [{ name: "x", type: "i" as const }, { name: "y", type: "i" as const }]).length <= 1}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))}
                                    <Button
                                      onClick={() => {
                                        const newArrayFields = [...(dataType.arrayFields || [{ name: "x", type: "i" as const }, { name: "y", type: "i" as const }]), { name: "newField", type: "i" as const }];
                                        updateDataType(specIndex, dataType.id, {
                                          arrayFields: newArrayFields,
                                        });
                                      }}
                                      size="sm"
                                      className="bg-green-500 hover:bg-green-600 text-white text-xs"
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add Field
                                    </Button>
                                    <div className="text-xs text-gray-400">
                                      [{dataType.arraySize || 100}] repetitions each
                                    </div>
                                  </div>
                                ) : (
                                  <Input
                                    value={dataType.description}
                                    onChange={(e) =>
                                      updateDataType(specIndex, dataType.id, {
                                        description: e.target.value,
                                      })
                                    }
                                    className="w-48 bg-gray-700 border-gray-600 text-white"
                                    placeholder="Field description"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  onClick={() =>
                                    removeDataTypeFromSpec(specIndex, dataType.id)
                                  }
                                  size="sm"
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                  disabled={spec.dataTypes.length === 1}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                            {dataType.isArrayField && (
                              <TableRow className="border-gray-600">
                                <TableCell colSpan={4}>
                                  <div className="bg-gray-700 p-3 rounded text-sm text-gray-300">
                                    <div className="font-medium mb-1">Array Field Preview:</div>
                                    <div className="text-gray-400">
                                      This creates indexed fields like:{" "}
                                      <code className="bg-gray-800 px-1 rounded">
                                        {(dataType.arrayFields || [{ name: "x", type: "i" as const }, { name: "y", type: "i" as const }]).map((field, idx) => 
                                          `${field.name}_0${idx < (dataType.arrayFields || [{ name: "x", type: "i" as const }, { name: "y", type: "i" as const }]).length - 1 ? ", " : ""}`
                                        ).join("")}, {(dataType.arrayFields || [{ name: "x", type: "i" as const }, { name: "y", type: "i" as const }]).map((field, idx) => 
                                          `${field.name}_1${idx < (dataType.arrayFields || [{ name: "x", type: "i" as const }, { name: "y", type: "i" as const }]).length - 1 ? ", " : ""}`
                                        ).join("")}, ...
                                      </code>
                                    </div>
                                    <div className="text-gray-400 mt-1">
                                      Total: {(dataType.arrayFields || [{ name: "x", type: "i" as const }, { name: "y", type: "i" as const }]).length} field{(dataType.arrayFields || [{ name: "x", type: "i" as const }, { name: "y", type: "i" as const }]).length !== 1 ? "s" : ""} × {dataType.arraySize || 100} repetitions = {(dataType.arrayFields || [{ name: "x", type: "i" as const }, { name: "y", type: "i" as const }]).length * (dataType.arraySize || 100)} total fields
                                    </div>
                                    <div className="text-gray-400 mt-1">
                                      Field types: {(dataType.arrayFields || [{ name: "x", type: "i" as const }, { name: "y", type: "i" as const }]).map(field => `${field.name}(${field.type})`).join(", ")}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

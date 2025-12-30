import React, { useState, useCallback, useRef } from "react";
import {
  saveToJson,
  loadBytesFromJsonAsync,
  load,
  type ResourceFork,
  type Result as RsrcResult,
} from "@lachlanbwwright/rsrcdump-ts";
import { type Result, isOk, isErr } from "../lib/result";
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
  X,
  AlertTriangle,
  Code,
} from "lucide-react";
import { useToast } from "../lib/toast";

// Import types from separate file
import type { 
  ParsedResult, 
  FourLetterCodeSpec, 
  DataTypeField, 
  DataTypeOption,
  StructDataType
} from "./resource-fork-parser/types";
import FourLetterCodeSpecification from "./resource-fork-parser/FourLetterCodeSpecification";
import { generateTypeScriptInterfaces } from "./resource-fork-parser/TypeScriptGenerator";

const DATA_TYPE_OPTIONS: DataTypeOption[] = [
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
];

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
    async (file: File): Promise<Result<FourLetterCodeSpec[], string>> => {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // Parse with default specs to get all available four-letter codes
      const jsonResult = await saveToJson(data, []);
      if (isErr(jsonResult as RsrcResult<string, string>)) {
        return { ok: false, error: `Failed to parse resource fork: ${(jsonResult as { error: string }).error}` };
      }

      // Parse JSON string to get the data
      let parsedData: Record<string, unknown>;
      try {
        parsedData = JSON.parse((jsonResult as { value: string }).value);
      } catch {
        return { ok: false, error: "Failed to parse JSON result" };
      }

      // Try to parse the raw resource fork to get raw data for each four-letter code
      const resourceForkResult = await load(data);
      const resourceFork: ResourceFork | null = isOk(resourceForkResult as RsrcResult<ResourceFork, string>) ? (resourceForkResult as { value: ResourceFork }).value : null;
      
      if (isErr(resourceForkResult as RsrcResult<ResourceFork, string>)) {
        console.warn("Could not parse resource fork for raw data:", (resourceForkResult as { error: string }).error);
        // Continue without raw data - not critical for functionality
      }

      // Extract unique four-letter codes from the result
      const fourLetterCodesSet = new Set<string>();

      if (parsedData && typeof parsedData === "object") {
        Object.keys(parsedData).forEach((key) => {
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

      // Create default specs for each four-letter code with raw data if available
      const defaultSpecs: FourLetterCodeSpec[] = Array.from(
        fourLetterCodesSet,
      ).map((fourCC) => {
        // Get the first resource's raw data for this four-letter code
        let rawData: Uint8Array | undefined;
        
        if (resourceFork && resourceFork.tree) {
          const typeResources = resourceFork.tree.get(fourCC);
          if (typeResources) {
            const firstResource = Array.from(typeResources.values())[0];
            if (firstResource) {
              rawData = firstResource.data;
            }
          }
        }

        return {
          fourCC,
          dataTypes: [{ id: "1", type: "i", count: 1, description: "field_1" }],
          isArray: false,
          autoPadding: false,
          status: "valid" as const,
          sampleData: null,
          hasUserDefinedSpec: false,
          rawData,
        };
      });

      return { ok: true, value: defaultSpecs };
    },
    [],
  );

  // Helper function to parse spec strings with proper handling of spaces, backticks, and special characters
  const parseSpecString = useCallback((specStr: string, nameTokens: string[], isArray: boolean): DataTypeField[] => {
    const dataTypes: DataTypeField[] = [];
    
    // Tokenize: split by spaces
    const tokens: string[] = [];
    let currentToken = "";
    let i = 0;
    
    while (i < specStr.length) {
      const char = specStr[i];
      
      if (char === ' ') {
        if (currentToken) {
          tokens.push(currentToken);
          currentToken = "";
        }
        i++;
      } else {
        currentToken += char;
        i++;
      }
    }
    if (currentToken) tokens.push(currentToken);
    
    // Process tokens
    let tokenIndex = 0;
    let fieldIndex = 1;
    let nameIndex = 0;
    
    while (tokenIndex < tokens.length) {
      const token = tokens[tokenIndex];
      
      // Regular token: 200f, x, 2x, x?, H, etc.
      const typeMatch = token.match(/^(\d+)?([A-Za-z])(\?)?$/);
      if (typeMatch) {
        const count = typeMatch[1] ? parseInt(typeMatch[1]) : 1;
        const type = typeMatch[2] as StructDataType;
        const isOptional = typeMatch[3] === '?';
        
        // Check if the current name token has a backtick array pattern
        const currentName = nameTokens[nameIndex];
        const backtickMatch = currentName?.match(/^([a-zA-Z_]+(?:`[a-zA-Z_]+)*)\[(\d+)\]$/);
        
        if (backtickMatch && (isArray && count > 10)) {
          // This is an array field pattern like x`y[100]
          const fieldNames = backtickMatch[1].split('`');
          const arraySize = parseInt(backtickMatch[2]);
          
          // The current token (e.g., "200f") defines the types for this array
          const arrayFields: Array<{ name: string; type: StructDataType }> = fieldNames.map(name => ({
            name: name.trim(),
            type,
          }));
          
          dataTypes.push({
            id: fieldIndex.toString(),
            type,
            count: 1,
            description: currentName,
            isArrayField: true,
            arraySize,
            arrayFields,
          });
          
          nameIndex++;
          fieldIndex++;
          tokenIndex++;
          continue;
        }
        
        // Handle padding/string types
        if (type === "s" || type === "p" || type === "x") {
          const desc = type === "x" 
            ? (isOptional ? "padding?" : "")
            : (nameTokens[nameIndex] || `field_${fieldIndex}`);
          
          if (type !== "x" || !isOptional) {
            dataTypes.push({
              id: fieldIndex.toString(),
              type,
              count,
              description: desc,
            });
            fieldIndex++;
          }
          
          if (type !== "x") nameIndex++;
        } else {
          // Regular data type
          if (isArray && count > 10) {
            // Large array - create single field
            dataTypes.push({
              id: fieldIndex.toString(),
              type,
              count,
              description: nameTokens[nameIndex] || `${type.toLowerCase()}_array`,
            });
            nameIndex++;
            fieldIndex++;
          } else {
            // Small count - create individual fields
            for (let j = 0; j < count; j++) {
              dataTypes.push({
                id: fieldIndex.toString(),
                type,
                count: 1,
                description: nameTokens[nameIndex] || `field_${fieldIndex}`,
              });
              nameIndex++;
              fieldIndex++;
            }
          }
        }
      }
      
      tokenIndex++;
    }
    
    return dataTypes.length > 0 ? dataTypes : [{
      id: "1",
      type: "i",
      count: 1,
      description: "field_1",
    }];
  }, []);

  const generateStructSpec = useCallback((spec: FourLetterCodeSpec): string => {
    let result = "";
    for (const dataType of spec.dataTypes) {
      if (dataType.isArrayField && dataType.arraySize && dataType.arrayFields) {
        // Handle array field like x`y[100] with individual types for each field
        const fieldSpecs = dataType.arrayFields
          .map((field) => field.type)
          .join(" ");
        const fieldNames = dataType.arrayFields
          .map((field) => field.name)
          .join("`");
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
  // TypeScript generator function moved to separate module - using imported generateTypeScriptInterfaces

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
      a.download = `${
        parsedResult.filename?.replace(/\.[^/.]+$/, "") || "resource-fork"
      }-types.ts`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      success({
        title: "TypeScript Downloaded",
        description:
          "TypeScript interface file has been generated and downloaded",
      });
    } catch (err) {
      console.error("Error generating TypeScript:", err);
      error({
        title: "Generation Failed",
        description: "Failed to generate TypeScript interfaces",
      });
    }
  }, [parsedResult, success, error]);

  const parseWithSpecs = useCallback(
    async (data: Uint8Array, specs: FourLetterCodeSpec[]): Promise<Result<{ result: unknown; updatedSpecs: FourLetterCodeSpec[] }, string>> => {
      // Create struct specs array for parsing
      const structSpecs = specs.map((spec: FourLetterCodeSpec) => {
        // Use raw Otto specification if available
        if (spec.rawOttoSpec) {
          // Return the raw specification directly, handling numbered prefixes
          return spec.rawOttoSpec.replace(/^\d+\./, '');
        }
        
        const specStr = generateStructSpec(spec);
        const description = spec.dataTypes
          .map((dt) => dt.description)
          .join(",");
        return `${spec.fourCC}:${specStr}:${description}`;
      });

      const jsonResult = await saveToJson(data, structSpecs);
      
      if (isErr(jsonResult as RsrcResult<string, string>)) {
        return { ok: false, error: `Failed to parse resource fork: ${(jsonResult as { error: string }).error}` };
      }

      // Parse JSON string
      let parsedResult: unknown;
      try {
        parsedResult = JSON.parse((jsonResult as { value: string }).value);
      } catch {
        return { ok: false, error: "Failed to parse JSON result" };
      }

      // Update specs with sample data and validation status
      const updatedSpecs = specs.map((spec) => {
        const sampleData =
          parsedResult && typeof parsedResult === "object" && (parsedResult as Record<string, unknown>)[spec.fourCC] ? (parsedResult as Record<string, unknown>)[spec.fourCC] : null;

        let status: "valid" | "error" | "warning" = "error";
        let statusMessage = "Failed to parse data";

        if (sampleData) {
          if (Array.isArray(sampleData) && sampleData.length > 0) {
            status = "valid";
            statusMessage = `Successfully parsed ${sampleData.length} items`;
          } else if (
            typeof sampleData === "object" &&
            Object.keys(sampleData as Record<string, unknown>).length > 0
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

      return { ok: true, value: { result: parsedResult, updatedSpecs } };
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

      // Extract four-letter codes automatically
      const extractedResult = await extractFourLetterCodes(file);
      if (isErr(extractedResult)) {
        setParseError(extractedResult.error);
        setParsedResult({
          success: false,
          error: extractedResult.error,
          filename: file.name,
        });
        setIsProcessing(false);
        return;
      }

      const extractedSpecs = extractedResult.value;
      setFourLetterCodes(extractedSpecs);

      // Parse with default specs to show initial samples
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const parseResult = await parseWithSpecs(data, extractedSpecs);

      if (isErr(parseResult)) {
        setParseError(parseResult.error);
        setParsedResult({
          success: false,
          error: parseResult.error,
          filename: file.name,
        });
        setIsProcessing(false);
        return;
      }

      const { result, updatedSpecs } = parseResult.value;
      setFourLetterCodes(updatedSpecs);
      setCurrentFile(file);

      if (result) {
        setParsedResult({
          success: true,
          data: result,
          filename: file.name,
        });
      }
      
      setIsProcessing(false);
    },
    [extractFourLetterCodes, parseWithSpecs],
  );

  // Re-parse when specs change
  const reParseWithUpdatedSpecs = useCallback(
    async (updatedSpecs: FourLetterCodeSpec[]) => {
      if (!currentFile) return;

      const arrayBuffer = await currentFile.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const parseResult = await parseWithSpecs(data, updatedSpecs);

      if (isErr(parseResult)) {
        console.error("Error re-parsing:", parseResult.error);
        return;
      }

      const { result, updatedSpecs: newSpecs } = parseResult.value;
      setFourLetterCodes(newSpecs);

      if (result) {
        setParsedResult({
          success: true,
          data: result,
          filename: currentFile.name,
        });
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
          { name: "y", type: "i" as const },
        ], // Default to x and y with integer types
      });
      setFourLetterCodes(updatedSpecs);
      reParseWithUpdatedSpecs(updatedSpecs);

      info({
        title: "Array Field Added",
        description:
          "Added an array field. Configure the field names and size.",
      });
    },
    [fourLetterCodes, reParseWithUpdatedSpecs, info],
  );

  // Parse specification string into FourLetterCodeSpec format (unused - kept for reference)
  /*
  const parseSpecificationString = useCallback((line: string): FourLetterCodeSpec => {
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
      // Check for array field pattern like x`y[100]
      const arrayFieldMatch = specStr
        .slice(currentIndex)
        .match(/^([a-zA-Z_]+(?:`[a-zA-Z_]+)*)\[(\d+)\]/);
        
      if (arrayFieldMatch) {
        const fieldNames = arrayFieldMatch[1].split('`');
        const arraySize = parseInt(arrayFieldMatch[2]);
        currentIndex += arrayFieldMatch[0].length;
        
        // Create array field
        const arrayFields = fieldNames.map(name => ({
          name: name.trim(),
          type: "f" as StructDataType, // Default to float for array fields
        }));
        
        dataTypes.push({
          id: fieldIndex.toString(),
          type: "f" as StructDataType,
          count: 1,
          description: nameTokens[nameIndex] || `array_${fieldIndex}`,
          isArrayField: true,
          arraySize: arraySize,
          arrayFields: arrayFields,
        });
        
        nameIndex++;
        fieldIndex++;
        continue;
      }

      const match = specStr.slice(currentIndex).match(/^(\d+)([A-Za-z])/);
      if (match) {
        const count = parseInt(match[1]);
        const type = match[2];
        currentIndex += match[0].length;

        if (type === "s" || type === "p" || type === "x") {
          // Skip string/padding types in the display
          continue;
        }

        dataTypes.push({
          id: fieldIndex.toString(),
          type: type as StructDataType,
          count: count,
          description: nameTokens[nameIndex] || `field_${fieldIndex}`,
        });
        nameIndex++;
      } else {
        // Single character type
        const type = specStr[currentIndex];
        
        if (type === "s" || type === "p" || type === "x") {
          currentIndex++;
          continue;
        }

        if (type && type.match(/[A-Za-z]/)) {
          dataTypes.push({
            id: fieldIndex.toString(),
            type: type as StructDataType,
            count: 1,
            description: nameTokens[nameIndex] || `field_${fieldIndex}`,
          });
          nameIndex++;
        }
        currentIndex++;
      }
      fieldIndex++;
    }

    // If no data types were parsed, add a default one
    if (dataTypes.length === 0) {
      dataTypes.push({
        id: "1",
        type: "i" as StructDataType,
        count: 1,
        description: "field_1",
      });
    }

    return {
      fourCC,
      dataTypes,
      isArray,
      autoPadding: false,
      status: "valid" as const,
      sampleData: null,
    };
  }, []);
  */

  // Load Otto specifications for EarthFarm sample (unused - kept for reference)
  /*
  const loadOttoSpecifications = useCallback((): FourLetterCodeSpec[] => {
    // Use Otto specifications as-is with raw strings, 
    // let the parseWithSpecs function handle the actual parsing
    return ottoMaticSpecs.map(specString => {
      const parts = specString.split(":");
      const fourCC = parts[0];
      
      // Create a minimal spec that will use the raw Otto string during parsing
      return {
        fourCC,
        dataTypes: [{ id: "1", type: "i" as StructDataType, count: 1, description: "placeholder" }],
        isArray: false,
        autoPadding: false,
        status: "valid" as const,
        sampleData: null,
        rawOttoSpec: specString, // This will be used by parseWithSpecs
      };
    });
  }, []);
  */

  // Load EarthFarm sample file
  const loadEarthFarmSample = useCallback(async () => {
    setParseError("");
    setIsProcessing(true);

    try {
      // Try fetching with the correct base path for the current environment
      const basePath = import.meta.env.DEV ? '' : '/mac-online-resource-fork-parser';
      
      const response = await fetch(`${basePath}/test-files/EarthFarm.ter.rsrc`);
      if (!response.ok) {
        throw new Error("Failed to load EarthFarm sample file");
      }

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const file = new File([data], "EarthFarm.ter.rsrc");

      // Load otto-specs.txt content and parse it the same way as handleSpecUpload
      const specResponse = await fetch(`${basePath}/test-files/otto-specs.txt`);
      let ottoSpecifications: FourLetterCodeSpec[] = [];
      
      if (specResponse.ok) {
        const text = await specResponse.text();
        const lines = text.split("\n").filter((line) => line.trim());

        ottoSpecifications = lines.map((line) => {
          // Handle numbered format like "1.Hedr:L5i3f5i40x:version,numItems,..."
          const cleanLine = line.replace(/^\d+\./, ''); // Remove number prefix
          const parts = cleanLine.split(":");
          const fourCC = parts[0];
          const structSpec = parts[1] || "";
          const namesPart = parts.slice(2).join(":") || "";
          
          // Use the same parsing logic as handleSpecUpload
          const nameTokens = namesPart
            ? namesPart.split(",").map((s) => s.trim())
            : [];

          const rawSpec = structSpec || "";
          const isArray = rawSpec.endsWith("+");
          const specStr = isArray ? rawSpec.slice(0, -1) : rawSpec;

          // Use the helper function to parse the spec string
          const dataTypes = parseSpecString(specStr, nameTokens, isArray);

          return {
            fourCC,
            dataTypes,
            isArray,
            autoPadding: false,
            status: "valid" as const,
            sampleData: null,
            rawOttoSpec: cleanLine, // Store the full raw specification line
            hasUserDefinedSpec: true, // Specs from file are user-defined
          };
        });
      }

      // Extract four-letter codes from the file
      const extractedResult = await extractFourLetterCodes(file);
      
      if (isErr(extractedResult)) {
        setParseError(extractedResult.error);
        setParsedResult({
          success: false,
          error: extractedResult.error,
          filename: "EarthFarm.ter.rsrc",
        });
        setIsProcessing(false);
        return;
      }

      const extractedSpecs = extractedResult.value;
      
      // Merge Otto specifications with extracted specifications
      const finalSpecs = extractedSpecs.map(extracted => {
        const ottoSpec = ottoSpecifications.find(otto => otto.fourCC === extracted.fourCC);
        // If we have an Otto spec, use it but preserve rawData from extracted spec
        if (ottoSpec) {
          return { ...ottoSpec, rawData: extracted.rawData };
        }
        return extracted; // Use extracted default with rawData
      });

      // Parse with the final merged specifications
      const parseResult = await parseWithSpecs(data, finalSpecs);

      if (isErr(parseResult)) {
        setParseError(parseResult.error);
        setParsedResult({
          success: false,
          error: parseResult.error,
          filename: "EarthFarm.ter.rsrc",
        });
        setIsProcessing(false);
        return;
      }

      const { result, updatedSpecs } = parseResult.value;
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
  }, [extractFourLetterCodes, parseSpecString, parseWithSpecs]);

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

        const rsrcResult = await loadBytesFromJsonAsync(jsonData, structSpecs);
        
        if (isErr(rsrcResult as RsrcResult<Uint8Array, string>)) {
          setParseError((rsrcResult as { error: string }).error);
          setIsProcessing(false);
          return;
        }

        // Download as .rsrc file
        const rsrcData = (rsrcResult as { value: Uint8Array }).value;
        const blob = new Blob([rsrcData], {
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
        description: "Resource fork data has been exported to JSON",
      });
    } catch {
      error({
        title: "Download Failed",
        description: "Failed to generate JSON file",
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
        description: "Struct specifications have been exported to text file",
      });
    } catch {
      error({
        title: "Save Failed",
        description: "Failed to generate specifications file",
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
          // Handle numbered format like "1.Hedr:L5i3f5i40x:version,numItems,..."
          const cleanLine = line.replace(/^\d+\./, ''); // Remove number prefix
          const parts = cleanLine.split(":");
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

          // Use the helper function to parse the spec string
          const dataTypes = parseSpecString(specStr, nameTokens, isArray);

          // Find existing spec to preserve rawData
          const existingSpec = fourLetterCodes.find(s => s.fourCC === fourCC);

          return {
            fourCC,
            dataTypes,
            isArray,
            autoPadding: false,
            status: "valid" as const,
            sampleData: null,
            rawOttoSpec: cleanLine, // Store the full raw specification line
            hasUserDefinedSpec: true, // Specs from file are user-defined
            rawData: existingSpec?.rawData, // Preserve raw data if available
          };
        });

        setFourLetterCodes(loadedSpecs);
        reParseWithUpdatedSpecs(loadedSpecs);
      } catch {
        setParseError("Failed to load specifications file");
      }
    },
    [fourLetterCodes, parseSpecString, reParseWithUpdatedSpecs],
  );

  // Function removed - now using StatusIcon component

  // Function removed - now using SampleDataDisplay component

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
              This application is under active development. Features may be
              incomplete, and parsing results should be verified. Use with
              caution for production data.
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
                <FourLetterCodeSpecification
                  key={spec.fourCC}
                  spec={spec}
                  specIndex={specIndex}
                  updateFourLetterCodeSpec={updateFourLetterCodeSpec}
                  addDataTypeToSpec={addDataTypeToSpec}
                  addArrayFieldToSpec={addArrayFieldToSpec}
                  removeDataTypeFromSpec={removeDataTypeFromSpec}
                  updateDataType={updateDataType}
                  dataTypeOptions={DATA_TYPE_OPTIONS}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

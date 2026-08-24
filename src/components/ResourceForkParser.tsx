import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import {
  Upload,
  Download,
  FileText,
  Settings,
  X,
  Code,
  FileJson,
  Edit3,
  Package,
  PackageOpen,
  Database,
  Search,
} from "lucide-react";
import { useToast } from "../lib/toast";

// Import types from separate file
import type { 
  ParsedResult, 
  FourLetterCodeSpec, 
  DataTypeField, 
  DataTypeOption
} from "./resource-fork-parser/types";
import FourLetterCodeSpecification from "./resource-fork-parser/FourLetterCodeSpecification";
import { generateTypeScriptInterfacesFromSpecs } from "./resource-fork-parser/TypeScriptGenerator";
import DataBrowser from "./resource-fork-parser/DataBrowser";
import { parseSpecString } from "./resource-fork-parser/spec-model";
import { defaultStructSpecStrings, getDefaultResourceSpec } from "./resource-fork-parser/default-specs";
import { applyKnownDecoders, CUSTOM_DECODER_TYPES } from "./resource-fork-parser/default-resource-decoders";

// Regex to remove numbered prefixes from Otto spec lines (e.g., "1.Hedr:" -> "Hedr:")
const OTTO_SPEC_NUMBER_PREFIX_REGEX = /^\d+\./;

type SampleDefinition = {
  id: string;
  name: string;
  filename: string;
  path: string;
  description: string;
  source: string;
  category: "Game data" | "Applications" | "Icons" | "Projects";
  specsPath?: string;
};

function StatusPill({ status }: { status: FourLetterCodeSpec["status"] }) {
  const color = status === "valid" ? "bg-emerald-400" : status === "error" ? "bg-red-400" : "bg-amber-400";
  return <span aria-label={status} className={`h-1.5 w-1.5 rounded-full ${color}`} />;
}

const SAMPLE_DEFINITIONS: SampleDefinition[] = [
  {
    id: "otto-matic-level-1",
    name: "Otto Matic — Level 1 Data",
    filename: "EarthFarm.ter.rsrc",
    path: "/test-files/EarthFarm.ter.rsrc",
    specsPath: "/test-files/otto-specs.txt",
    description: "Level data from Otto Matic with the bundled Otto struct definitions.",
    source: "Otto Matic",
    category: "Game data",
  },
  {
    id: "dialog",
    name: "Dialog",
    filename: "Dialog.rsrc",
    path: "/test-files/retro68/Dialog.rsrc",
    description: "A small classic Mac dialog application resource fork.",
    source: "Retro68 sample",
    category: "Applications",
  },
  {
    id: "wdef-shell",
    name: "WDEF Shell",
    filename: "WDEFShell.rsrc",
    path: "/test-files/retro68/WDEFShell.rsrc",
    description: "A window-definition sample with menus, strings, and custom WDEF resources.",
    source: "Retro68 sample",
    category: "Applications",
  },
  {
    id: "raytracer",
    name: "Raytracer",
    filename: "Raytracer.rsrc",
    path: "/test-files/retro68/Raytracer.rsrc",
    description: "A compact 68K application resource fork with code and relocation data.",
    source: "Retro68 sample",
    category: "Applications",
  },
  {
    id: "raytracer-2",
    name: "Raytracer 2",
    filename: "Raytracer2.rsrc",
    path: "/test-files/retro68/Raytracer2.rsrc",
    description: "The C++ variant of the Raytracer sample with a larger resource map.",
    source: "Retro68 sample",
    category: "Applications",
  },
  {
    id: "retro68-system-extension-icons",
    name: "Retro68 — System Extension Icons",
    filename: "Retro68-SystemExtension.rsrc",
    path: "/test-files/opensource/Retro68-SystemExtension.rsrc",
    description: "A compact icon resource fork containing ICN#, icl4, icl8, ics#, ics4, and ics8 resources.",
    source: "Retro68 SystemExtension sample",
    category: "Icons",
  },
  {
    id: "rezilla-plugin-icon",
    name: "Rezilla — Plugin Icon Resource",
    filename: "RezillaPlugin.icns.rsrc",
    path: "/test-files/opensource/RezillaPlugin.icns.rsrc",
    description: "An icon-suite resource fork from the open-source Rezilla resource editor.",
    source: "Rezilla",
    category: "Icons",
  },
  {
    id: "reckless-drivin-data",
    name: "Reckless Drivin' — Game Data",
    filename: "RecklessDrivin.Data.rsrc",
    path: "/test-files/opensource/RecklessDrivin.Data.rsrc",
    description: "The original game's resource data: packed game assets, QuickDraw pictures, and a checksum resource.",
    source: "Reckless Drivin' source release",
    category: "Game data",
  },
  {
    id: "glider-bw-art",
    name: "Glider 4.0 — B&W Art",
    filename: "Glider-BW-Art.rsrc",
    path: "/test-files/opensource/glider/Glider-BW-Art.rsrc",
    description: "Fifteen black-and-white QuickDraw pictures from the open-source Glider 4.0 project.",
    source: "Glider 4.0",
    category: "Game data",
  },
  {
    id: "glider-color-art",
    name: "Glider 4.0 — Color Art",
    filename: "Glider-Color-Art.rsrc",
    path: "/test-files/opensource/glider/Glider-Color-Art.rsrc",
    description: "Fifteen color QuickDraw pictures from the open-source Glider 4.0 project.",
    source: "Glider 4.0",
    category: "Game data",
  },
  {
    id: "glider-project",
    name: "Glider 4.0 — Project Resources",
    filename: "Glider-Project.rsrc",
    path: "/test-files/opensource/glider/Glider-Project.rsrc",
    description: "A Think Pascal project resource fork with project metadata, code, data, and segment resources.",
    source: "Glider 4.0",
    category: "Projects",
  },
];

const DATA_TYPE_OPTIONS: DataTypeOption[] = [
  { value: "L", label: "L - Unsigned Long (4 bytes)" },
  { value: "l", label: "l - Signed Long (4 bytes)" },
  { value: "i", label: "i - Signed Int (4 bytes)" },
  { value: "I", label: "I - Unsigned Int (4 bytes)" },
  { value: "h", label: "h - Signed Short (2 bytes)" },
  { value: "H", label: "H - Unsigned Short (2 bytes)" },
  { value: "f", label: "f - Float (4 bytes)" },
  { value: "B", label: "B - Unsigned Byte (1 byte)" },
  { value: "b", label: "b - Signed Byte (1 byte)" },
  { value: "?", label: "? - Boolean (1 byte)" },
  { value: "x", label: "x - Padding Byte (1 byte)" },
  { value: "s", label: "s - String" },
  { value: "p", label: "p - Pascal String" },
];

function parseOttoSpecs(text: string): FourLetterCodeSpec[] {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const cleanLine = line.replace(OTTO_SPEC_NUMBER_PREFIX_REGEX, "");
      const parts = cleanLine.split(":");
      const fourCC = parts[0];
      const structSpec = parts[1] || "";
      const namesPart = parts.slice(2).join(":") || "";
      const nameTokens = namesPart
        ? namesPart.split(",").map((value) => value.trim())
        : [];
      const isArray = structSpec.endsWith("+");
      const specStr = isArray ? structSpec.slice(0, -1) : structSpec;

      return {
        fourCC,
        dataTypes: parseSpecString(specStr, nameTokens),
        isArray,
        autoPadding: false,
        status: "valid" as const,
        sampleData: null,
        rawOttoSpec: cleanLine,
        hasUserDefinedSpec: true,
      };
    });
}

export default function ResourceForkParser() {
  const { success, error, warning, info } = useToast();
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [fourLetterCodes, setFourLetterCodes] = useState<FourLetterCodeSpec[]>(
    [],
  );
  const [parseError, setParseError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [viewMode, setViewMode] = useState<"specs" | "data">("specs");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [sampleQuery, setSampleQuery] = useState("");
  const [sampleCategory, setSampleCategory] = useState<SampleDefinition["category"] | "All">("All");
  const [selectedSpecIndex, setSelectedSpecIndex] = useState(0);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const specFileInputRef = useRef<HTMLInputElement>(null);

  const filteredSamples = useMemo(() => {
    const query = sampleQuery.trim().toLowerCase();
    return SAMPLE_DEFINITIONS.filter((sample) => {
      const matchesCategory = sampleCategory === "All" || sample.category === sampleCategory;
      const matchesQuery = !query || `${sample.name} ${sample.description} ${sample.source} ${sample.filename}`.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [sampleCategory, sampleQuery]);

  useEffect(() => {
    if (selectedSpecIndex >= fourLetterCodes.length) setSelectedSpecIndex(0);
  }, [fourLetterCodes.length, selectedSpecIndex]);

  // Extract four-letter codes from uploaded file and set default specs
  const extractFourLetterCodes = useCallback(
    async (file: File): Promise<Result<FourLetterCodeSpec[], string>> => {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // Parse with default specs to get all available four-letter codes
      const jsonResult = await saveToJson(data, defaultStructSpecStrings());
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
      applyKnownDecoders(parsedData, resourceFork ?? {});
      
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
            /^[\x20-\x7e]{4}$/.test(key) &&
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

        const inferredSpec = getDefaultResourceSpec(fourCC);
        return {
          fourCC,
          dataTypes: inferredSpec
            ? inferredSpec.fields.map((field, index) => ({ id: String(index + 1), ...field }))
            : [{ id: "1", type: "i", count: 1, description: "field_1" }],
          isArray: inferredSpec?.isArray ?? false,
          autoPadding: false,
          status: "valid" as const,
          sampleData: null,
          hasUserDefinedSpec: false,
          isInferredSpec: Boolean(inferredSpec),
          rawData,
        };
      });

      return { ok: true, value: defaultSpecs };
    },
    [],
  );

  const generateStructSpec = useCallback((spec: FourLetterCodeSpec): string => {
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
        // Array field like x`y[100] - output the count (total values)
        result += `${dataType.count}${dataType.type}`;
      } else if (dataType.count > 1) {
        // Regular field with count > 1
        result += `${dataType.count}${dataType.type}`;
      } else {
        // Single field (including boolean ? type)
        result += dataType.type;
      }
    }
    return result + (spec.isArray ? "+" : "");
  }, []);

  // Generate TypeScript interfaces from parsed data
  // TypeScript generator function moved to separate module - using imported generateTypeScriptInterfaces

  // Download TypeScript interfaces
  const downloadTypeScript = useCallback(() => {
    if (fourLetterCodes.length === 0) {
      error("No specifications available for TypeScript generation");
      return;
    }

    try {
      const tsContent = generateTypeScriptInterfacesFromSpecs(fourLetterCodes);
      const blob = new Blob([tsContent], { type: "text/typescript" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${
        parsedResult?.filename?.replace(/\.[^/.]+$/, "") || "resource-fork"
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
  }, [fourLetterCodes, parsedResult, success, error]);

  const parseWithSpecs = useCallback(
    async (data: Uint8Array, specs: FourLetterCodeSpec[]): Promise<Result<{ result: unknown; updatedSpecs: FourLetterCodeSpec[] }, string>> => {
      // Create struct specs array for parsing
      const structSpecs = specs.map((spec: FourLetterCodeSpec) => {
        if (CUSTOM_DECODER_TYPES.has(spec.sourceFourCC || spec.fourCC)) return null;
        // Use raw Otto specification if available
        if (spec.rawOttoSpec) {
          // Return the raw specification directly, handling numbered prefixes
          const rawSpec = spec.rawOttoSpec.replace(OTTO_SPEC_NUMBER_PREFIX_REGEX, '');
          return spec.sourceFourCC ? rawSpec.replace(/^[^:]+/, spec.sourceFourCC) : rawSpec;
        }
        
        const specStr = generateStructSpec(spec);
        const description = spec.dataTypes
          .map((dt) => dt.description)
          .join(",");
        return `${spec.sourceFourCC || spec.fourCC}:${specStr}:${description}`;
      }).filter((spec): spec is string => Boolean(spec));

      const jsonResult = await saveToJson(data, structSpecs);
      
      if (isErr(jsonResult as RsrcResult<string, string>)) {
        return { ok: false, error: `Failed to parse resource fork: ${(jsonResult as { error: string }).error}` };
      }

      // Parse JSON string
      let parsedResult: unknown;
      try {
        parsedResult = JSON.parse((jsonResult as { value: string }).value);
        const resourceForkResult = await load(data);
        if (isOk(resourceForkResult as RsrcResult<ResourceFork, string>)) {
          applyKnownDecoders(parsedResult, (resourceForkResult as { value: ResourceFork }).value);
        }
      } catch {
        return { ok: false, error: "Failed to parse JSON result" };
      }

      // A renamed code is parsed from its original source type, then exposed
      // under the new name so later edits and packing retain the rename.
      if (parsedResult && typeof parsedResult === "object") {
        const resultObject = parsedResult as Record<string, unknown>;
        for (const spec of specs) {
          if (spec.sourceFourCC && spec.sourceFourCC !== spec.fourCC && resultObject[spec.sourceFourCC] !== undefined) {
            const renamedResult = Object.fromEntries(
              Object.entries(resultObject).filter(([key]) => key !== spec.sourceFourCC),
            );
            Object.assign(resultObject, renamedResult, { [spec.fourCC]: resultObject[spec.sourceFourCC] });
          }
        }
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
  const updateFourCC = useCallback(
    (index: number, nextFourCC: string) => {
      if (!/^[\x20-\x7e]{4}$/.test(nextFourCC)) {
        error("Four-letter codes must contain exactly four printable characters");
        return;
      }

      const existing = fourLetterCodes[index];
      if (!existing || fourLetterCodes.some((spec, specIndex) => specIndex !== index && spec.fourCC === nextFourCC)) {
        error(`Four-letter code ${nextFourCC} is already in use`);
        return;
      }

      const updatedSpecs = fourLetterCodes.map((spec, specIndex) =>
        specIndex === index
          ? {
              ...spec,
              fourCC: nextFourCC,
              sourceFourCC: spec.sourceFourCC || spec.fourCC,
              rawOttoSpec: undefined,
              hasUserDefinedSpec: true,
            }
          : spec,
      );
      const oldFourCC = existing.fourCC;

      if (parsedResult?.data && typeof parsedResult.data === "object") {
        const currentData = parsedResult.data as Record<string, unknown>;
        if (currentData[oldFourCC] !== undefined) {
          const updatedData = Object.fromEntries([
            ...Object.entries(currentData).filter(([key]) => key !== oldFourCC),
            [nextFourCC, currentData[oldFourCC]],
          ]);
          setParsedResult({ ...parsedResult, data: updatedData });
        }
      }

      setFourLetterCodes(updatedSpecs);
      setHasUnsavedChanges(true);
    },
    [fourLetterCodes, parsedResult, error],
  );

  const updateFourLetterCodeSpec = useCallback(
    (index: number, updates: Partial<FourLetterCodeSpec>) => {
      const updatedSpecs = [...fourLetterCodes];
      const changesStructure = "dataTypes" in updates || "isArray" in updates || "autoPadding" in updates;
      updatedSpecs[index] = {
        ...updatedSpecs[index],
        ...updates,
        ...(changesStructure ? { rawOttoSpec: undefined, hasUserDefinedSpec: true } : {}),
      };
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
      updatedSpecs[specIndex] = {
        ...updatedSpecs[specIndex],
        rawOttoSpec: undefined,
        hasUserDefinedSpec: true,
        dataTypes: [...updatedSpecs[specIndex].dataTypes, {
        id: newId,
        type: "i",
        count: 1,
        description: `field_${newId}`,
        }],
      };
      setFourLetterCodes(updatedSpecs);
      reParseWithUpdatedSpecs(updatedSpecs);
    },
    [fourLetterCodes, reParseWithUpdatedSpecs],
  );

  // Remove data type from spec
  const removeDataTypeFromSpec = useCallback(
    (specIndex: number, dataTypeId: string) => {
      const updatedSpecs = [...fourLetterCodes];
      updatedSpecs[specIndex] = {
        ...updatedSpecs[specIndex], rawOttoSpec: undefined, hasUserDefinedSpec: true,
        dataTypes: updatedSpecs[specIndex].dataTypes.filter((dt) => dt.id !== dataTypeId),
      };
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
        // Ensure count is at least 1
        if (!merged.count || merged.count < 1) {
          merged.count = 1;
        }

        updatedSpecs[specIndex] = {
          ...updatedSpecs[specIndex], rawOttoSpec: undefined, hasUserDefinedSpec: true,
          dataTypes: updatedSpecs[specIndex].dataTypes.map((field, index) => index === dataTypeIndex ? merged : field),
        };
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
      updatedSpecs[specIndex] = {
        ...updatedSpecs[specIndex], rawOttoSpec: undefined, hasUserDefinedSpec: true,
        dataTypes: [...updatedSpecs[specIndex].dataTypes, {
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
        }],
      };
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

  const loadSample = useCallback(async (sample: SampleDefinition, withStructData: boolean) => {
    setParseError("");
    setIsProcessing(true);

    try {
      const basePath = import.meta.env.DEV ? "" : "/mac-online-resource-fork-parser";
      const response = await fetch(`${basePath}${sample.path}`);
      if (!response.ok) throw new Error(`Failed to load ${sample.name}`);

      const data = new Uint8Array(await response.arrayBuffer());
      const file = new File([data], sample.filename);
      const extractedResult = await extractFourLetterCodes(file);

      if (isErr(extractedResult)) throw new Error(extractedResult.error);

      let providedSpecs: FourLetterCodeSpec[] = [];
      if (withStructData && sample.specsPath) {
        const specResponse = await fetch(`${basePath}${sample.specsPath}`);
        if (specResponse.ok) providedSpecs = parseOttoSpecs(await specResponse.text());
      }

      const finalSpecs = extractedResult.value.map((extracted) => {
        const providedSpec = providedSpecs.find((spec) => spec.fourCC === extracted.fourCC);
        return providedSpec ? { ...providedSpec, rawData: extracted.rawData } : extracted;
      });
      const parseResult = await parseWithSpecs(data, finalSpecs);

      if (isErr(parseResult)) throw new Error(parseResult.error);

      const { result, updatedSpecs } = parseResult.value;
      setFourLetterCodes(updatedSpecs);
      setCurrentFile(file);
      setParsedResult({
        success: true,
        data: result,
        filename: sample.filename,
      });

      if (!withStructData) {
        info({
          title: "Sample Loaded",
          description: `${sample.name} loaded without bundled struct data.`,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `Failed to load ${sample.name}`;
      setParseError(errorMessage);
      setParsedResult({ success: false, error: errorMessage, filename: sample.filename });
    } finally {
      setIsProcessing(false);
    }
  }, [extractFourLetterCodes, parseWithSpecs, info]);

  const loadSampleAndBrowse = useCallback(async (sample: SampleDefinition, withStructData: boolean) => {
    await loadSample(sample, withStructData);
    setViewMode("data");
    setTimeout(() => {
      document.querySelector('[data-testid="data-browser"]')?.scrollIntoView({ behavior: "auto", block: "start" });
    }, 100);
  }, [loadSample]);

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
          // Filter out regular padding from descriptions
          const description = spec.dataTypes
            .filter((dt) => !dt.isPadding)
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
          const cleanLine = line.replace(OTTO_SPEC_NUMBER_PREFIX_REGEX, ''); // Remove number prefix
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
          const dataTypes = parseSpecString(specStr, nameTokens);

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
    [fourLetterCodes, reParseWithUpdatedSpecs],
  );

  // Handle data change from DataBrowser
  const handleDataChange = useCallback(
    (fourCC: string, resourceId: string, newData: Record<string, unknown>) => {
      if (!parsedResult?.data) return;
      
      const currentData = parsedResult.data as Record<string, Record<string, { obj?: Record<string, unknown> }>>;
      const updatedData = { ...currentData };
      
      if (updatedData[fourCC] && updatedData[fourCC][resourceId]) {
        updatedData[fourCC] = {
          ...updatedData[fourCC],
          [resourceId]: {
            ...updatedData[fourCC][resourceId],
            obj: newData
          }
        };
      }
      
      setParsedResult({
        ...parsedResult,
        data: updatedData
      });
      setHasUnsavedChanges(true);
      
      info({
        title: "Data Modified",
        description: `Updated ${fourCC}/${resourceId}. Use "Pack to RSRC" to save changes.`,
      });
    },
    [parsedResult, info]
  );

  const handleResourceDataChange = useCallback(
    (fourCC: string, resourceId: string, hex: string) => {
      if (!parsedResult?.data) return;
      const currentData = parsedResult.data as Record<string, Record<string, { data?: string }>>;
      const resource = currentData[fourCC]?.[resourceId];
      if (!resource) return;
      setParsedResult({
        ...parsedResult,
        data: {
          ...currentData,
          [fourCC]: { ...currentData[fourCC], [resourceId]: { ...resource, data: hex } },
        },
      });
      setHasUnsavedChanges(true);
      info({ title: "Resource bytes modified", description: `Updated ${fourCC}/${resourceId}. Use “Pack to RSRC” to save changes.` });
    },
    [parsedResult, info],
  );

  // Pack edited data back to RSRC file
  const packToRsrc = useCallback(async () => {
    if (!parsedResult?.data) {
      error("No parsed data available for packing");
      return;
    }

    setIsProcessing(true);
    
    try {
      // Create struct specs array for packing
      const structSpecs = fourLetterCodes.map((spec: FourLetterCodeSpec) => {
        if (spec.rawOttoSpec) {
          const rawSpec = spec.rawOttoSpec.replace(OTTO_SPEC_NUMBER_PREFIX_REGEX, '');
          return spec.sourceFourCC ? rawSpec.replace(/^[^:]+/, spec.sourceFourCC) : rawSpec;
        }
        
        const specStr = generateStructSpec(spec);
        const description = spec.dataTypes
          .map((dt) => dt.description)
          .join(",");
        return `${spec.fourCC}:${specStr}:${description}`;
      });

      const rsrcResult = await loadBytesFromJsonAsync(parsedResult.data, structSpecs);
      
      if (isErr(rsrcResult as RsrcResult<Uint8Array, string>)) {
        const errMsg = (rsrcResult as { error: string }).error;
        error({
          title: "Pack Failed",
          description: errMsg,
        });
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
      const originalName = currentFile?.name || parsedResult.filename || "resource";
      const baseName = originalName.replace(/\.[^/.]+$/, "");
      a.download = `${baseName}-edited.rsrc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setHasUnsavedChanges(false);
      success({
        title: "RSRC Packed",
        description: "Resource fork file has been packed and downloaded",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to pack data";
      error({
        title: "Pack Failed",
        description: errorMessage,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [parsedResult, fourLetterCodes, generateStructSpec, currentFile, success, error]);

  // Function removed - now using StatusIcon component

  // Function removed - now using SampleDataDisplay component

  // Check if data is loaded
  const hasDataLoaded = currentFile !== null || parsedResult?.success;
  
  // Extract data for DataBrowser (avoiding unknown type in JSX)
  const browserData = parsedResult?.data as Record<string, unknown> | undefined;

  const fileName = currentFile?.name || parsedResult?.filename || 'Resource Fork';

  const clearLoadedFile = () => {
    setCurrentFile(null);
    setParsedResult(null);
    setFourLetterCodes([]);
    setParseError("");
    setViewMode("specs");
    setHasUnsavedChanges(false);
    setShowCloseConfirmation(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px] space-y-5">
        {/* Main Control Panel */}
        <Card className="border-0 bg-transparent shadow-none">
          {!hasDataLoaded ? (
            <div className="space-y-10 border-b border-gray-800 pb-10 pt-4">
              <div className="flex flex-col gap-6 border-b border-gray-800 pb-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.08]">
                    Mac Resource Fork Parser
                  </h1>
                  <p className="mt-5 max-w-xl text-lg leading-8 text-gray-400">
                    Open a <code className="text-gray-300">.rsrc</code> file to inspect,
                    edit, and export its resource data.
                  </p>
                </div>
                <Input
                  type="file"
                  accept=".rsrc"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-11 justify-center gap-2 bg-blue-600 px-5 text-white hover:bg-blue-500"
                  disabled={isProcessing}
                  size="lg"
                >
                  <Upload className="h-5 w-5" />
                  Upload .rsrc File
                </Button>
              </div>

              <section aria-labelledby="samples-heading">
                <div className="mb-4 flex items-baseline justify-between gap-4">
                  <div>
                    <h2 id="samples-heading" className="text-xl font-semibold text-white">Sample files</h2>
                    <p className="mt-1 text-sm text-gray-400">Load a sample with bundled struct data, or start from its raw resources.</p>
                  </div>
                  <span className="hidden text-xs text-gray-500 sm:inline">{SAMPLE_DEFINITIONS.length} samples</span>
                </div>

                <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input value={sampleQuery} onChange={(event) => setSampleQuery(event.target.value)} placeholder="Search samples…" aria-label="Search samples" className="h-9 border-gray-700 bg-gray-950 pl-9" />
                  </div>
                  <div className="flex gap-1 overflow-x-auto border-b border-gray-800 sm:border-0">
                    {["All", "Game data", "Applications", "Icons", "Projects"].map((category) => (
                      <Button key={category} onClick={() => setSampleCategory(category as SampleDefinition["category"] | "All")} variant="ghost" size="sm" className={`h-9 shrink-0 px-3 text-xs ${sampleCategory === category ? "bg-blue-500/15 text-blue-200" : "text-gray-500 hover:text-gray-200"}`}>
                        {category}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-gray-800 border-y border-gray-800">
                  {filteredSamples.map((sample) => {
                    const hasSpecs = Boolean(sample.specsPath);
                    return (
                      <div key={sample.id} data-testid={`sample-${sample.id}`} className="grid gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium text-gray-100">{sample.name}</h3>
                            <span className="text-[10px] uppercase tracking-wide text-gray-500">{sample.category}</span>
                            {hasSpecs && (
                              <span className="border border-blue-800/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-300">
                                Struct data included
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-gray-400">{sample.description}</p>
                          <p className="mt-2 text-xs text-gray-500">{sample.source} · {sample.filename}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <Button
                            onClick={() => loadSample(sample, true)}
                            variant={hasSpecs ? "outline" : "ghost"}
                            size="sm"
                            className={hasSpecs ? "border-gray-600" : "text-gray-400 hover:text-white"}
                            disabled={isProcessing}
                          >
                            <Package className="mr-1.5 h-4 w-4" />
                            {hasSpecs ? "With struct data" : "With inferred fields"}
                          </Button>
                          <Button
                            onClick={() => loadSample(sample, false)}
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white"
                            disabled={isProcessing}
                          >
                            <Edit3 className="mr-1.5 h-4 w-4" />
                            Without struct data
                          </Button>
                          {sample.id === "otto-matic-level-1" && (
                            <Button
                              onClick={() => loadSampleAndBrowse(sample, true)}
                              variant="ghost"
                              size="sm"
                              className="text-blue-300 hover:text-blue-200"
                              disabled={isProcessing}
                            >
                              <Database className="mr-1.5 h-4 w-4" />
                              Browse data
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredSamples.length === 0 && <div className="py-10 text-center text-sm text-gray-500">No samples match this search.</div>}
                </div>
              </section>
            </div>
          ) : (
            // Data loaded - show compact toolbar with tabs
            <>
              <div className="border-b border-gray-800/80 py-2">
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "specs" | "data")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex min-w-0 items-center gap-2 pr-1">
                      <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="max-w-[min(34vw,26rem)] truncate text-sm font-semibold text-white" title={fileName}>{fileName}</span>
                      {hasUnsavedChanges && <span className="shrink-0 text-[11px] text-yellow-400">modified</span>}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCloseConfirmation(true)}
                        className="h-7 shrink-0 px-2 text-gray-400 hover:text-white"
                        aria-label="Close"
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Close
                      </Button>
                    </div>

                    <TabsList className="h-8 bg-gray-800/80">
                      <TabsTrigger value="specs" className="h-6 gap-1 px-2 text-xs sm:px-3 sm:text-sm">
                        <Settings className="h-3.5 w-3.5" />
                        Struct Specs
                      </TabsTrigger>
                      <TabsTrigger value="data" disabled={!parsedResult?.success} className="h-6 gap-1 px-2 text-xs sm:px-3 sm:text-sm">
                        <Database className="h-3.5 w-3.5" />
                        Browse Data
                      </TabsTrigger>
                    </TabsList>

                    <div className="ml-auto flex flex-wrap items-center gap-1">
                      <div className="mr-1 flex items-center gap-1 border-l border-gray-700 pl-2">
                        {/* Spec management */}
                  <Input
                    type="file"
                    accept=".txt"
                    onChange={handleSpecUpload}
                    ref={specFileInputRef}
                    className="hidden"
                  />
                  <Button
                    onClick={() => specFileInputRef.current?.click()}
                    variant="outline"
                    size="sm"
                    className="border-gray-600"
                  >
                    <Settings className="mr-1 h-3.5 w-3.5" />
                    Load Specs
                  </Button>
                  <Button
                    onClick={saveSpecifications}
                    variant="outline"
                    size="sm"
                    disabled={fourLetterCodes.length === 0}
                    className="border-gray-600"
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Save Specs
                  </Button>
                      </div>

                      <div className="mr-1 flex items-center gap-1 border-l border-gray-700 pl-2">
                        {/* Export & Pack */}
                  <Button
                    onClick={downloadJson}
                    size="sm"
                    variant="outline"
                    disabled={!parsedResult?.success}
                    className="border-gray-600"
                  >
                    <FileJson className="mr-1 h-3.5 w-3.5" />
                    Export JSON
                  </Button>
                  <Button
                    onClick={downloadTypeScript}
                    size="sm"
                    variant="outline"
                    disabled={fourLetterCodes.length === 0}
                    className="border-gray-600"
                  >
                    <Code className="mr-1 h-3.5 w-3.5" />
                    Export TypeScript
                  </Button>
                  <Button
                    onClick={packToRsrc}
                    size="sm"
                    className={`${hasUnsavedChanges ? 'bg-orange-600 hover:bg-orange-700' : 'bg-purple-600 hover:bg-purple-700'} text-white`}
                    disabled={!parsedResult?.success || isProcessing}
                  >
                    <PackageOpen className="mr-1 h-3.5 w-3.5" />
                    Pack to RSRC
                  </Button>
                      </div>

                      {/* Convert JSON to RSRC */}
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleJsonUpload}
                    ref={jsonInputRef}
                    className="hidden"
                  />
                  <Button
                    onClick={() => jsonInputRef.current?.click()}
                    variant="outline"
                    size="sm"
                    disabled={isProcessing || fourLetterCodes.length === 0}
                    className="border-gray-600"
                  >
                    <Upload className="mr-1 h-3.5 w-3.5" />
                    Convert JSON to RSRC
                  </Button>
                    </div>
                  </div>

                  <TabsContent value="specs" />
                  <TabsContent value="data" />
                </Tabs>
              </div>
            </>
          )}
        </Card>

        {showCloseConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/75 p-4 backdrop-blur-sm" role="presentation">
            <div
              className="w-full max-w-md border border-gray-700 bg-gray-900 p-5 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="close-file-title"
              aria-describedby="close-file-description"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-yellow-500/15 p-2 text-yellow-300"><FileText className="h-4 w-4" /></div>
                <div>
                  <h2 id="close-file-title" className="font-semibold text-white">Close {fileName}?</h2>
                  <p id="close-file-description" className="mt-1 text-sm leading-6 text-gray-400">
                    {hasUnsavedChanges ? "You have unsaved changes. Closing will discard them." : "The current resource fork will be removed from the workspace."}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowCloseConfirmation(false)}>Cancel</Button>
                <Button variant="destructive" onClick={clearLoadedFile}>Close file</Button>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {parseError.length > 0 ? (
          <Card className="border border-red-800/80 bg-red-950/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-100">
                <X className="h-5 w-5" />
                <span className="font-medium">Error:</span>
                <span>{parseError}</span>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Processing Indicator */}
        {isProcessing && (
          <Card className="border-y border-gray-700 bg-gray-800/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-300">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                <span>Processing...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Four-Letter Code Specifications - show when in specs view mode */}
        {viewMode === "specs" && fourLetterCodes.length > 0 && (
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="px-0 pb-3">
              <CardTitle className="text-white">
                Four-Letter Code Specifications
              </CardTitle>
              <CardDescription className="text-gray-400">
                Configure data types for each four-letter code found in your
                file
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="grid gap-4 lg:grid-cols-[minmax(190px,240px)_minmax(0,1fr)]">
                <nav aria-label="Resource specifications" className="max-h-[calc(100vh-240px)] space-y-1 overflow-y-auto border-y border-gray-800 py-2 lg:sticky lg:top-4 lg:self-start">
                  {fourLetterCodes.map((spec, specIndex) => (
                    <button key={spec.fourCC} onClick={() => setSelectedSpecIndex(specIndex)} aria-label={`${spec.fourCC} ${!spec.hasUserDefinedSpec && !spec.isInferredSpec ? "Struct Specification Not Defined" : spec.statusMessage || spec.status}`} className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${selectedSpecIndex === specIndex ? "border-l-2 border-blue-400 bg-blue-500/10 text-white" : "border-l-2 border-transparent text-gray-400 hover:bg-gray-800/70 hover:text-gray-200"}`}>
                      <span className="min-w-0 truncate font-mono">{spec.fourCC}</span>
                      <span className="flex shrink-0 items-center gap-1"><StatusPill status={spec.status} /><span className="text-[10px] text-gray-600">{spec.dataTypes.length}</span></span>
                    </button>
                  ))}
                </nav>
                <div className="min-w-0">
                  {fourLetterCodes[selectedSpecIndex] && (() => {
                    const spec = fourLetterCodes[selectedSpecIndex];
                    return <FourLetterCodeSpecification
                      key={spec.fourCC}
                      spec={spec}
                      specIndex={selectedSpecIndex}
                      onFourCCChange={updateFourCC}
                      updateFourLetterCodeSpec={updateFourLetterCodeSpec}
                      addDataTypeToSpec={addDataTypeToSpec}
                      addArrayFieldToSpec={addArrayFieldToSpec}
                      removeDataTypeFromSpec={removeDataTypeFromSpec}
                      updateDataType={updateDataType}
                      dataTypeOptions={DATA_TYPE_OPTIONS}
                    />;
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data Browser - show when in data view mode */}
        {viewMode === "data" && parsedResult?.success && browserData && (
          <DataBrowser 
            data={browserData}
            onDataChange={handleDataChange}
            onResourceDataChange={handleResourceDataChange}
            onFourCCChange={(oldFourCC, nextFourCC) => {
              const index = fourLetterCodes.findIndex((spec) => spec.fourCC === oldFourCC);
              if (index !== -1) updateFourCC(index, nextFourCC);
            }}
            readOnly={false}
          />
        )}
      </div>
    </div>
  );
}

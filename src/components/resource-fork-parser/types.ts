// Enhanced type system for resource fork parser

export interface ParsedResource {
  name?: string;
  order?: number;
  obj?: Record<string, unknown>;
  data?: string; // hex-encoded data
  conversionError?: string;
}

export interface ParsedResourceCollection {
  [resourceId: string]: ParsedResource;
}

export interface ParsedResult {
  success: boolean;
  data?: unknown; // Changed from specific types to unknown for flexibility
  error?: string;
  filename?: string;
}

export type StructDataType = "L" | "l" | "i" | "I" | "h" | "H" | "f" | "B" | "b" | "x" | "s" | "p" | "?";

export interface ArrayFieldSpec {
  name: string;
  type: StructDataType;
}

export interface DataTypeField {
  id: string;
  type: StructDataType;
  count: number;
  description: string;
  isArrayField?: boolean;
  arraySize?: number;
  arrayFields?: ArrayFieldSpec[];
  isPadding?: boolean; // True for padding bytes (x, 2x, 40x) - description should be empty/disabled
  isExpandedGroup?: boolean; // True for fields originally in Ni format with N separate names
}

export interface FourLetterCodeSpec {
  fourCC: string;
  dataTypes: DataTypeField[];
  isArray: boolean;
  autoPadding?: boolean;
  status: "valid" | "error" | "warning";
  statusMessage?: string;
  sampleData?: unknown | null; // Changed from ParsedResourceCollection to unknown for flexibility
  rawOttoSpec?: string; // Raw specification string for Otto specs
  hasUserDefinedSpec?: boolean; // Whether the user has defined a custom spec
  rawData?: Uint8Array; // Raw binary data for undefined structs
}

export interface DataTypeOption {
  value: StructDataType;
  label: string;
}
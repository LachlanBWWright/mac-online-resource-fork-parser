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
  data?: ParsedResourceCollection | Record<string, ParsedResourceCollection>;
  error?: string;
  filename?: string;
}

export interface ArrayFieldSpec {
  name: string;
  type: "L" | "l" | "i" | "h" | "H" | "f" | "B" | "b" | "x" | "s" | "p";
}

export interface DataTypeField {
  id: string;
  type: "L" | "l" | "i" | "h" | "H" | "f" | "B" | "b" | "x" | "s" | "p";
  count: number;
  description: string;
  isArrayField?: boolean;
  arraySize?: number;
  arrayFields?: ArrayFieldSpec[];
}

export interface FourLetterCodeSpec {
  fourCC: string;
  dataTypes: DataTypeField[];
  isArray: boolean;
  autoPadding: boolean;
  status: "valid" | "error" | "warning";
  statusMessage?: string;
  sampleData?: ParsedResourceCollection | null;
}

export type StructDataType = "L" | "l" | "i" | "h" | "H" | "f" | "B" | "b" | "x" | "s" | "p";

export interface DataTypeOption {
  value: StructDataType;
  label: string;
}
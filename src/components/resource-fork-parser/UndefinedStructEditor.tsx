import { useState, useMemo, useCallback } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { AlertTriangle, HelpCircle, Plus, Check, AlertCircle, Zap, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "../ui/badge";
import type { StructDataType, DataTypeField } from "./types";

interface UndefinedStructEditorProps {
  fourCC: string;
  rawData: Uint8Array;
  onDefineStruct: (fields: DataTypeField[], isArray: boolean) => void;
}

// Size of each data type in bytes
const TYPE_SIZES: Record<StructDataType, number> = {
  'L': 4, // Unsigned Long
  'l': 4, // Signed Long
  'i': 4, // Signed Int
  'I': 4, // Unsigned Int
  'h': 2, // Signed Short
  'H': 2, // Unsigned Short
  'f': 4, // Float
  'B': 1, // Unsigned Byte
  'b': 1, // Signed Byte
  'x': 1, // Padding
  '?': 1, // Boolean
  's': 1, // String (per character)
  'p': 1, // Pascal String (per character)
};

// Padding type constant
const PADDING_TYPE = 'x' as const;

// Helper to convert bytes to hex string
function bytesToHex(bytes: Uint8Array, maxLength = 64): string {
  const hex = Array.from(bytes.slice(0, maxLength))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
  return bytes.length > maxLength ? hex + " ..." : hex;
}

// Helper to convert bytes to ASCII (printable chars only)
function bytesToAscii(bytes: Uint8Array, maxLength = 64): string {
  const ascii = Array.from(bytes.slice(0, maxLength))
    .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
    .join("");
  return bytes.length > maxLength ? ascii + " ..." : ascii;
}

// Calculate possible divisors for the data size
function getPossibleDivisors(size: number): number[] {
  const divisors: number[] = [];
  const commonSizes = [1, 2, 4, 8, 12, 16, 20, 24, 32, 48, 64, 128, 256, 512, 1024];
  
  for (const div of commonSizes) {
    if (size % div === 0 && size / div > 0) {
      divisors.push(div);
    }
  }
  
  // Add the size itself if it's reasonable
  if (size <= 1024 && !divisors.includes(size)) {
    divisors.push(size);
  }
  
  return divisors.sort((a, b) => a - b);
}

// Calculate total bytes for a field specification
function calculateFieldBytes(fields: DataTypeField[]): number {
  return fields.reduce((total, field) => {
    const typeSize = TYPE_SIZES[field.type] || 1;
    return total + (typeSize * field.count);
  }, 0);
}

// Calculate suggested padding to reach target size
function calculatePaddingNeeded(currentSize: number, targetSize: number): number {
  if (targetSize <= currentSize) return 0;
  return targetSize - currentSize;
}

export default function UndefinedStructEditor({
  fourCC,
  rawData,
  onDefineStruct,
}: UndefinedStructEditorProps) {
  const [isDefining, setIsDefining] = useState(false);
  const [fields, setFields] = useState<DataTypeField[]>([
    { id: "1", type: "i", count: 1, description: "field_1" },
  ]);
  const [isArray, setIsArray] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const dataSize = rawData.length;
  const hexPreview = useMemo(() => bytesToHex(rawData, 64), [rawData]);
  const asciiPreview = useMemo(() => bytesToAscii(rawData, 64), [rawData]);
  const possibleDivisors = useMemo(() => getPossibleDivisors(dataSize), [dataSize]);

  // Instant feedback calculations
  const currentStructSize = useMemo(() => calculateFieldBytes(fields), [fields]);
  
  // Determine if the spec matches the data size
  const specStatus = useMemo(() => {
    if (isArray) {
      // For arrays, check if data size is divisible by struct size
      if (currentStructSize === 0) return { valid: false, message: "Struct size is 0", type: "error" as const };
      if (dataSize % currentStructSize === 0) {
        const recordCount = dataSize / currentStructSize;
        return { valid: true, message: `${recordCount} records × ${currentStructSize} bytes`, type: "success" as const };
      } else {
        const remainder = dataSize % currentStructSize;
        return { valid: false, message: `${remainder} bytes remaining (not divisible)`, type: "error" as const };
      }
    } else {
      // For single struct, check exact match
      if (currentStructSize === dataSize) {
        return { valid: true, message: "Exact match", type: "success" as const };
      } else if (currentStructSize < dataSize) {
        const diff = dataSize - currentStructSize;
        return { valid: false, message: `${diff} bytes unaccounted (add ${diff}x padding?)`, type: "warning" as const };
      } else {
        const diff = currentStructSize - dataSize;
        return { valid: false, message: `${diff} bytes over (reduce field count or size)`, type: "error" as const };
      }
    }
  }, [currentStructSize, dataSize, isArray]);

  // Suggested record sizes based on common patterns
  const suggestedStructSizes = useMemo(() => {
    return possibleDivisors.filter(div => div >= 4 && div <= 256).slice(0, 6);
  }, [possibleDivisors]);

  const handleAddField = useCallback(() => {
    const newId = (fields.length + 1).toString();
    setFields([
      ...fields,
      {
        id: newId,
        type: "i",
        count: 1,
        description: `field_${newId}`,
      },
    ]);
  }, [fields]);

  const handleRemoveField = useCallback((id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  }, [fields]);

  const handleFieldChange = useCallback((
    id: string,
    key: keyof DataTypeField,
    value: string | number | StructDataType
  ) => {
    setFields(
      fields.map((f) =>
        f.id === id
          ? {
              ...f,
              [key]: key === "count" ? parseInt(value as string) || 1 : value,
            }
          : f
      )
    );
  }, [fields]);

  const handleAddPadding = useCallback(() => {
    const paddingNeeded = calculatePaddingNeeded(currentStructSize, dataSize);
    if (paddingNeeded > 0) {
      const newId = (fields.length + 1).toString();
      setFields([
        ...fields,
        {
          id: newId,
          type: "x",
          count: paddingNeeded,
          description: "",
          isPadding: true,
        },
      ]);
    }
  }, [currentStructSize, dataSize, fields]);

  const handleAutoFillStruct = useCallback((targetSize: number) => {
    // Create a simple struct of integers that fits the target size
    const intCount = Math.floor(targetSize / 4);
    const remainder = targetSize % 4;
    
    const newFields: DataTypeField[] = [];
    
    if (intCount > 0) {
      for (let i = 0; i < intCount; i++) {
        newFields.push({
          id: (i + 1).toString(),
          type: "i",
          count: 1,
          description: `field_${i + 1}`,
        });
      }
    }
    
    if (remainder > 0) {
      newFields.push({
        id: (intCount + 1).toString(),
        type: "x",
        count: remainder,
        description: "",
        isPadding: true,
      });
    }
    
    setFields(newFields.length > 0 ? newFields : [{ id: "1", type: "i", count: 1, description: "field_1" }]);
    setIsArray(dataSize > targetSize);
  }, [dataSize]);

  const handleDefineStruct = useCallback(() => {
    onDefineStruct(fields, isArray);
    setIsDefining(false);
  }, [fields, isArray, onDefineStruct]);

  if (!isDefining) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-yellow-200">
              Struct Specification Not Defined
            </h4>
            <p className="text-xs text-yellow-300/80 mt-1">
              This four-letter code ({fourCC}) does not have a data structure
              defined. The parser cannot interpret the binary data without
              knowing its format.
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <span className="text-gray-400">Total Data Size:</span>{" "}
            <span className="text-white font-mono">{dataSize} bytes</span>
          </div>

          {possibleDivisors.length > 0 && (
            <div>
              <span className="text-gray-400">Possible Record Sizes:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {possibleDivisors.map((div) => (
                  <Badge
                    key={div}
                    variant="secondary"
                    className="bg-gray-700 text-gray-200 text-xs"
                  >
                    {div} bytes ({dataSize / div} records)
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="text-gray-400">Hex Preview:</span>
            <div className="bg-gray-900 p-2 rounded mt-1 overflow-x-auto">
              <code className="text-xs text-green-400 font-mono">
                {hexPreview}
              </code>
            </div>
          </div>

          <div>
            <span className="text-gray-400">ASCII Preview:</span>
            <div className="bg-gray-900 p-2 rounded mt-1 overflow-x-auto">
              <code className="text-xs text-blue-400 font-mono">
                {asciiPreview}
              </code>
            </div>
          </div>
        </div>

        <Button
          onClick={() => setIsDefining(true)}
          className="w-full"
          variant="outline"
          size="sm"
        >
          <HelpCircle className="h-4 w-4 mr-2" />
          Define Data Structure
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-200">
          Define Struct Specification for {fourCC}
        </h4>
        <Button
          onClick={() => setIsDefining(false)}
          variant="ghost"
          size="sm"
          className="h-6 px-2"
        >
          Cancel
        </Button>
      </div>

      {/* Instant Feedback - Size Status */}
      <div className={`flex items-center gap-2 p-3 rounded-lg border ${
        specStatus.type === 'success' 
          ? 'bg-green-900/30 border-green-700/50' 
          : specStatus.type === 'warning' 
            ? 'bg-yellow-900/30 border-yellow-700/50'
            : 'bg-red-900/30 border-red-700/50'
      }`}>
        {specStatus.type === 'success' ? (
          <Check className="h-5 w-5 text-green-500" />
        ) : specStatus.type === 'warning' ? (
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
        ) : (
          <AlertCircle className="h-5 w-5 text-red-500" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-4 text-sm">
            <span className={specStatus.type === 'success' ? 'text-green-300' : specStatus.type === 'warning' ? 'text-yellow-300' : 'text-red-300'}>
              {specStatus.message}
            </span>
            <span className="text-gray-400">
              Your spec: <span className="font-mono text-white">{currentStructSize} bytes</span>
              {" | "}
              Data: <span className="font-mono text-white">{dataSize} bytes</span>
            </span>
          </div>
        </div>
        {specStatus.type === 'warning' && currentStructSize < dataSize && (
          <Button
            onClick={handleAddPadding}
            size="sm"
            variant="outline"
            className="border-yellow-600 text-yellow-300 hover:bg-yellow-900/50"
          >
            <Zap className="h-3 w-3 mr-1" />
            Add {dataSize - currentStructSize}x Padding
          </Button>
        )}
      </div>

      {/* Quick-Fill Templates */}
      {suggestedStructSizes.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300"
          >
            {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Quick-fill templates
          </button>
          {showAdvanced && (
            <div className="flex flex-wrap gap-1">
              {suggestedStructSizes.map((size) => (
                <Button
                  key={size}
                  onClick={() => handleAutoFillStruct(size)}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-2 border-gray-600"
                >
                  {size} bytes ({Math.floor(size / 4)} ints)
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Keep data info visible while defining */}
      <div className="space-y-2 text-xs bg-gray-750 p-3 rounded">
        <div>
          <span className="text-gray-400">Total Data Size:</span>{" "}
          <span className="text-white font-mono">{dataSize} bytes</span>
        </div>

        {possibleDivisors.length > 0 && (
          <div>
            <span className="text-gray-400">Possible Record Sizes:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {possibleDivisors.slice(0, 8).map((div) => (
                <Badge
                  key={div}
                  variant="secondary"
                  className={`text-xs cursor-pointer hover:bg-gray-600 ${
                    currentStructSize === div ? 'bg-green-700 text-green-100' : 'bg-gray-700 text-gray-200'
                  }`}
                  onClick={() => handleAutoFillStruct(div)}
                >
                  {div} bytes ({dataSize / div} records)
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div>
          <span className="text-gray-400">Hex Preview:</span>
          <div className="bg-gray-900 p-2 rounded mt-1 overflow-x-auto">
            <code className="text-xs text-green-400 font-mono">
              {hexPreview}
            </code>
          </div>
        </div>

        <div>
          <span className="text-gray-400">ASCII Preview:</span>
          <div className="bg-gray-900 p-2 rounded mt-1 overflow-x-auto">
            <code className="text-xs text-blue-400 font-mono">
              {asciiPreview}
            </code>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className={`flex items-center gap-2 p-2 rounded ${
              field.type === PADDING_TYPE ? 'bg-gray-900/50 border border-dashed border-gray-700' : 'bg-gray-900'
            }`}
          >
            <span className="text-gray-400 text-xs w-6">{index + 1}.</span>
            <select
              value={field.type}
              onChange={(e) =>
                handleFieldChange(field.id, "type", e.target.value as StructDataType)
              }
              className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white flex-shrink-0"
            >
              <option value="L">L - Unsigned Long (4)</option>
              <option value="l">l - Signed Long (4)</option>
              <option value="i">i - Signed Int (4)</option>
              <option value="I">I - Unsigned Int (4)</option>
              <option value="h">h - Signed Short (2)</option>
              <option value="H">H - Unsigned Short (2)</option>
              <option value="f">f - Float (4)</option>
              <option value="B">B - Unsigned Byte (1)</option>
              <option value="b">b - Signed Byte (1)</option>
              <option value="?">? - Boolean (1)</option>
              <option value="x">x - Padding (1)</option>
              <option value="s">s - String</option>
              <option value="p">p - Pascal String</option>
            </select>

            <Input
              type="number"
              min="1"
              value={field.count}
              onChange={(e) =>
                handleFieldChange(field.id, "count", e.target.value)
              }
              className="w-16 h-8 text-sm"
              placeholder="Count"
            />

            <Input
              type="text"
              value={field.type === PADDING_TYPE ? '' : field.description}
              onChange={(e) =>
                handleFieldChange(field.id, "description", e.target.value)
              }
              className="flex-1 h-8 text-sm"
              placeholder={field.type === PADDING_TYPE ? '(padding - no field name)' : 'Field name'}
              disabled={field.type === PADDING_TYPE}
            />

            <span className="text-gray-500 text-xs w-12 text-right">
              {TYPE_SIZES[field.type] * field.count}B
            </span>

            {fields.length > 1 && (
              <Button
                onClick={() => handleRemoveField(field.id)}
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-red-400 hover:text-red-300"
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={handleAddField}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Field
        </Button>
        <Button
          onClick={() => {
            const newId = (fields.length + 1).toString();
            setFields([
              ...fields,
              {
                id: newId,
                type: "x",
                count: 1,
                description: "",
                isPadding: true,
              },
            ]);
          }}
          variant="outline"
          size="sm"
          className="border-gray-600"
        >
          Add Padding
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={isArray}
            onChange={(e) => setIsArray(e.target.checked)}
            className="rounded"
          />
          Is Array (multiple records)
        </label>
      </div>

      <Button
        onClick={handleDefineStruct}
        className={`w-full ${specStatus.valid ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-500'}`}
        size="sm"
      >
        {specStatus.valid ? (
          <>
            <Check className="h-4 w-4 mr-1" />
            Apply Struct Specification
          </>
        ) : (
          'Apply Struct Specification (size mismatch)'
        )}
      </Button>
    </div>
  );
}

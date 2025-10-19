import { useState, useMemo } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { AlertTriangle, HelpCircle, Plus } from "lucide-react";
import { Badge } from "../ui/badge";
import type { StructDataType, DataTypeField } from "./types";

interface UndefinedStructEditorProps {
  fourCC: string;
  rawData: Uint8Array;
  onDefineStruct: (fields: DataTypeField[], isArray: boolean) => void;
}

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
  const commonSizes = [1, 2, 4, 8, 12, 16, 20, 24, 32, 48, 64, 128, 256];
  
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

  const dataSize = rawData.length;
  const hexPreview = useMemo(() => bytesToHex(rawData, 64), [rawData]);
  const asciiPreview = useMemo(() => bytesToAscii(rawData, 64), [rawData]);
  const possibleDivisors = useMemo(() => getPossibleDivisors(dataSize), [dataSize]);

  const handleAddField = () => {
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
  };

  const handleRemoveField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const handleFieldChange = (
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
  };

  const handleDefineStruct = () => {
    onDefineStruct(fields, isArray);
    setIsDefining(false);
  };

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

      <div className="text-xs text-gray-400 mb-3">
        Data Size: {dataSize} bytes
      </div>

      <div className="space-y-2">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="flex items-center gap-2 bg-gray-900 p-2 rounded"
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
              <option value="h">h - Signed Short (2)</option>
              <option value="H">H - Unsigned Short (2)</option>
              <option value="f">f - Float (4)</option>
              <option value="B">B - Unsigned Byte (1)</option>
              <option value="b">b - Signed Byte (1)</option>
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
              value={field.description}
              onChange={(e) =>
                handleFieldChange(field.id, "description", e.target.value)
              }
              className="flex-1 h-8 text-sm"
              placeholder="Field name"
            />

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
        className="w-full"
        size="sm"
      >
        Apply Struct Specification
      </Button>
    </div>
  );
}

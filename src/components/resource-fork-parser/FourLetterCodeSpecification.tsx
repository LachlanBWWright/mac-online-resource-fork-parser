import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "../ui/table";
import { Check, Edit2, Plus, X } from "lucide-react";
import type { FourLetterCodeSpec, DataTypeField, DataTypeOption } from "./types";
import StatusIcon from "./StatusIcon";
import SampleDataDisplay from "./SampleDataDisplay";
import DataTypeFieldRow from "./DataTypeFieldRow";
import UndefinedStructEditor from "./UndefinedStructEditor";
import { calculateFieldLayout, generateSpecLine } from "./spec-model";

interface FourLetterCodeSpecificationProps {
  spec: FourLetterCodeSpec;
  specIndex: number;
  onFourCCChange: (index: number, fourCC: string) => void;
  updateFourLetterCodeSpec: (index: number, updates: Partial<FourLetterCodeSpec>) => void;
  addDataTypeToSpec: (specIndex: number) => void;
  addArrayFieldToSpec: (specIndex: number) => void;
  removeDataTypeFromSpec: (specIndex: number, dataTypeId: string) => void;
  updateDataType: (
    specIndex: number,
    dataTypeId: string,
    updates: Partial<DataTypeField>
  ) => void;
  dataTypeOptions: DataTypeOption[];
}

export default function FourLetterCodeSpecification({
  spec,
  specIndex,
  onFourCCChange,
  updateFourLetterCodeSpec,
  addDataTypeToSpec,
  addArrayFieldToSpec,
  removeDataTypeFromSpec,
  updateDataType,
  dataTypeOptions,
}: FourLetterCodeSpecificationProps) {
  const [isEditingFourCC, setIsEditingFourCC] = useState(false);
  const [fourCCDraft, setFourCCDraft] = useState(spec.fourCC);
  const [fourCCError, setFourCCError] = useState("");
  const fieldLayout = calculateFieldLayout(spec.dataTypes);
  const totalBytes = fieldLayout.at(-1)?.endOffset ?? 0;
  // Check if this is an undefined struct (default single integer field without user definition)
  const isUndefinedStruct = !spec.hasUserDefinedSpec && !spec.isInferredSpec && 
    spec.dataTypes.length === 1 && 
    spec.dataTypes[0].type === "i" &&
    spec.dataTypes[0].count === 1 &&
    spec.dataTypes[0].description === "field_1";

  const handleDefineStruct = (fields: DataTypeField[], isArray: boolean) => {
    updateFourLetterCodeSpec(specIndex, {
      dataTypes: fields,
      isArray,
      hasUserDefinedSpec: true,
    });
  };

  const saveFourCC = () => {
    const nextFourCC = fourCCDraft;
    if (!/^[\x20-\x7e]{4}$/.test(nextFourCC)) {
      setFourCCError("Use exactly four printable characters");
      return;
    }
    onFourCCChange(specIndex, nextFourCC);
    setFourCCError("");
    setIsEditingFourCC(false);
  };

  // If no rawData, create a dummy one with a message
  const dummyRawData = new Uint8Array([
    0x4e, 0x6f, 0x20, 0x72, 0x61, 0x77, 0x20, 0x64, 0x61, 0x74, 0x61, 0x20, 0x61, 0x76, 0x61, 0x69, 
    0x6c, 0x61, 0x62, 0x6c, 0x65, 0x20, 0x2d, 0x20, 0x70, 0x6c, 0x65, 0x61, 0x73, 0x65, 0x20, 0x64,
    0x65, 0x66, 0x69, 0x6e, 0x65, 0x20, 0x73, 0x74, 0x72, 0x75, 0x63, 0x74
  ]); // "No raw data available - please define struct"

  return (
    <div 
      className="border-y border-gray-700/80 px-2 py-4 space-y-4 bg-gray-800/30 sm:px-4"
      data-testid={`flc-section-${spec.fourCC}`}
    >
      {/* Four-letter code header */}
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {isEditingFourCC ? (
            <div className="flex flex-wrap items-start gap-2">
              <div>
                <Input
                  value={fourCCDraft}
                  onChange={(event) => {
                    setFourCCDraft(event.target.value.slice(0, 4));
                    setFourCCError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveFourCC();
                    if (event.key === "Escape") setIsEditingFourCC(false);
                  }}
                  aria-label={`Four-letter code for ${spec.fourCC}`}
                  maxLength={4}
                  autoFocus
                  className="h-9 w-24 bg-gray-700 font-mono uppercase text-white"
                />
                {fourCCError && <p className="mt-1 text-xs text-red-400">{fourCCError}</p>}
              </div>
              <Button onClick={saveFourCC} size="sm" className="h-9 bg-green-600 px-2 hover:bg-green-700" aria-label="Save four-letter code">
                <Check className="h-4 w-4" />
              </Button>
              <Button onClick={() => setIsEditingFourCC(false)} size="sm" variant="ghost" className="h-9 px-2" aria-label="Cancel four-letter code edit">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-xl font-semibold text-white">{spec.fourCC}</h3>
              <Button
                onClick={() => {
                  setFourCCDraft(spec.fourCC);
                  setIsEditingFourCC(true);
                }}
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-gray-400 hover:text-white"
                aria-label={`Edit four-letter code ${spec.fourCC}`}
                title="Edit four-letter code"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <StatusIcon status={spec.status} />
            {spec.isInferredSpec && (
              <Badge variant="outline" className="text-xs">Inferred</Badge>
            )}
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
        {!isUndefinedStruct && (
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
        )}
      </div>

      {/* Show UndefinedStructEditor if struct is not defined */}
      {isUndefinedStruct ? (
        <UndefinedStructEditor
          fourCC={spec.fourCC}
          rawData={spec.rawData || dummyRawData}
          onDefineStruct={handleDefineStruct}
        />
      ) : (
        <>
          {/* Sample Data Display */}
          {spec.sampleData && (
            <div className="bg-gray-900 rounded p-4 space-y-2">
              <h4 className="font-medium text-gray-300 max-h-40 min-h-0 overflow-y-auto">
                Sample Data:
              </h4>
              <SampleDataDisplay sampleData={spec.sampleData} />
            </div>
          )}

          {/* Data types table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-200">Data Type Fields</h4>
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
                  <TableHead className="text-gray-300">Offset</TableHead>
                  <TableHead className="text-gray-300">Type</TableHead>
                  <TableHead className="text-gray-300">Count</TableHead>
                  <TableHead className="text-gray-300">Description</TableHead>
                  <TableHead className="text-gray-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fieldLayout.map(({ field: dataType, offset, byteLength }) => (
                  <DataTypeFieldRow
                    key={dataType.id}
                    dataType={dataType}
                    specIndex={specIndex}
                    isLastField={spec.dataTypes.length === 1}
                    updateDataType={updateDataType}
                    removeDataType={removeDataTypeFromSpec}
                    dataTypeOptions={dataTypeOptions}
                    offset={offset}
                    byteLength={byteLength}
                  />
                ))}
              </TableBody>
            </Table>
            <div className="rounded bg-gray-900 p-3 text-sm text-gray-300">
              <div className="mb-1 text-gray-400">Canonical spec · {totalBytes} bytes per record</div>
              <code className="break-all text-cyan-300">{generateSpecLine(spec)}</code>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

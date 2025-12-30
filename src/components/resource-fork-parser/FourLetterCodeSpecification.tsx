import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "../ui/table";
import { Plus } from "lucide-react";
import type { FourLetterCodeSpec, DataTypeField, DataTypeOption } from "./types";
import StatusIcon from "./StatusIcon";
import SampleDataDisplay from "./SampleDataDisplay";
import DataTypeFieldRow from "./DataTypeFieldRow";
import UndefinedStructEditor from "./UndefinedStructEditor";

interface FourLetterCodeSpecificationProps {
  spec: FourLetterCodeSpec;
  specIndex: number;
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
  updateFourLetterCodeSpec,
  addDataTypeToSpec,
  addArrayFieldToSpec,
  removeDataTypeFromSpec,
  updateDataType,
  dataTypeOptions,
}: FourLetterCodeSpecificationProps) {
  // Check if this is an undefined struct (default single integer field without user definition)
  const isUndefinedStruct = !spec.hasUserDefinedSpec && 
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

  // If no rawData, create a dummy one with a message
  const dummyRawData = new Uint8Array([
    0x4e, 0x6f, 0x20, 0x72, 0x61, 0x77, 0x20, 0x64, 0x61, 0x74, 0x61, 0x20, 0x61, 0x76, 0x61, 0x69, 
    0x6c, 0x61, 0x62, 0x6c, 0x65, 0x20, 0x2d, 0x20, 0x70, 0x6c, 0x65, 0x61, 0x73, 0x65, 0x20, 0x64,
    0x65, 0x66, 0x69, 0x6e, 0x65, 0x20, 0x73, 0x74, 0x72, 0x75, 0x63, 0x74
  ]); // "No raw data available - please define struct"

  return (
    <div 
      className="border border-gray-600 rounded-lg p-6 space-y-6 bg-gray-750"
      data-testid={`flc-section-${spec.fourCC}`}
    >
      {/* Four-letter code header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-semibold text-white">{spec.fourCC}</h3>
          <div className="flex items-center gap-2">
            <StatusIcon status={spec.status} />
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
                  <TableHead className="text-gray-300">Type</TableHead>
                  <TableHead className="text-gray-300">Count</TableHead>
                  <TableHead className="text-gray-300">Description</TableHead>
                  <TableHead className="text-gray-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spec.dataTypes.map((dataType) => (
                  <DataTypeFieldRow
                    key={dataType.id}
                    dataType={dataType}
                    specIndex={specIndex}
                    isLastField={spec.dataTypes.length === 1}
                    updateDataType={updateDataType}
                    removeDataType={removeDataTypeFromSpec}
                    dataTypeOptions={dataTypeOptions}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
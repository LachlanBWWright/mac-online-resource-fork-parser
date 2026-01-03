import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";
import { TableCell, TableRow } from "../ui/table";
import { Trash2 } from "lucide-react";
import type { DataTypeField, DataTypeOption } from "./types";
import ArrayFieldConfiguration from "./ArrayFieldConfiguration";

interface DataTypeFieldRowProps {
  dataType: DataTypeField;
  specIndex: number;
  isLastField: boolean;
  updateDataType: (
    specIndex: number,
    dataTypeId: string,
    updates: Partial<DataTypeField>
  ) => void;
  removeDataType: (specIndex: number, dataTypeId: string) => void;
  dataTypeOptions: DataTypeOption[];
}

export default function DataTypeFieldRow({
  dataType,
  specIndex,
  isLastField,
  updateDataType,
  removeDataType,
  dataTypeOptions,
}: DataTypeFieldRowProps) {
  // Padding bytes (x type) should not have editable descriptions
  const isPaddingType = dataType.type === 'x' || dataType.isPadding;
  
  return (
    <>
      <TableRow className={`border-gray-600 ${dataType.isArrayField ? "bg-gray-750" : ""}`}>
        {!dataType.isArrayField && (
          <TableCell>
            <Select
              value={dataType.type}
              onValueChange={(value: DataTypeField["type"]) =>
                updateDataType(specIndex, dataType.id, { type: value })
              }
            >
              <SelectTrigger className="w-64 bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {dataTypeOptions.map((option) => (
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
          </TableCell>
        )}
        {!dataType.isArrayField && (
          <TableCell>
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
            />
          </TableCell>
        )}
        <TableCell colSpan={dataType.isArrayField ? 4 : 1}>
          {dataType.isArrayField ? (
            <ArrayFieldConfiguration
              dataType={dataType}
              specIndex={specIndex}
              updateDataType={updateDataType}
              dataTypeOptions={dataTypeOptions}
            />
          ) : isPaddingType ? (
            <span className="text-gray-500 italic">No field name (padding)</span>
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
            onClick={() => removeDataType(specIndex, dataType.id)}
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={isLastField}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    </>
  );
}
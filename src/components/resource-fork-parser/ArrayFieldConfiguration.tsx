import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";
import { Plus, X } from "lucide-react";
import type { DataTypeField, ArrayFieldSpec, DataTypeOption } from "./types";

interface ArrayFieldConfigurationProps {
  dataType: DataTypeField;
  specIndex: number;
  updateDataType: (
    specIndex: number,
    dataTypeId: string,
    updates: Partial<DataTypeField>
  ) => void;
  dataTypeOptions: DataTypeOption[];
}

export default function ArrayFieldConfiguration({
  dataType,
  specIndex,
  updateDataType,
  dataTypeOptions,
}: ArrayFieldConfigurationProps) {
  const arrayFields = dataType.arrayFields || [
    { name: "x", type: "i" as const },
    { name: "y", type: "i" as const },
  ];

  const handleFieldNameChange = (index: number, name: string) => {
    const newArrayFields = [...arrayFields];
    newArrayFields[index] = { ...newArrayFields[index], name };
    updateDataType(specIndex, dataType.id, { arrayFields: newArrayFields });
  };

  const handleFieldTypeChange = (index: number, type: ArrayFieldSpec["type"]) => {
    const newArrayFields = [...arrayFields];
    newArrayFields[index] = { ...newArrayFields[index], type };
    updateDataType(specIndex, dataType.id, { arrayFields: newArrayFields });
  };

  const handleRemoveField = (index: number) => {
    const newArrayFields = [...arrayFields];
    newArrayFields.splice(index, 1);
    updateDataType(specIndex, dataType.id, {
      arrayFields: newArrayFields.length > 0 ? newArrayFields : [{ name: "field", type: "i" as const }],
    });
  };

  const handleAddField = () => {
    const newArrayFields = [...arrayFields, { name: "newField", type: "i" as const }];
    updateDataType(specIndex, dataType.id, { arrayFields: newArrayFields });
  };

  const handleArraySizeChange = (size: number) => {
    updateDataType(specIndex, dataType.id, { arraySize: size });
  };

  return (
    <div className="space-y-3 bg-gray-700 p-4 rounded">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-300 font-medium">
          Array Field Configuration
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>Array Size:</span>
          <Input
            type="number"
            value={dataType.arraySize || 100}
            onChange={(e) => handleArraySizeChange(parseInt(e.target.value) || 100)}
            className="w-20 bg-gray-600 border-gray-500 text-white"
            min="1"
          />
        </div>
      </div>
      
      {arrayFields.map((arrayField, idx) => (
        <div key={idx} className="flex gap-2 items-center bg-gray-600 p-3 rounded">
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-1">Field Name</label>
            <Input
              value={arrayField.name}
              onChange={(e) => handleFieldNameChange(idx, e.target.value)}
              className="bg-gray-700 border-gray-500 text-white"
              placeholder="Field name"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-1">Field Type</label>
            <Select
              value={arrayField.type}
              onValueChange={(value: ArrayFieldSpec["type"]) => handleFieldTypeChange(idx, value)}
            >
              <SelectTrigger className="bg-gray-700 border-gray-500 text-white">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                {dataTypeOptions.map((option) => (
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
          </div>
          <Button
            onClick={() => handleRemoveField(idx)}
            size="sm"
            className="bg-red-500 hover:bg-red-600 text-white h-8 w-8 p-0"
            disabled={arrayFields.length <= 1}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      
      <Button
        onClick={handleAddField}
        size="sm"
        className="bg-green-500 hover:bg-green-600 text-white text-xs"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Field
      </Button>
      
      <div className="text-xs text-gray-400 space-y-1 bg-gray-800 p-2 rounded">
        <div>
          <strong>Preview:</strong> This creates indexed fields like:{" "}
          <code className="bg-gray-900 px-1 rounded">
            {arrayFields.map((field, idx) => 
              `${field.name}_0${idx < arrayFields.length - 1 ? ", " : ""}`
            ).join("")}, {arrayFields.map((field, idx) => 
              `${field.name}_1${idx < arrayFields.length - 1 ? ", " : ""}`
            ).join("")}, ...
          </code>
        </div>
        <div>
          <strong>Total:</strong> {arrayFields.length} field{arrayFields.length !== 1 ? "s" : ""} × {dataType.arraySize || 100} repetitions = {arrayFields.length * (dataType.arraySize || 100)} total fields
        </div>
        <div>
          <strong>Field types:</strong> {arrayFields.map(field => `${field.name}(${field.type})`).join(", ")}
        </div>
      </div>
    </div>
  );
}
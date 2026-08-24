import type { DataTypeField, FourLetterCodeSpec, StructDataType } from "./types";

export const STRUCT_TYPE_BYTES: Record<StructDataType, number> = {
  L: 4, l: 4, i: 4, I: 4, h: 2, H: 2, f: 4,
  B: 1, b: 1, x: 1, s: 1, p: 1, "?": 1,
};

export interface FieldLayout { field: DataTypeField; offset: number; byteLength: number; endOffset: number; }

export function parseSpecString(specStr: string, nameTokens: string[]): DataTypeField[] {
  const fields: DataTypeField[] = [];
  let cursor = 0, fieldIndex = 1, nameIndex = 0;
  while (cursor < specStr.length) {
    if (/\s/.test(specStr[cursor])) { cursor++; continue; }
    const match = specStr.slice(cursor).match(/^(\d+)?([LlIiHhfBbxsp?])/);
    if (!match) { cursor++; continue; }
    cursor += match[0].length;
    const count = match[1] ? Number.parseInt(match[1], 10) : 1;
    const type = match[2] as StructDataType;
    if (type === "x") {
      fields.push({ id: String(fieldIndex++), type, count, description: "", isPadding: true });
      continue;
    }
    const name = nameTokens[nameIndex];
    const arrayMatch = name?.match(/^([a-zA-Z_]+(?:`[a-zA-Z_]+)*)\[(\d+)\]$/);
    if (arrayMatch) {
      fields.push({ id: String(fieldIndex++), type, count, description: name, isArrayField: true,
        arraySize: Number.parseInt(arrayMatch[2], 10),
        arrayFields: arrayMatch[1].split("`").map((fieldName) => ({ name: fieldName.trim(), type })) });
      nameIndex++;
    } else if (match[1] && nameTokens.length - nameIndex >= count) {
      for (let index = 0; index < count; index++) {
        fields.push({ id: String(fieldIndex++), type, count: 1, description: nameTokens[nameIndex++] });
      }
    } else {
      fields.push({ id: String(fieldIndex++), type, count, description: name || `field_${fieldIndex - 1}` });
      nameIndex++;
    }
  }
  return fields.length ? fields : [{ id: "1", type: "i", count: 1, description: "field_1" }];
}

export function generateStructSpec(spec: Pick<FourLetterCodeSpec, "dataTypes" | "isArray">): string {
  const body = spec.dataTypes.map((field) => `${field.count > 1 ? field.count : ""}${field.isPadding ? "x" : field.type}`).join("");
  return body + (spec.isArray ? "+" : "");
}

export function generateDescriptions(fields: DataTypeField[]): string {
  return fields.filter((field) => !field.isPadding).map((field) => field.description).join(",");
}

export function generateSpecLine(spec: FourLetterCodeSpec): string {
  return `${spec.fourCC}:${generateStructSpec(spec)}:${generateDescriptions(spec.dataTypes)}`;
}

export function calculateFieldLayout(fields: DataTypeField[]): FieldLayout[] {
  let offset = 0;
  return fields.map((field) => {
    const byteLength = STRUCT_TYPE_BYTES[field.type] * field.count;
    const layout = { field, offset, byteLength, endOffset: offset + byteLength };
    offset += byteLength;
    return layout;
  });
}

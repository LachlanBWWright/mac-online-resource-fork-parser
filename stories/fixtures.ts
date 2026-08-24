import type { DataTypeOption, FourLetterCodeSpec } from "../src/components/resource-fork-parser/types";

export const dataTypeOptions: DataTypeOption[] = [
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

export const browseData = {
  Hedr: {
    "128": {
      name: "EarthFarm header",
      order: 0,
      obj: {
        version: 3,
        itemCount: 42,
        title: "EarthFarm",
        bounds: { left: 0, top: 0, right: 640, bottom: 480 },
        flags: ["demo", "terrain", "classic"],
      },
      data: "000000030000002A45617274684661726D",
    },
  },
  Terr: {
    "-1": {
      name: "Terrain palette",
      order: 1,
      obj: {
        paletteId: 7,
        isAnimated: true,
        tiles: [
          { id: 0, name: "Grass", elevation: 2 },
          { id: 1, name: "Water", elevation: 0 },
          { id: 2, name: "Rock", elevation: 5 },
          { id: 3, name: "Dirt", elevation: 1 },
          { id: 4, name: "Forest", elevation: 4 },
          { id: 5, name: "Snow", elevation: 8 },
        ],
      },
      data: "5445525241494E2D50414C45545445",
    },
  },
  Info: {
    "256": {
      name: "Build metadata",
      order: 2,
      obj: {
        author: "Otto",
        release: "1.4.2",
        notes: null,
        verified: true,
      },
      conversionError: "One optional field used a legacy encoding",
    },
  },
} as Record<string, unknown>;

export const definedSpec: FourLetterCodeSpec = {
  fourCC: "Hedr",
  dataTypes: [
    { id: "1", type: "i", count: 1, description: "version" },
    { id: "2", type: "I", count: 1, description: "itemCount" },
    { id: "3", type: "f", count: 2, description: "origin" },
    { id: "4", type: "x", count: 4, description: "", isPadding: true },
  ],
  isArray: false,
  autoPadding: true,
  status: "valid",
  statusMessage: "Successfully parsed data",
  sampleData: { version: 3, itemCount: 42, origin: [12.5, 9.25] },
  hasUserDefinedSpec: true,
};

export const undefinedSpec: FourLetterCodeSpec = {
  fourCC: "Terr",
  dataTypes: [{ id: "1", type: "i", count: 1, description: "field_1" }],
  isArray: false,
  autoPadding: false,
  status: "warning",
  statusMessage: "Struct specification not defined",
  rawData: new Uint8Array(Array.from({ length: 32 }, (_, index) => (index * 17) % 256)),
  hasUserDefinedSpec: false,
};

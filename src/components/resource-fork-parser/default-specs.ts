/** Fixed-size classic Mac Toolbox layouts used for safe type inference. */
export interface InferredResourceSpec {
  fourCC: string;
  format: string;
  fields: Array<{ type: "L" | "l" | "i" | "I" | "h" | "H" | "f" | "B" | "b" | "x" | "s" | "p" | "?"; count: number; description: string; isPadding?: boolean }>;
  isArray: boolean;
}

// Based on Apple's Inside Macintosh resource descriptions:
// https://dev.os9.ca/techpubs/mac/MoreToolbox/MoreToolbox-513.html
export const DEFAULT_RESOURCE_SPECS: InferredResourceSpec[] = [
  { fourCC: "card", format: "p", fields: [
    { type: "p", count: 1, description: "cardName" },
  ], isArray: false },
  { fourCC: "FREF", format: "4sHB", fields: [
    { type: "s", count: 4, description: "fileType" },
    { type: "H", count: 1, description: "localID" },
    { type: "B", count: 1, description: "emptyString" },
  ], isArray: false },
  { fourCC: "RECT", format: "hhhh", fields: [
    { type: "h", count: 1, description: "top" },
    { type: "h", count: 1, description: "left" },
    { type: "h", count: 1, description: "bottom" },
    { type: "h", count: 1, description: "right" },
  ], isArray: false },
  { fourCC: "SIZE", format: "HII", fields: [
    { type: "H", count: 1, description: "flags" },
    { type: "I", count: 1, description: "minimumPartitionSize" },
    { type: "I", count: 1, description: "preferredPartitionSize" },
  ], isArray: false },
  { fourCC: "finf", format: "hhh", fields: [
    { type: "h", count: 1, description: "fontID" },
    { type: "h", count: 1, description: "fontStyle" },
    { type: "h", count: 1, description: "fontSize" },
  ], isArray: false },
  { fourCC: "MBAR", format: "h", fields: [
    { type: "h", count: 1, description: "menuID" },
  ], isArray: true },
];

// Every resource type indexed in More Macintosh Toolbox is represented. The
// variable/application-defined formats use a byte list until a safe compiled
// layout is available; specialised package converters remain authoritative.
export const KNOWN_VARIABLE_RESOURCE_TYPES = [
  "BNDL", "cdev", "dctb", "DITL", "FKEY", "gama",
  "hdlg", "hfdr", "hmnu", "hovr", "hrct", "hwin", "icm#", "icm4",
  "icm8", "ictb", "INIT", "kind", "LDEF", "mach", "mntr", "movv",
  "nrct", "open", "PACK", "ROv#", "styl", "thng",
] as const;

for (const fourCC of KNOWN_VARIABLE_RESOURCE_TYPES) {
  DEFAULT_RESOURCE_SPECS.push({
    fourCC,
    format: "B",
    fields: [{ type: "B", count: 1, description: "bytes" }],
    isArray: true,
  });
}

export function getDefaultResourceSpec(fourCC: string) {
  return DEFAULT_RESOURCE_SPECS.find((spec) => spec.fourCC === fourCC);
}

export function defaultStructSpecStrings() {
  return DEFAULT_RESOURCE_SPECS.map(
    (spec) => `${spec.fourCC}:${spec.format}${spec.isArray ? "+" : ""}:${spec.fields.map((field) => field.description).join(",")}`,
  ).filter((spec) => !["BNDL", "DITL", "ROv#", "card", "dctb", "gama", "hdlg", "hfdr", "hmnu", "hovr", "hrct", "hwin", "icm#", "icm4", "icm8", "ictb", "kind", "mach", "nrct", "open", "styl", "thng"].some((type) => spec.startsWith(`${type}:`)));
}

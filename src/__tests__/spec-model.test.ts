import { describe, expect, it } from "vitest";
import { calculateFieldLayout, generateSpecLine, parseSpecString } from "../components/resource-fork-parser/spec-model";
import type { FourLetterCodeSpec } from "../components/resource-fork-parser/types";

describe("spec model", () => {
  it("parses and canonically regenerates counted fields, padding, booleans, strings, and lists", () => {
    const fields = parseSpecString("H2x?8s", ["flags", "enabled", "label"]);
    const spec: FourLetterCodeSpec = { fourCC: "TEST", dataTypes: fields, isArray: true, status: "valid" };
    expect(generateSpecLine(spec)).toBe("TEST:H2x?8s+:flags,enabled,label");
  });

  it("calculates byte offsets and record size", () => {
    const layout = calculateFieldLayout(parseSpecString("BH2xI", ["small", "medium", "large"]));
    expect(layout.map(({ offset, byteLength, endOffset }) => ({ offset, byteLength, endOffset }))).toEqual([
      { offset: 0, byteLength: 1, endOffset: 1 },
      { offset: 1, byteLength: 2, endOffset: 3 },
      { offset: 3, byteLength: 2, endOffset: 5 },
      { offset: 5, byteLength: 4, endOffset: 9 },
    ]);
  });

  it("expands counted scalar fields when each value has a name", () => {
    expect(parseSpecString("3i", ["x", "y", "z"]).map((field) => field.description)).toEqual(["x", "y", "z"]);
  });
});

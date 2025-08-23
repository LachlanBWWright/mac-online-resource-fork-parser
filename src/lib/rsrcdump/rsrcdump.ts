// Main API for rsrcdump TypeScript library

import type { ResourceFork, ResourceConverter, JsonOutput } from "./types";
import { ResourceForkParser } from "./resfork";
import { resourceForkToJson, jsonToResourceFork } from "./jsonio";
import { StructConverter, standardConverters } from "./resconverters";
import { parseTypeName } from "./textio";
import { unpackAdf, NotADFError, ADF_ENTRYNUM_RESOURCEFORK } from "./adf";
import {
  getDefaultOttoConverters,
  loadOttoSpecsFromText,
} from "./ottoSpecs";

export function load(data: Uint8Array): ResourceFork {
  try {
    const adfEntries = unpackAdf(data);
    const adfResfork = adfEntries.get(ADF_ENTRYNUM_RESOURCEFORK);
    if (!adfResfork) {
      throw new Error("No resource fork found in ADF");
    }
    return ResourceForkParser.fromBytes(adfResfork);
  } catch (error) {
    if (error instanceof NotADFError) {
      return ResourceForkParser.fromBytes(data);
    }
    throw error;
  }
}

export function saveToJson(
  data: Uint8Array,
  structSpecs: string[] = [],
  includeTypes: string[] = [],
  excludeTypes: string[] = [],
  useOttoSpecs: boolean = true,
): JsonOutput {
  const fork = load(data);

  return resourceForkToJson(
    fork,
    includeTypes.map(parseTypeName),
    excludeTypes.map(parseTypeName),
    getConverters(structSpecs, useOttoSpecs),
    {},
  );
}

export function saveToJsonWithOttoSpecs(
  data: Uint8Array,
  ottoSpecsText: string,
  structSpecs: string[] = [],
  includeTypes: string[] = [],
  excludeTypes: string[] = [],
): JsonOutput {
  const fork = load(data);

  const converters = new Map(standardConverters);

  // Add otto specs converters
  const ottoConverters = loadOttoSpecsFromText(ottoSpecsText);
  for (const [type, converter] of ottoConverters) {
    converters.set(type, converter);
  }

  // Add additional struct specs
  for (const templateArg of structSpecs) {
    const [converter, restype] =
      StructConverter.fromTemplateStringWithTypename(templateArg);
    if (converter && restype) {
      const typeName = new TextDecoder("utf-8").decode(restype).trim();
      converters.set(typeName, converter);
    }
  }

  return resourceForkToJson(
    fork,
    includeTypes.map(parseTypeName),
    excludeTypes.map(parseTypeName),
    converters,
    {},
  );
}

function getConverters(
  structSpecs: string[],
  useOttoSpecs: boolean = true,
): Map<string, ResourceConverter> {
  const converters = new Map(standardConverters);

  // Add default otto specs converters if requested
  if (useOttoSpecs) {
    const ottoConverters = getDefaultOttoConverters();
    for (const [type, converter] of ottoConverters) {
      converters.set(type, converter);
    }
  }

  // Add additional struct specs
  for (const templateArg of structSpecs) {
    const [converter, restype] =
      StructConverter.fromTemplateStringWithTypename(templateArg);
    if (converter && restype) {
      const typeName = new TextDecoder("utf-8").decode(restype).trim();
      converters.set(typeName, converter);
    }
  }

  return converters;
}

export function loadFromJson(
  jsonData: unknown,
  structSpecs: string[] = [],
  useOttoSpecs: boolean = true,
): ResourceFork {
  return jsonToResourceFork(
    jsonData as any,
    getConverters(structSpecs, useOttoSpecs),
  );
}

export function saveToBytes(fork: ResourceFork): Uint8Array {
  return ResourceForkParser.toBytes(fork);
}

export function saveFromJson(
  jsonData: unknown,
  structSpecs: string[] = [],
  useOttoSpecs: boolean = true,
): Uint8Array {
  const fork = loadFromJson(jsonData, structSpecs, useOttoSpecs);
  return saveToBytes(fork);
}

// Re-export types and utilities
export * from "./types";
export * from "./textio";
export * from "./resfork";
export * from "./resconverters";
export * from "./structtemplate";
export * from "./jsonio";

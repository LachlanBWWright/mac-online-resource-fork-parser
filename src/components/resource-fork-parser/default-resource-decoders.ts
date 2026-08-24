type ResourceValue = Record<string, unknown>;

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const i16 = (view: DataView, offset: number) => view.getInt16(offset, false);

function pascal(bytes: Uint8Array, offset: number) {
  const length = bytes[offset] ?? 0;
  return { value: text(bytes.slice(offset + 1, offset + 1 + length)), next: offset + 1 + length };
}

export const CUSTOM_DECODER_TYPES = new Set(["BNDL", "DITL", "ROv#", "card", "dctb", "gama", "hdlg", "hfdr", "hmnu", "hovr", "hrct", "hwin", "icm#", "icm4", "icm8", "ictb", "kind", "mach", "nrct", "open", "styl", "thng"]);

export function decodeKnownResource(type: string, bytes: Uint8Array): unknown | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === "card") return pascal(bytes, 0).value;
  if (type === "styl" && bytes.length >= 2) {
    const styleCount = view.getInt16(0, false);
    const styles = Array.from({ length: styleCount }, (_, index) => {
      const offset = 2 + index * 20;
      return { startChar: view.getInt32(offset, false), height: i16(view, offset + 4), ascent: i16(view, offset + 6), font: i16(view, offset + 8), face: bytes[offset + 10] ?? 0, size: i16(view, offset + 12), color: { red: view.getUint16(offset + 14, false), green: view.getUint16(offset + 16, false), blue: view.getUint16(offset + 18, false) } };
    });
    if (2 + styleCount * 20 !== bytes.length) throw new Error("Invalid styl length");
    return { styleCount, styles };
  }
  if (type === "gama" && bytes.length >= 12) {
    const version = i16(view, 0), gammaType = i16(view, 2), formulaSize = i16(view, 4), channels = i16(view, 6), dataCount = i16(view, 8), dataWidth = i16(view, 10);
    const formula = bytes.slice(12, 12 + formulaSize);
    const bytesPerSample = Math.max(1, Math.ceil(dataWidth / 8));
    const samples: number[] = [];
    let offset = 12 + formulaSize;
    for (let index = 0; index < channels * dataCount; index++) { let value = 0; for (let byte = 0; byte < bytesPerSample; byte++) value = value * 256 + (bytes[offset + byte] ?? 0); samples.push(value); offset += bytesPerSample; }
    if (offset !== bytes.length) throw new Error("Invalid gama length");
    return { version, type: gammaType, formulaSize, channels, dataCount, dataWidth, formulaData: Array.from(formula).map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase(), samples };
  }
  if (["hdlg", "hfdr", "hmnu", "hovr", "hrct", "hwin"].includes(type) && bytes.length >= 8) {
    const header = { version: view.getInt16(0, false), options: view.getInt16(2, false), balloonDefinitionID: view.getInt16(4, false), variation: view.getInt16(6, false) };
    const components: ResourceValue[] = [];
    let offset = 8;
    while (offset + 2 <= bytes.length) {
      const size = view.getUint16(offset, false); offset += 2;
      const payload = bytes.slice(offset, offset + size); offset += size;
      components.push({ size, data: Array.from(payload).map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase() });
    }
    if (offset !== bytes.length) throw new Error(`Invalid ${type} component length`);
    return { header, components };
  }
  if ((type === "dctb" || type === "ictb") && bytes.length >= 8) {
    const seed = view.getUint32(0, false);
    const flags = view.getInt16(4, false);
    const count = view.getUint16(6, false) + 1;
    const entries = Array.from({ length: count }, (_, index) => {
      const offset = 8 + index * 8;
      return { value: view.getUint16(offset, false), red: view.getUint16(offset + 2, false), green: view.getUint16(offset + 4, false), blue: view.getUint16(offset + 6, false) };
    });
    if (8 + count * 8 !== bytes.length) throw new Error(`Invalid ${type} length`);
    return { seed, flags, entries };
  }
  if (type === "mach" && bytes.length >= 4) return { hardwareMask: view.getUint16(0, false), softwareMask: view.getUint16(2, false) };
  if (type === "nrct" && bytes.length >= 2) {
    const count = view.getUint16(0, false);
    const rectangles = Array.from({ length: count }, (_, index) => {
      const offset = 2 + index * 8;
      return { top: i16(view, offset), left: i16(view, offset + 2), bottom: i16(view, offset + 4), right: i16(view, offset + 6) };
    });
    if (2 + count * 8 !== bytes.length) throw new Error("Invalid nrct length");
    return { count, rectangles };
  }
  if (type === "open" && bytes.length >= 4) {
    const fileTypes = [];
    for (let offset = 4; offset + 4 <= bytes.length; offset += 4) fileTypes.push(text(bytes.slice(offset, offset + 4)));
    return { signature: text(bytes.slice(0, 4)), fileTypes };
  }
  if (type === "ROv#" && bytes.length >= 4) {
    const romVersion = view.getUint16(0, false);
    const resourceCount = view.getUint16(2, false);
    const overrides: ResourceValue[] = [];
    let offset = 4;
    for (let index = 0; index < resourceCount; index++) {
      overrides.push({ resourceType: text(bytes.slice(offset, offset + 4)), resourceID: view.getInt16(offset + 4, false) });
      offset += 6;
    }
    if (offset !== bytes.length) throw new Error("Invalid ROv# length");
    return { romVersion, resourceCount, overrides };
  }
  if (["icm#", "icm4", "icm8"].includes(type)) {
    const width = 12, height = 16;
    const rowBytes = Math.ceil(width / 8);
    const expected = type === "icm#" ? rowBytes * height * 2 : (type === "icm4" ? (width / 2) * height : width * height);
    if (bytes.length !== expected) throw new Error(`Invalid ${type} length`);
    return { width, height, format: type === "icm#" ? "1-bit image and mask" : type === "icm4" ? "4-bit indexed pixels" : "8-bit indexed pixels", data: Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase() };
  }
  if (type === "kind" && bytes.length >= 6) {
    const entries: ResourceValue[] = [];
    let offset = 6;
    while (offset + 5 <= bytes.length) {
      const kind = pascal(bytes, offset + 4);
      entries.push({ fileType: text(bytes.slice(offset, offset + 4)), kind: kind.value });
      offset = kind.next;
    }
    return { signature: text(bytes.slice(0, 4)), localization: view.getUint16(4, false), entries };
  }
  if (type === "BNDL" && bytes.length >= 8) {
    let offset = 0;
    const signature = text(bytes.slice(offset, offset + 4)); offset += 4;
    const signatureResourceID = view.getUint16(offset, false); offset += 2;
    const mappings: ResourceValue[] = [];
    const typeCount = view.getUint16(offset, false) + 1; offset += 2;
    for (let index = 0; index < typeCount; index++) {
      const resourceType = text(bytes.slice(offset, offset + 4)); offset += 4;
      const items: ResourceValue[] = [];
      const pairCount = view.getUint16(offset, false) + 1; offset += 2;
      for (let pair = 0; pair < pairCount; pair++) {
        items.push({ localID: view.getUint16(offset, false), resourceID: view.getUint16(offset + 2, false) }); offset += 4;
      }
      mappings.push({ resourceType, items });
    }
    if (offset !== bytes.length) throw new Error("Invalid BNDL length");
    return { signature, signatureResourceID, mappings };
  }
  if (type === "thng" && bytes.length >= 40) {
    let offset = 0;
    const fourCC = () => { const value = text(bytes.slice(offset, offset + 4)); offset += 4; return value; };
    const description = { type: fourCC(), subtype: fourCC(), manufacturer: fourCC(), flags: view.getUint32(offset, false), flagsMask: view.getUint32(offset + 4, false) };
    offset += 8;
    const resourceSpec = () => { const type = fourCC(); const id = view.getInt16(offset, false); offset += 2; return { type, id }; };
    return { description, component: resourceSpec(), name: resourceSpec(), info: resourceSpec(), icon: resourceSpec() };
  }
  if (type === "DITL" && bytes.length >= 2) {
    const names: Record<number, string> = { 0: "userItem", 4: "button", 5: "checkbox", 6: "radioButton", 7: "control", 8: "staticText", 16: "editableText", 32: "icon", 64: "picture" };
    const count = view.getUint16(0, false);
    const items: ResourceValue[] = [];
    let offset = 2;
    for (let index = 0; index <= count; index++) {
      const kindByte = bytes[offset + 8] ?? 0;
      const kind = kindByte & 0x7f;
      const item: ResourceValue = { index: index + 1, bounds: { top: i16(view, offset), left: i16(view, offset + 2), bottom: i16(view, offset + 4), right: i16(view, offset + 6) }, type: names[kind] ?? `unknown(${kind})`, enabled: !(kindByte & 0x80) };
      offset += 9;
      if ([4, 5, 6, 8, 16].includes(kind)) { const value = pascal(bytes, offset); item.text = value.value; offset = value.next; }
      else if ([7, 32, 64].includes(kind)) { item.resourceID = view.getUint16(offset, false); offset += 2; }
      if (offset % 2) offset++;
      items.push(item);
    }
    return items;
  }
  return undefined;
}

export function applyKnownDecoders(parsed: unknown, resourceFork: { tree?: Map<string, Map<number, { data: Uint8Array }>> }) {
  if (!parsed || typeof parsed !== "object" || !resourceFork.tree) return;
  const result = parsed as Record<string, unknown>;
  for (const type of CUSTOM_DECODER_TYPES) {
    const resources = resourceFork.tree.get(type);
    const output = result[type];
    if (!resources || !output || typeof output !== "object") continue;
    for (const [id, resource] of resources) {
      const decoded = decodeKnownResource(type, resource.data);
      const entry = (output as Record<string, unknown>)[String(id)] as ResourceValue | undefined;
      if (decoded !== undefined && entry && typeof entry === "object") entry.obj = decoded;
    }
  }
}

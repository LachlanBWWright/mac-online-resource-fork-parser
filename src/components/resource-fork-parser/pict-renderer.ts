/**
 * Small, browser-safe QuickDraw PICT raster decoder.
 *
 * This intentionally focuses on the raster opcodes used by classic game and
 * application resource forks: BitsRect, PackBitsRect, DirectBitsRect and
 * their region variants. Unsupported drawing opcodes are skipped when their
 * record length is defined, so a picture can still be previewed when it also
 * contains text or vector annotations.
 */

type Rect = { top: number; left: number; bottom: number; right: number };
type Raster = {
  rowBytes: number;
  rect: Rect;
  isPixmap: boolean;
  packType: number;
  pixelSize: number;
  componentCount: number;
};

export type PictImage = { width: number; height: number; rgba: Uint8ClampedArray };

class Reader {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  offset = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get remaining() { return this.bytes.length - this.offset; }
  get position() { return this.offset; }
  u8() { this.ensure(1); return this.view.getUint8(this.offset++); }
  i8() { this.ensure(1); return this.view.getInt8(this.offset++); }
  u16() { this.ensure(2); const value = this.view.getUint16(this.offset, false); this.offset += 2; return value; }
  i16() { this.ensure(2); const value = this.view.getInt16(this.offset, false); this.offset += 2; return value; }
  u32() { this.ensure(4); const value = this.view.getUint32(this.offset, false); this.offset += 4; return value; }
  skip(length: number) { this.ensure(length); this.offset += length; }
  read(length: number) { this.ensure(length); const value = this.bytes.slice(this.offset, this.offset + length); this.offset += length; return value; }
  private ensure(length: number) { if (length < 0 || this.offset + length > this.bytes.length) throw new Error("Truncated PICT data"); }
}

function rect(reader: Reader): Rect {
  return { top: reader.i16(), left: reader.i16(), bottom: reader.i16(), right: reader.i16() };
}

function width(value: Rect) { return Math.max(0, value.right - value.left); }
function height(value: Rect) { return Math.max(0, value.bottom - value.top); }

function unpackPackBits(row: Uint8Array, expected: number) {
  const output: number[] = [];
  let offset = 0;
  while (offset < row.length && output.length < expected) {
    const flag = new DataView(row.buffer, row.byteOffset + offset, 1).getInt8(0);
    offset += 1;
    if (flag >= 0) {
      const count = flag + 1;
      output.push(...row.slice(offset, offset + count));
      offset += count;
    } else if (flag !== -128) {
      const count = 1 - flag;
      const value = row[offset] ?? 0;
      offset += 1;
      for (let index = 0; index < count; index++) output.push(value);
    }
  }
  if (output.length < expected) throw new Error("Invalid PackBits scanline");
  return output.slice(0, expected);
}

function readRows(reader: Reader, raster: Raster, packed: boolean) {
  const rows: number[][] = [];
  const rowCount = height(raster.rect);
  for (let y = 0; y < rowCount; y++) {
    if (!packed || raster.rowBytes < 8) rows.push(Array.from(reader.read(raster.rowBytes)));
    else {
      const packedLength = raster.rowBytes > 250 ? reader.u16() : reader.u8();
      rows.push(unpackPackBits(reader.read(packedLength), raster.rowBytes));
    }
  }
  return rows;
}

function readRaster(reader: Reader): Raster {
  const rowBytesFlag = reader.u16();
  const isPixmap = Boolean(rowBytesFlag & 0x8000);
  const raster: Raster = {
    rowBytes: rowBytesFlag & 0x7fff,
    rect: rect(reader),
    isPixmap,
    packType: 0,
    pixelSize: 1,
    componentCount: 1,
  };
  if (isPixmap) {
    reader.u16(); // pmVersion
    raster.packType = reader.u16();
    reader.u32(); // packSize
    reader.u32(); reader.u32(); // hRes / vRes
    reader.u16(); // pixelType
    raster.pixelSize = reader.u16();
    raster.componentCount = reader.u16();
    reader.u16(); // cmpSize
    reader.u32(); // planeBytes
    reader.u32(); // pmTable
    reader.skip(4); // pmReserved
  }
  return raster;
}

function readPalette(reader: Reader) {
  const palette = Array.from({ length: 256 }, () => [255, 0, 255, 255]);
  reader.u32(); // seed
  reader.u16(); // flags
  const count = reader.u16() + 1;
  if (count > 256) throw new Error("Unsupported PICT palette size");
  for (let index = 0; index < count; index++) {
    let paletteIndex = reader.u16();
    if (paletteIndex >= 256) paletteIndex = index;
    if (paletteIndex === 0) paletteIndex = index;
    const red = reader.u16() >> 8;
    const green = reader.u16() >> 8;
    const blue = reader.u16() >> 8;
    palette[paletteIndex] = [red, green, blue, 255];
  }
  return palette;
}

function indexedPixels(rows: number[][], raster: Raster, palette: number[][]) {
  const w = width(raster.rect);
  const h = height(raster.rect);
  const output = new Uint8ClampedArray(w * h * 4);
  const pixelsPerByte = 8 / raster.pixelSize;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const byte = rows[y]?.[Math.floor(x / pixelsPerByte)] ?? 0;
    const shift = (pixelsPerByte - 1 - (x % pixelsPerByte)) * raster.pixelSize;
    const index = (byte >> shift) & ((1 << raster.pixelSize) - 1);
    const color = palette[index] ?? [0, 0, 0, 255];
    output.set(color, (y * w + x) * 4);
  }
  return output;
}

function directPixels(rows: number[][], raster: Raster) {
  const w = width(raster.rect);
  const h = height(raster.rect);
  const output = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const row = rows[y] ?? [];
    let red = 0, green = 0, blue = 0, alpha = 255;
    if (raster.packType === 3 || raster.pixelSize === 16) {
      const offset = x * 2;
      const value = ((row[offset] ?? 0) << 8) | (row[offset + 1] ?? 0);
      red = Math.round(((value >> 10) & 31) * 255 / 31);
      green = Math.round(((value >> 5) & 31) * 255 / 31);
      blue = Math.round((value & 31) * 255 / 31);
    } else if (raster.componentCount >= 3) {
      const planeWidth = w;
      const offset = x;
      if (raster.componentCount === 4) {
        alpha = row[offset] ?? 255;
        red = row[offset + planeWidth] ?? 0;
        green = row[offset + planeWidth * 2] ?? 0;
        blue = row[offset + planeWidth * 3] ?? 0;
      } else {
        red = row[offset] ?? 0;
        green = row[offset + planeWidth] ?? 0;
        blue = row[offset + planeWidth * 2] ?? 0;
      }
    }
    output.set([red, green, blue, alpha], (y * w + x) * 4);
  }
  return output;
}

function blit(canvas: Uint8ClampedArray, canvasRect: Rect, destination: Rect, source: Rect, pixels: Uint8ClampedArray) {
  const canvasWidth = width(canvasRect);
  const sourceWidth = width(source);
  const sourceHeight = height(source);
  const targetWidth = width(destination);
  const targetHeight = height(destination);
  const copyWidth = Math.min(sourceWidth, targetWidth);
  const copyHeight = Math.min(sourceHeight, targetHeight);
  for (let y = 0; y < copyHeight; y++) for (let x = 0; x < copyWidth; x++) {
    const targetX = destination.left - canvasRect.left + x;
    const targetY = destination.top - canvasRect.top + y;
    if (targetX < 0 || targetY < 0 || targetX >= width(canvasRect) || targetY >= height(canvasRect)) continue;
    const sourceIndex = (y * sourceWidth + x) * 4;
    const targetIndex = (targetY * canvasWidth + targetX) * 4;
    canvas.set(pixels.slice(sourceIndex, sourceIndex + 4), targetIndex);
  }
}

function skipSimpleOpcode(reader: Reader, opcode: number) {
  const fixedLengths: Record<number, number> = {
    0x00: 0, 0x02: 8, 0x03: 2, 0x04: 1, 0x05: 1, 0x07: 4, 0x08: 2, 0x09: 8, 0x0a: 8,
    0x0b: 4, 0x0c: 4, 0x0d: 2, 0x0e: 4, 0x0f: 4, 0x10: 8, 0x1a: 6, 0x1b: 6, 0x1c: 0, 0x1d: 6,
    0x1e: 0, 0x1f: 6, 0x20: 8, 0x21: 4, 0x22: 4, 0x23: 2, 0x28: 5, 0x29: 2, 0x2a: 2, 0x2b: 3,
    0x30: 8, 0x31: 8, 0x32: 8, 0x33: 8, 0x34: 8, 0x38: 0x00, 0x39: 0x00, 0x3a: 0x00, 0x3b: 0x00, 0x3c: 0x00,
    0x40: 8, 0x41: 8, 0x42: 8, 0x43: 8, 0x44: 8, 0x48: 0x00, 0x49: 0x00, 0x4a: 0x00, 0x4b: 0x00, 0x4c: 0x00,
    0x50: 8, 0x51: 8, 0x52: 8, 0x53: 8, 0x54: 8, 0x58: 0x00, 0x59: 0x00, 0x5a: 0x00, 0x5b: 0x00, 0x5c: 0x00,
    0x60: 12, 0x61: 12, 0x62: 12, 0x63: 12, 0x64: 12, 0x68: 0x00, 0x69: 0x00, 0x6a: 0x00, 0x6b: 0x00, 0x6c: 0x00,
    0xa0: 2, 0xa1: 4,
  };
  if (opcode === 0x01) { const size = reader.u16(); reader.skip(Math.max(0, size - 2)); return; }
  if (opcode === 0x28) { reader.skip(4); reader.skip(reader.u8()); return; }
  if (opcode === 0x29 || opcode === 0x2a) { reader.skip(1); reader.skip(reader.u8()); return; }
  if (opcode === 0x2b) { reader.skip(2); reader.skip(reader.u8()); return; }
  if (opcode === 0x2c) { const dataLength = reader.u16(); reader.skip(3); reader.skip(Math.max(0, dataLength - 5)); return; }
  if (opcode === 0x2d) { const dataLength = reader.u16(); reader.skip(Math.max(0, dataLength - 2)); return; }
  if (opcode === 0x2e) { const dataLength = reader.u16(); reader.skip(Math.max(0, dataLength - 2)); return; }
  if ((opcode >= 0x70 && opcode <= 0x74) || (opcode >= 0x80 && opcode <= 0x84)) {
    const dataLength = reader.u16(); reader.skip(Math.max(0, dataLength - 2)); return;
  }
  if ((opcode >= 0x78 && opcode <= 0x7c) || (opcode >= 0x88 && opcode <= 0x8c)) return;
  if (opcode === 0xa1) { reader.u16(); reader.skip(reader.u16()); return; }
  const length = fixedLengths[opcode];
  if (length !== undefined) reader.skip(length);
  else {
    const reservedLength = opcode >= 0x35 && opcode <= 0x37 ? 8
      : opcode >= 0x45 && opcode <= 0x47 ? 8
      : opcode >= 0x55 && opcode <= 0x57 ? 8
      : opcode >= 0x65 && opcode <= 0x67 ? 12
      : opcode >= 0x6d && opcode <= 0x6f ? 4
      : opcode >= 0x100 && opcode <= 0x1ff ? 2
      : opcode === 0x200 ? 4
      : opcode === 0x2ff ? 2
      : opcode === 0xbff ? 22
      : opcode >= 0xc00 && opcode <= 0x7eff ? 24
      : opcode >= 0x7f00 && opcode <= 0x7fff ? 254
      : opcode >= 0x8000 && opcode <= 0x80ff ? 0
      : opcode >= 0xd0 && opcode <= 0xfe ? reader.u16() : -1;
    if (reservedLength < 0) throw new Error(`Unsupported PICT opcode 0x${opcode.toString(16)}`);
    reader.skip(reservedLength);
  }
}

function readImage(reader: Reader, opcode: number) {
  const direct = opcode === 0x9a || opcode === 0x9b;
  if (direct) reader.skip(4);
  const raster = readRaster(reader);
  const palette = !direct && raster.isPixmap ? readPalette(reader) : undefined;
  const source = rect(reader);
  const destination = rect(reader);
  reader.i16(); // transfer mode
  if (opcode === 0x91 || opcode === 0x99 || opcode === 0x9b) {
    const regionSize = reader.u16();
    reader.skip(Math.max(0, regionSize - 2));
  }
  const packed = opcode === 0x98 || opcode === 0x99 || opcode === 0x9a || opcode === 0x9b;
  const rows = readRows(reader, raster, packed);
  const pixels = raster.isPixmap && direct ? directPixels(rows, raster) : raster.isPixmap ? indexedPixels(rows, raster, palette ?? []) : indexedPixels(rows, { ...raster, pixelSize: 1 }, [[255, 255, 255, 255], [0, 0, 0, 255]]);
  return { source: raster.rect, destination, sourceRect: source, pixels };
}

export function renderPict(bytes: Uint8Array): PictImage {
  const reader = new Reader(bytes);
  reader.u16();
  const canvasRect = rect(reader);
  if (width(canvasRect) <= 0 || height(canvasRect) <= 0 || width(canvasRect) > 4096 || height(canvasRect) > 4096) throw new Error("Invalid PICT canvas dimensions");
  const versionMarker = reader.u16();
  let version: 1 | 2;
  if (versionMarker === 0x1101) version = 1;
  else if (versionMarker === 0x0011 && reader.u8() === 0x02 && reader.u8() === 0xff) version = 2;
  else throw new Error("Unsupported PICT version");
  const rgba = new Uint8ClampedArray(width(canvasRect) * height(canvasRect) * 4);
  rgba.fill(255);
  while (reader.remaining > 0) {
    if (version === 2 && reader.position % 2) reader.skip(1);
    const opcode = version === 1 ? reader.u8() : reader.u16();
    if (opcode === 0xff) break;
    if (opcode === 0x90 || opcode === 0x91 || opcode === 0x98 || opcode === 0x99 || opcode === 0x9a || opcode === 0x9b) {
      const image = readImage(reader, opcode);
      blit(rgba, canvasRect, image.destination, image.sourceRect, image.pixels);
    } else if (opcode === 0x8200 || opcode === 0x8201) {
      const length = reader.u32(); reader.skip(length);
    } else skipSimpleOpcode(reader, opcode);
  }
  return { width: width(canvasRect), height: height(canvasRect), rgba };
}

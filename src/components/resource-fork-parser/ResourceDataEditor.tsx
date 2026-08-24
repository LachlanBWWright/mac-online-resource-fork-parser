import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { renderPict } from "./pict-renderer";

type Props = {
  fourCC: string;
  resourceId: string;
  hex: string;
  onChange: (hex: string) => void;
  readOnly?: boolean;
};

const ICON_TYPES = new Set(["ICN#", "ics#", "icm#", "icl4", "ics4", "icm4", "icl8", "ics8", "icm8"]);
const TEXT_TYPES = new Set(["TEXT", "STR ", "STR#", "plst"]);
const PICT_TYPES = new Set(["PICT"]);

function bytesFromHex(value: string) {
  const clean = value.replace(/\s/g, "");
  if (!/^[0-9a-f]*$/i.test(clean) || clean.length % 2) throw new Error("Use complete hexadecimal byte pairs");
  return Uint8Array.from({ length: clean.length / 2 }, (_, index) => Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16));
}

function hexFromBytes(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function iconDimensions(type: string) {
  if (type.startsWith("icm")) return { width: 12, height: 16 };
  if (type.startsWith("ics")) return { width: 16, height: 16 };
  return { width: 32, height: 32 };
}

function pixelOffset(type: string, width: number, x: number, y: number) {
  if (type.endsWith("#")) return { byte: y * Math.ceil(width / 8) + Math.floor(x / 8), mask: 1 << (7 - (x % 8)) };
  if (type.endsWith("4")) return { byte: y * (width / 2) + Math.floor(x / 2), mask: x % 2 === 0 ? 0xf0 : 0x0f };
  return { byte: y * width + x, mask: 0xff };
}

export default function ResourceDataEditor({ fourCC, resourceId, hex, onChange, readOnly = false }: Props) {
  const [draft, setDraft] = useState(hex);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pictCanvasRef = useRef<HTMLCanvasElement>(null);
  const isIcon = ICON_TYPES.has(fourCC);
  const isText = TEXT_TYPES.has(fourCC);
  const isPict = PICT_TYPES.has(fourCC);
  const [pictError, setPictError] = useState("");

  useEffect(() => setDraft(hex), [hex]);

  const bytes = (() => { try { return bytesFromHex(draft); } catch { return null; } })();
  const dimensions = isIcon ? iconDimensions(fourCC) : null;

  useEffect(() => {
    if (!canvasRef.current || !isIcon || !bytes || !dimensions) return;
    const canvas = canvasRef.current;
    const scale = 8;
    canvas.width = dimensions.width * scale;
    canvas.height = dimensions.height * scale;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#111827";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const monochrome = fourCC.endsWith("#");
    const planeLength = monochrome ? Math.ceil(dimensions.width / 8) * dimensions.height : 0;
    for (let y = 0; y < dimensions.height; y++) for (let x = 0; x < dimensions.width; x++) {
      const position = pixelOffset(fourCC, dimensions.width, x, y);
      let value = 0;
      if (position.byte < bytes.length) value = fourCC.endsWith("4") ? ((bytes[position.byte] ?? 0) >> (x % 2 === 0 ? 4 : 0)) & 0xf : bytes[position.byte] ?? 0;
      if (monochrome && planeLength + position.byte < bytes.length && !((bytes[planeLength + position.byte] ?? 0) & position.mask)) value = 0;
      const shade = monochrome ? (value & position.mask ? "#f9fafb" : "#374151") : `hsl(${(value * 23) % 360} 75% ${value === 0 ? 18 : 60}%)`;
      context.fillStyle = shade;
      context.fillRect(x * scale, y * scale, scale, scale);
    }
  }, [bytes, dimensions, fourCC, isIcon]);

  useEffect(() => {
    if (!isPict || !bytes || !pictCanvasRef.current) return;
    try {
      const image = renderPict(bytes);
      const canvas = pictCanvasRef.current;
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext("2d")?.putImageData(new ImageData(image.rgba, image.width, image.height), 0, 0);
      setPictError("");
    } catch (caught) {
      setPictError(caught instanceof Error ? caught.message : "Unable to decode this QuickDraw picture");
    }
  }, [bytes, isPict]);

  if (!isIcon && !isText && !isPict) return null;

  const commit = (value: string) => {
    try { onChange(hexFromBytes(bytesFromHex(value))); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Invalid data"); }
  };

  const editPixel = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly || !bytes || !dimensions) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(dimensions.width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * dimensions.width));
    const y = Math.min(dimensions.height - 1, Math.floor(((event.clientY - rect.top) / rect.height) * dimensions.height));
    const next = new Uint8Array(bytes);
    const position = pixelOffset(fourCC, dimensions.width, x, y);
    if (fourCC.endsWith("#")) next[position.byte] ^= position.mask;
    else if (fourCC.endsWith("4")) next[position.byte] = (next[position.byte] & (x % 2 === 0 ? 0x0f : 0xf0)) | (x % 2 === 0 ? 0xf0 : 0x0f);
    else next[position.byte] = (next[position.byte] + 1) & 0xff;
    onChange(hexFromBytes(next));
  };

  if (isText) {
    let text = "";
    try {
      if (fourCC === "STR ") {
        const length = bytes?.[0] ?? 0;
        text = new TextDecoder().decode(bytes?.slice(1, 1 + length));
      } else if (fourCC === "STR#") {
        const view = bytes ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength) : null;
        const strings: string[] = [];
        let offset = 2;
        for (let index = 0; view && index < view.getUint16(0, false); index++) {
          const length = bytes?.[offset] ?? 0;
          strings.push(new TextDecoder().decode(bytes?.slice(offset + 1, offset + 1 + length)));
          offset += 1 + length;
        }
        text = strings.join("\n");
      } else text = new TextDecoder().decode(bytes ?? new Uint8Array());
    } catch { /* show an empty text editor for malformed data */ }
    const encodeText = (value: string) => {
      const encoded = new TextEncoder().encode(value);
      if (fourCC === "STR ") onChange(hexFromBytes(new Uint8Array([encoded.length, ...encoded])));
      else if (fourCC === "STR#") {
        const strings = value.split("\n").map((line) => new TextEncoder().encode(line));
        const result = new Uint8Array(2 + strings.reduce((total, line) => total + 1 + line.length, 0));
        const view = new DataView(result.buffer); view.setUint16(0, strings.length, false);
        let offset = 2;
        for (const line of strings) { result[offset++] = line.length; result.set(line, offset); offset += line.length; }
        onChange(hexFromBytes(result));
      } else onChange(hexFromBytes(encoded));
    };
    return <div className="space-y-2 border border-gray-700 bg-gray-900/60 p-3">
      <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-gray-400">ASCII text editor</span><span className="text-xs text-gray-500">{fourCC.trim() || "TEXT"} · #{resourceId}</span></div>
      <textarea aria-label={`ASCII text for ${fourCC} ${resourceId}`} value={text} readOnly={readOnly} onChange={(event) => encodeText(event.target.value)} className="min-h-28 w-full resize-y border border-gray-700 bg-gray-950 p-2 font-mono text-sm text-gray-100 outline-none focus:border-blue-500" />
      <div className="text-xs text-gray-500">UTF-8 bytes are shown here; plain ASCII remains byte-for-byte compatible.</div>
    </div>;
  }

  if (isPict) return <div className="space-y-3 border border-gray-700 bg-gray-900/60 p-3">
    <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wide text-gray-400">QuickDraw picture renderer</span><span className="text-xs text-gray-500">{fourCC} · #{resourceId}</span></div>
    <div className="overflow-auto border border-gray-600 bg-[linear-gradient(45deg,#1f2937_25%,transparent_25%),linear-gradient(-45deg,#1f2937_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f2937_75%),linear-gradient(-45deg,transparent_75%,#1f2937_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0] p-3">
      <canvas ref={pictCanvasRef} aria-label={`Rendered QuickDraw picture ${fourCC} ${resourceId}`} className="h-auto max-w-full" />
    </div>
    {pictError ? <p className="text-xs text-amber-300">Preview unavailable: {pictError}. The original bytes remain editable below.</p> : <p className="text-xs text-gray-500">Decoded from the PICT raster opcodes in the resource. Drawing-only records are skipped when their bounds are known.</p>}
    <div className="flex gap-2"><Input aria-label={`Hex data for ${fourCC} ${resourceId}`} value={draft} readOnly={readOnly} onChange={(event) => setDraft(event.target.value)} className="font-mono text-xs" />{!readOnly && <Button size="sm" onClick={() => commit(draft)}>Apply hex</Button>}</div>
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>;

  return <div className="space-y-3 border border-gray-700 bg-gray-900/60 p-3">
    <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Bitmap editor</span><span className="text-xs text-gray-500">{dimensions?.width}×{dimensions?.height} · {fourCC}</span></div>
    <canvas ref={canvasRef} onClick={editPixel} aria-label={`Edit ${fourCC} bitmap ${resourceId}`} className="h-auto max-w-full cursor-crosshair border border-gray-600 bg-gray-950" />
    {!readOnly && <p className="text-xs text-gray-500">Click pixels to toggle monochrome values or cycle indexed color values.</p>}
    <div className="flex gap-2"><Input aria-label={`Hex data for ${fourCC} ${resourceId}`} value={draft} readOnly={readOnly} onChange={(event) => setDraft(event.target.value)} className="font-mono text-xs" />{!readOnly && <Button size="sm" onClick={() => commit(draft)}>Apply hex</Button>}</div>
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>;
}

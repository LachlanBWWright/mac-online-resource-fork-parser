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

function printableByte(byte: number) {
  return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".";
}

function HexEditor({ fourCC, resourceId, hex, onChange, readOnly }: Props) {
  const [draft, setDraft] = useState(hex);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [cellDrafts, setCellDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    setDraft(hex);
    setPage(0);
    setCellDrafts({});
    setError("");
  }, [hex]);

  const bytes = (() => {
    try { return bytesFromHex(draft); } catch { return null; }
  })();
  const pageSize = 256;
  const pageCount = bytes ? Math.max(1, Math.ceil(bytes.length / pageSize)) : 1;
  const pageStart = page * pageSize;
  const pageBytes = bytes?.slice(pageStart, pageStart + pageSize) ?? new Uint8Array();
  const rows = Array.from({ length: Math.ceil(pageBytes.length / 16) }, (_, row) => pageBytes.slice(row * 16, row * 16 + 16));

  const updateByte = (absoluteIndex: number, value: string) => {
    const cleaned = value.replace(/[^0-9a-f]/gi, "").slice(0, 2).toUpperCase();
    setCellDrafts((current) => ({ ...current, [absoluteIndex]: cleaned }));
    if (cleaned.length !== 2) return;
    try {
      const next = bytesFromHex(draft);
      if (absoluteIndex >= next.length) return;
      next[absoluteIndex] = Number.parseInt(cleaned, 16);
      setDraft(hexFromBytes(next));
      setCellDrafts((current) => ({ ...current, [absoluteIndex]: cleaned }));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invalid data");
    }
  };

  const finishByte = (absoluteIndex: number) => {
    const value = cellDrafts[absoluteIndex];
    if (value === undefined || value.length === 2) return;
    if (value.length === 1) updateByte(absoluteIndex, `0${value}`);
    else setCellDrafts((current) => {
      return Object.fromEntries(Object.entries(current).filter(([key]) => key !== String(absoluteIndex)));
    });
  };

  const commit = () => {
    try {
      onChange(hexFromBytes(bytesFromHex(draft)));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invalid data");
    }
  };

  return <div data-testid="hex-editor" className="space-y-3 border border-gray-700 bg-gray-900/60 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-300">Hex editor</div>
        <div className="text-xs text-gray-500">{fourCC} · #{resourceId} · {bytes?.length ?? 0} bytes</div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Page {Math.min(page + 1, pageCount)} of {pageCount}</span>
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</Button>
        <Button size="sm" variant="outline" disabled={page >= pageCount - 1} onClick={() => setPage((current) => current + 1)}>Next</Button>
        {!readOnly && <Button size="sm" onClick={commit}>Apply changes</Button>}
      </div>
    </div>
    {bytes ? <div className="overflow-auto border border-gray-700 bg-gray-950 p-2">
      <table className="min-w-[780px] border-collapse font-mono text-xs" aria-label={`Hex data for ${fourCC} ${resourceId}`}>
        <thead className="text-gray-500">
          <tr>
            <th className="w-24 px-2 py-1 text-left font-normal">Offset</th>
            {Array.from({ length: 16 }, (_, index) => <th key={index} className="w-8 px-1 py-1 text-center font-normal">{index.toString(16).toUpperCase()}</th>)}
            <th className="px-3 py-1 text-left font-normal">ASCII</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const absoluteStart = pageStart + rowIndex * 16;
            return <tr key={absoluteStart} className="border-t border-gray-800">
              <td className="px-2 py-1 text-gray-500">{absoluteStart.toString(16).padStart(8, "0").toUpperCase()}</td>
              {Array.from({ length: 16 }, (_, column) => {
                const absoluteIndex = absoluteStart + column;
                const byte = row[column];
                if (byte === undefined) return <td key={column} />;
                const value = cellDrafts[absoluteIndex] ?? byte.toString(16).padStart(2, "0").toUpperCase();
                return <td key={column} className="px-1 py-1">
                  <input
                    aria-label={`Hex byte ${absoluteIndex}`}
                    data-testid={`hex-byte-${absoluteIndex}`}
                    value={value}
                    maxLength={2}
                    readOnly={readOnly}
                    spellCheck={false}
                    onChange={(event) => updateByte(absoluteIndex, event.target.value)}
                    onBlur={() => finishByte(absoluteIndex)}
                    className="h-7 w-8 rounded border border-gray-700 bg-gray-900 px-1 text-center text-gray-100 outline-none transition-colors hover:border-gray-500 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50"
                  />
                </td>;
              })}
              <td className="whitespace-pre px-3 py-1 text-gray-400">{Array.from(row, printableByte).join("")}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div> : <p className="text-sm text-red-300">The draft contains invalid hexadecimal data. Fix it before applying changes.</p>}
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    <p className="text-xs text-gray-500">Edit bytes as hexadecimal pairs. The ASCII column is a read-only preview; changes are saved when you apply them.</p>
  </div>;
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
  const [pictZoom, setPictZoom] = useState(1);
  const [pictPixel, setPictPixel] = useState<{ x: number; y: number; color: string } | null>(null);
  const [iconZoom, setIconZoom] = useState(8);
  const [iconGrid, setIconGrid] = useState(true);

  useEffect(() => setDraft(hex), [hex]);

  const bytes = (() => { try { return bytesFromHex(draft); } catch { return null; } })();
  const dimensions = isIcon ? iconDimensions(fourCC) : null;

  useEffect(() => {
    if (!canvasRef.current || !isIcon || !bytes || !dimensions) return;
    const canvas = canvasRef.current;
    const scale = iconZoom;
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
      if (iconGrid && scale >= 6) {
        context.strokeStyle = "#111827";
        context.lineWidth = 1;
        context.strokeRect(x * scale + 0.5, y * scale + 0.5, scale - 1, scale - 1);
      }
    }
  }, [bytes, dimensions, fourCC, iconGrid, iconZoom, isIcon]);

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

  const inspectPictPixel = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height)));
    const color = canvas.getContext("2d")?.getImageData(x, y, 1, 1).data;
    if (color) setPictPixel({ x, y, color: `#${Array.from(color.slice(0, 3), (channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}` });
  };

  const exportPictPng = () => {
    const canvas = pictCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${fourCC.trim() || "PICT"}-${resourceId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
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
    <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-wide text-gray-300">QuickDraw picture renderer/editor</div><span className="text-xs text-gray-500">{fourCC} · #{resourceId}</span></div><div className="flex items-center gap-1"><span className="mr-1 text-xs text-gray-500">Zoom</span>{[1, 2, 4].map((zoom) => <Button key={zoom} size="sm" variant={pictZoom === zoom ? "secondary" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setPictZoom(zoom)}>{zoom}×</Button>)}<Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={exportPictPng}>Export PNG</Button></div></div>
    <div className="overflow-auto border border-gray-600 bg-[linear-gradient(45deg,#1f2937_25%,transparent_25%),linear-gradient(-45deg,#1f2937_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f2937_75%),linear-gradient(-45deg,transparent_75%,#1f2937_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0] p-3">
      <canvas ref={pictCanvasRef} onClick={inspectPictPixel} aria-label={`Rendered QuickDraw picture ${fourCC} ${resourceId}`} className="h-auto max-w-full cursor-crosshair" style={{ imageRendering: "pixelated", width: `${pictZoom * 100}%` }} />
    </div>
    {pictError ? <p className="text-xs text-amber-300">Preview unavailable: {pictError}. The original bytes remain editable below.</p> : <p className="text-xs text-gray-500">Click the image to inspect a pixel.{pictPixel ? ` Pixel (${pictPixel.x}, ${pictPixel.y}) is ${pictPixel.color}.` : ""} The original bytes remain editable below.</p>}
    <div className="flex gap-2"><Input aria-label={`Hex data for ${fourCC} ${resourceId}`} value={draft} readOnly={readOnly} onChange={(event) => setDraft(event.target.value)} className="font-mono text-xs" />{!readOnly && <Button size="sm" onClick={() => commit(draft)}>Apply hex</Button>}</div>
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>;

  if (isIcon) return <div className="space-y-3 border border-gray-700 bg-gray-900/60 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><span className="text-xs font-semibold uppercase tracking-wide text-gray-300">Bitmap icon editor</span><span className="ml-2 text-xs text-gray-500">{dimensions?.width}×{dimensions?.height} · {fourCC}</span></div><div className="flex items-center gap-1"><span className="text-xs text-gray-500">Zoom</span>{[4, 8, 12].map((zoom) => <Button key={zoom} size="sm" variant={iconZoom === zoom ? "secondary" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setIconZoom(zoom)}>{zoom}×</Button>)}<Button size="sm" variant={iconGrid ? "secondary" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setIconGrid((current) => !current)}>Grid</Button></div></div>
    <canvas ref={canvasRef} onClick={editPixel} aria-label={`Edit ${fourCC} bitmap ${resourceId}`} className="h-auto max-w-full cursor-crosshair border border-gray-600 bg-gray-950" />
    {!readOnly && <p className="text-xs text-gray-500">Click pixels to toggle monochrome values or cycle indexed color values.</p>}
    <div className="flex gap-2"><Input aria-label={`Hex data for ${fourCC} ${resourceId}`} value={draft} readOnly={readOnly} onChange={(event) => setDraft(event.target.value)} className="font-mono text-xs" />{!readOnly && <Button size="sm" onClick={() => commit(draft)}>Apply hex</Button>}</div>
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>;

  return <HexEditor fourCC={fourCC} resourceId={resourceId} hex={hex} onChange={onChange} readOnly={readOnly} />;
}

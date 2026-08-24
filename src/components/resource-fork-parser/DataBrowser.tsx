import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Badge } from "../ui/badge";
import {
  Search, 
  Edit2, 
  Save, 
  X, 
  ChevronDown, 
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Database,
  Copy,
  Check,
  Filter,
  AlertCircle
} from "lucide-react";
import ResourceDataEditor from "./ResourceDataEditor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";

interface DataBrowserProps {
  data: Record<string, unknown>;
  onDataChange?: (fourCC: string, resourceId: string, newData: Record<string, unknown>) => void;
  onResourceDataChange?: (fourCC: string, resourceId: string, hex: string) => void;
  onFourCCChange?: (oldFourCC: string, newFourCC: string) => void;
  readOnly?: boolean;
}

interface ResourceEntry {
  resourceId: string;
  name?: string;
  order?: number;
  obj?: Record<string, unknown>;
  data?: string;
  conversionError?: string;
}

interface EditState {
  fourCC: string;
  resourceId: string;
  fieldPath: string; // dot-notated path for nested fields e.g. "field" or "tiles[0].x"
  originalValue: unknown;
  originalType: string; // explicit type tag: "integer", "float", "boolean", "string", "object", "array"
}

interface ChangeRecord {
  fourCC: string;
  resourceId: string;
  fieldPath: string;
  before: unknown;
  after: unknown;
}

type RenderValue = (
  value: unknown,
  fourCC: string,
  resourceId: string,
  fieldPath: string,
  depth?: number,
) => React.ReactNode;

const ResourceFieldRows = React.memo(function ResourceFieldRows({
  obj,
  fourCC,
  resourceId,
  renderValue,
  changes,
}: {
  obj: Record<string, unknown>;
  fourCC: string;
  resourceId: string;
  renderValue: RenderValue;
  changes: Map<string, ChangeRecord>;
}) {
  return (
    <div className="space-y-1.5">
      {Object.entries(obj).map(([field, value]) => (
        <div key={field} className="flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-gray-800/40">
          <span className="min-w-[120px] flex-shrink-0 text-sm font-medium text-gray-300">{field}:</span>
          <div className="min-w-0 flex-1">{renderValue(value, fourCC, resourceId, field)}</div>
          {changes.has(`${fourCC}-${resourceId}-${field}`) && <Badge variant="secondary" className="text-[10px]">Edited</Badge>}
        </div>
      ))}
    </div>
  );
});

// Constants for validation and display
const FOUR_LETTER_CODE_REGEX = /^[\x20-\x7e]{4}$/;
const STRING_DISPLAY_MAX_LENGTH = 200;
const SPECIALIZED_DATA_EDITOR_TYPES = new Set(["PICT", "ICN#", "ics#", "icm#", "icl4", "ics4", "icm4", "icl8", "ics8", "icm8", "TEXT", "STR ", "STR#", "plst"]);

/** Format hex data as space-separated byte pairs: "FF A3 B2 00" */
function formatHexPairs(hexStr: string): string {
  const clean = hexStr.replace(/\s/g, "");
  return clean.match(/.{1,2}/g)?.join(" ") ?? hexStr;
}

/** Determine original type tag from a value */
function getTypeTag(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "float";
  }
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return "unknown";
}

/** Validate and parse a user-entered string given a type tag */
function parseEditedValue(raw: string, typeTag: string): { value: unknown; error?: string } {
  switch (typeTag) {
    case "integer": {
      const trimmed = raw.trim();
      if (!/^-?\d+$/.test(trimmed)) return { value: null, error: "Must be a whole number (no decimals)" };
      const n = parseInt(trimmed, 10);
      if (isNaN(n)) return { value: null, error: "Invalid integer" };
      return { value: n };
    }
    case "float": {
      const trimmed = raw.trim();
      if (!/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
        return { value: null, error: "Must be a valid number" };
      }
      const n = Number(trimmed);
      if (!Number.isFinite(n)) return { value: null, error: "Number is out of range" };
      return { value: n };
    }
    case "boolean": {
      const lower = raw.trim().toLowerCase();
      if (lower === "true" || lower === "1") return { value: true };
      if (lower === "false" || lower === "0") return { value: false };
      return { value: null, error: 'Must be "true", "false", "1", or "0"' };
    }
    case "string":
      return { value: raw };
    case "object":
    case "array": {
      try {
        const value = JSON.parse(raw) as unknown;
        if (typeTag === "object" && (typeof value !== "object" || value === null || Array.isArray(value))) {
          return { value: null, error: "Must be a JSON object" };
        }
        if (typeTag === "array" && !Array.isArray(value)) {
          return { value: null, error: "Must be a JSON array" };
        }
        return { value };
      } catch {
        return { value: null, error: "Invalid JSON" };
      }
    }
    default:
      return { value: raw };
  }
}

/** Deep-set a value at a dot-notated path supporting array indices e.g. "tiles[0].x" */
function deepSet(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  // Tokenize: split by dots then by [n] array index notation
  const tokens: Array<string | number> = [];
  for (const segment of path.split(".")) {
    const arrMatch = segment.match(/^(.+?)\[(\d+)\]$/);
    if (arrMatch) {
      if (arrMatch[1]) tokens.push(arrMatch[1]);
      tokens.push(parseInt(arrMatch[2], 10));
    } else {
      tokens.push(segment);
    }
  }

  function setAt(node: unknown, depth: number): unknown {
    const key = tokens[depth];
    if (depth === tokens.length - 1) {
      if (Array.isArray(node) && typeof key === "number") {
        const arr = [...(node as unknown[])];
        arr[key] = value;
        return arr;
      }
      if (typeof node === "object" && node !== null && typeof key === "string") {
        return { ...(node as Record<string, unknown>), [key]: value };
      }
      return node;
    }
    if (Array.isArray(node) && typeof key === "number") {
      const arr = [...(node as unknown[])];
      arr[key] = setAt(arr[key], depth + 1);
      return arr;
    }
    if (typeof node === "object" && node !== null && typeof key === "string") {
      const rec = node as Record<string, unknown>;
      return { ...rec, [key]: setAt(rec[key], depth + 1) };
    }
    return node;
  }

  return setAt(obj, 0) as Record<string, unknown>;
}

function expandableNodeKeys(value: unknown, baseKey: string): string[] {
  if (Array.isArray(value)) {
    const key = `${baseKey}--arr`;
    return value.length > 5 ? [key, ...value.flatMap((item, index) => expandableNodeKeys(item, `${baseKey}[${index}]`))] : value.flatMap((item, index) => expandableNodeKeys(item, `${baseKey}[${index}]`));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const key = `${baseKey}--obj`;
    return [key, ...entries.flatMap(([field, child]) => expandableNodeKeys(child, `${baseKey}.${field}`))];
  }
  return [];
}

export default function DataBrowser({ data, onDataChange, onResourceDataChange, onFourCCChange, readOnly = false }: DataBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editError, setEditError] = useState<string>("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [filterFourCC, setFilterFourCC] = useState<string>("");
  const [changes, setChanges] = useState<Map<string, ChangeRecord>>(new Map());
  const [editingFourCC, setEditingFourCC] = useState<string | null>(null);
  const [fourCCDraft, setFourCCDraft] = useState("");
  const [fourCCError, setFourCCError] = useState("");
  const [selectedResource, setSelectedResource] = useState<{ fourCC: string; resourceId: string } | null>(null);
  const bulkExpansionVersion = useRef(0);
  const dataWorkerRef = useRef<Worker | null>(null);
  const searchIndexRequestedFor = useRef<Record<string, unknown> | null>(null);
  const inspectorRequestId = useRef(0);
  const [searchIndex, setSearchIndex] = useState<Record<string, string> | null>(null);
  const [selectedResourceJson, setSelectedResourceJson] = useState<string | null>(null);

  // Extract four-letter codes and their resources
  const fourLetterCodes = useMemo(() => {
    if (!data || typeof data !== "object") return [];
    
    return Object.entries(data)
      .filter(([key]) => key.length === 4 && FOUR_LETTER_CODE_REGEX.test(key))
      .map(([fourCC, resources]) => ({
        fourCC,
        resources: resources as Record<string, ResourceEntry>,
        resourceCount: typeof resources === "object" && resources ? Object.keys(resources).length : 0,
      }))
      .filter(item => !filterFourCC || item.fourCC.toLowerCase().includes(filterFourCC.toLowerCase()));
  }, [data, filterFourCC]);

  // Serializing decoded resources is relatively expensive, especially for the
  // large classic-game forks. Build the search text once per data snapshot so
  // typing only performs string matching and filtering.
  const expandableKeysRef = useRef<{ data: Record<string, unknown>; keys: Map<string, string[]> } | null>(null);

  if (expandableKeysRef.current?.data !== data) expandableKeysRef.current = { data, keys: new Map() };

  useEffect(() => {
    const worker = new Worker(new URL("../../workers/data-browser.worker.ts", import.meta.url), { type: "module" });
    dataWorkerRef.current = worker;
    setSearchIndex(null);
    worker.onmessage = (event: MessageEvent<{ type: string; index?: Record<string, string>; requestId?: number; value?: string | null }>) => {
      if (event.data.type === "search-index" && event.data.index) setSearchIndex(event.data.index);
      if (event.data.type === "stringified" && event.data.requestId === inspectorRequestId.current) {
        setSelectedResourceJson(event.data.value ?? null);
      }
    };
    return () => {
      worker.terminate();
      if (dataWorkerRef.current === worker) dataWorkerRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    if (!searchQuery.trim() || !dataWorkerRef.current || searchIndexRequestedFor.current === data) return;
    searchIndexRequestedFor.current = data;
    dataWorkerRef.current.postMessage({ type: "build-search-index", data });
  }, [data, searchQuery]);

  const getExpandableKeys = useCallback((resourceKey: string, resource?: ResourceEntry) => {
    const cached = expandableKeysRef.current?.keys.get(resourceKey);
    if (cached) return cached;
    const keys = resource?.obj ? expandableNodeKeys(resource.obj, resourceKey) : [];
    expandableKeysRef.current?.keys.set(resourceKey, keys);
    return keys;
  }, []);

  // Filter resources based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return fourLetterCodes;

    const query = searchQuery.toLowerCase();
    
    return fourLetterCodes.map(({ fourCC, resources, resourceCount }) => {
      // Check if fourCC matches
      if (fourCC.toLowerCase().includes(query)) {
        return { fourCC, resources, resourceCount };
      }

      // Filter resources that match the search query
      const filteredResources: Record<string, ResourceEntry> = {};
      
      Object.entries(resources || {}).forEach(([resourceId, resource]) => {
        const resourceStr = searchIndex?.[`${fourCC}-${resourceId}`] ?? "";
        if (resourceStr.includes(query)) {
          filteredResources[resourceId] = resource;
        }
      });

      if (Object.keys(filteredResources).length > 0) {
        return { 
          fourCC, 
          resources: filteredResources, 
          resourceCount: Object.keys(filteredResources).length 
        };
      }

      return null;
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [fourLetterCodes, searchIndex, searchQuery]);

  const searchMatchCount = useMemo(() => filteredData.reduce((count, item) => count + item.resourceCount, 0), [filteredData]);
  const selectedResourceEntry = selectedResource ? (data[selectedResource.fourCC] as Record<string, ResourceEntry> | undefined)?.[selectedResource.resourceId] : undefined;
  useEffect(() => {
    if (!selectedResourceEntry?.obj || !dataWorkerRef.current) {
      setSelectedResourceJson(null);
      return;
    }
    const requestId = ++inspectorRequestId.current;
    dataWorkerRef.current.postMessage({ type: "stringify", requestId, value: selectedResourceEntry.obj });
  }, [selectedResourceEntry]);

  // Search results are useful only when the matching resource is visible. Keep
  // the tree open while searching so users do not have to expand every level.
  useEffect(() => {
    if (!searchQuery.trim()) return;
    setExpandedCodes(new Set(filteredData.map((item) => item.fourCC)));
    setExpandedResources(
      new Set(
        filteredData.flatMap((item) =>
          Object.keys(item.resources || {}).map((resourceId) => `${item.fourCC}-${resourceId}`),
        ),
      ),
    );
  }, [filteredData, searchQuery]);

  const expandCodeChildren = useCallback((fourCC: string, resourceIds: string[]) => {
    const version = ++bulkExpansionVersion.current;
    setExpandedCodes((current) => new Set([...current, fourCC]));
    const chunkSize = 2;
    const addChunk = (offset: number) => {
      if (bulkExpansionVersion.current !== version) return;
      const chunk = resourceIds.slice(offset, offset + chunkSize).map((resourceId) => `${fourCC}-${resourceId}`);
      setExpandedResources((current) => new Set([...current, ...chunk]));
      if (offset + chunkSize < resourceIds.length) {
        window.setTimeout(() => addChunk(offset + chunkSize), 0);
      }
    };
    addChunk(0);
  }, []);

  const collapseCodeChildren = useCallback((fourCC: string) => {
    bulkExpansionVersion.current += 1;
    setExpandedResources((current) => new Set([...current].filter((key) => !key.startsWith(`${fourCC}-`))));
  }, []);

  const expandResourceChildren = useCallback((fourCC: string, resourceId: string, resource: ResourceEntry) => {
    const resourceKey = `${fourCC}-${resourceId}`;
    const keys = getExpandableKeys(resourceKey, resource);
    setExpandedResources((current) => new Set([...current, resourceKey]));
    setExpandedCodes((current) => new Set([...current, fourCC]));
    setExpandedNodes((current) => new Set([...current, ...keys]));
  }, [getExpandableKeys]);

  const collapseResourceChildren = useCallback((fourCC: string, resourceId: string, resource: ResourceEntry) => {
    const resourceKey = `${fourCC}-${resourceId}`;
    const keys = getExpandableKeys(resourceKey, resource);
    setExpandedNodes((current) => new Set([...current].filter((key) => !keys.includes(key))));
  }, [getExpandableKeys]);

  const saveFourCC = useCallback(() => {
    if (!editingFourCC || !onFourCCChange) return;
    if (!FOUR_LETTER_CODE_REGEX.test(fourCCDraft)) {
      setFourCCError("Use exactly four printable characters");
      return;
    }
    if (fourLetterCodes.some(({ fourCC }) => fourCC === fourCCDraft && fourCC !== editingFourCC)) {
      setFourCCError("That code is already in use");
      return;
    }
    onFourCCChange(editingFourCC, fourCCDraft);
    setEditingFourCC(null);
    setFourCCError("");
  }, [editingFourCC, fourCCDraft, fourLetterCodes, onFourCCChange]);

  const startEdit = useCallback((fourCC: string, resourceId: string, fieldPath: string, value: unknown) => {
    const typeTag = getTypeTag(value);
    setEditState({ fourCC, resourceId, fieldPath, originalValue: value, originalType: typeTag });
    setEditError("");
    if (typeTag === "object" || typeTag === "array") {
      setEditValue(JSON.stringify(value, null, 2));
    } else {
      setEditValue(String(value));
    }
  }, []);

  const cancelEdit = useCallback(() => {
    setEditState(null);
    setEditValue("");
    setEditError("");
  }, []);

  const saveEdit = useCallback(() => {
    if (!editState || !onDataChange) return;

    const { value: parsedValue, error } = parseEditedValue(editValue, editState.originalType);
    if (error) {
      setEditError(error);
      return;
    }

    const currentResources = data[editState.fourCC] as Record<string, ResourceEntry>;
    const currentResource = currentResources?.[editState.resourceId];
    
    if (currentResource?.obj) {
      const newObj = deepSet(currentResource.obj, editState.fieldPath, parsedValue);
      onDataChange(editState.fourCC, editState.resourceId, newObj);
      const changeKey = `${editState.fourCC}-${editState.resourceId}-${editState.fieldPath}`;
      setChanges((current) => {
        const next = new Map(current);
        const existing = next.get(changeKey);
        next.set(changeKey, {
          fourCC: editState.fourCC,
          resourceId: editState.resourceId,
          fieldPath: editState.fieldPath,
          before: existing?.before ?? editState.originalValue,
          after: parsedValue,
        });
        return next;
      });
    }

    setEditState(null);
    setEditValue("");
    setEditError("");
  }, [editState, editValue, onDataChange, data]);

  const revertChange = useCallback((change: ChangeRecord) => {
    const resources = data[change.fourCC] as Record<string, ResourceEntry>;
    const resource = resources?.[change.resourceId];
    if (!resource?.obj || !onDataChange) return;
    onDataChange(change.fourCC, change.resourceId, deepSet(resource.obj, change.fieldPath, change.before));
    setChanges((current) => {
      const next = new Map(current);
      next.delete(`${change.fourCC}-${change.resourceId}-${change.fieldPath}`);
      return next;
    });
  }, [data, onDataChange]);

  const copyToClipboard = useCallback(async (text: string, fieldKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  const renderValue = useCallback((
    value: unknown, 
    fourCC: string, 
    resourceId: string, 
    fieldPath: string,
    depth: number = 0
  ): React.ReactNode => {
    const fieldKey = `${fourCC}-${resourceId}-${fieldPath}`;
    const isEditing = editState?.fourCC === fourCC && 
                      editState?.resourceId === resourceId && 
                      editState?.fieldPath === fieldPath;

    if (isEditing) {
      const isMultiline = editState.originalType === "object" || editState.originalType === "array";
      return (
        <div className="flex flex-col gap-1 w-full">
          <div className="flex items-start gap-2">
            {isMultiline ? (
              <textarea
                value={editValue}
                onChange={(e) => { setEditValue(e.target.value); setEditError(""); }}
                className="flex-1 bg-gray-900 border border-blue-500 rounded px-2 py-1 text-sm text-white font-mono min-h-[100px] resize-y"
                autoFocus
              />
            ) : (
              <Input
                value={editValue}
                onChange={(e) => { setEditValue(e.target.value); setEditError(""); }}
                className={`flex-1 h-8 text-sm font-mono ${editError ? "border-red-500" : ""}`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
              />
            )}
            <Button onClick={saveEdit} size="sm" className="h-8 px-2 bg-green-600 hover:bg-green-700">
              <Save className="h-3 w-3" />
            </Button>
            <Button onClick={cancelEdit} size="sm" variant="ghost" className="h-8 px-2">
              <X className="h-3 w-3" />
            </Button>
          </div>
          {editError && (
            <div className="flex items-center gap-1 text-red-400 text-xs">
              <AlertCircle className="h-3 w-3" />
              {editError}
            </div>
          )}
          <div className="text-gray-500 text-xs">
            Type: {editState.originalType}
            {editState.originalType === "integer" && " (whole number only)"}
          </div>
        </div>
      );
    }

    if (value === null) {
      return <span className="text-gray-500 italic">null</span>;
    }

    if (typeof value === "undefined") {
      return <span className="text-gray-500 italic">undefined</span>;
    }

    if (typeof value === "boolean") {
      return (
        <div className="flex items-center gap-2 group">
          <Badge variant={value ? "default" : "secondary"} className="text-xs">
            {value ? "true" : "false"}
          </Badge>
          {!readOnly && (
            <Button 
              onClick={() => startEdit(fourCC, resourceId, fieldPath, value)}
              size="sm" 
              variant="ghost" 
              className="h-6 px-2 text-gray-400 hover:text-white"
              aria-label={`Edit ${fieldPath}`}
              title={`Edit ${fieldPath}`}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      );
    }

    if (typeof value === "number") {
      return (
        <div className="flex items-center gap-2 group">
          <span className="text-blue-400 font-mono text-sm">{value}</span>
          <Button
            onClick={() => copyToClipboard(String(value), fieldKey)}
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-gray-400 hover:text-white"
            aria-label={`Copy ${fieldPath}`}
            title={`Copy ${fieldPath}`}
          >
            {copiedField === fieldKey ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
          {!readOnly && (
            <Button 
              onClick={() => startEdit(fourCC, resourceId, fieldPath, value)}
              size="sm" 
              variant="ghost" 
              className="h-6 px-2 text-gray-400 hover:text-white"
              aria-label={`Edit ${fieldPath}`}
              title={`Edit ${fieldPath}`}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      );
    }

    if (typeof value === "string") {
      // Check if this looks like hex data (long hex string with even length)
      const isHexData = /^[0-9a-fA-F]{4,}$/.test(value) && value.length % 2 === 0;
      const truncated = value.length > STRING_DISPLAY_MAX_LENGTH;
      const displayRaw = truncated ? value.substring(0, STRING_DISPLAY_MAX_LENGTH) : value;
      const displayValue = isHexData ? formatHexPairs(displayRaw) + (truncated ? "…" : "") : (truncated ? displayRaw + "…" : displayRaw);
      return (
        <div className="flex items-center gap-2 group">
          <span className={`${isHexData ? "text-orange-300" : "text-green-400"} font-mono text-sm break-all`}>
            {isHexData ? displayValue : `"${displayValue}"`}
          </span>
          <Button
            onClick={() => copyToClipboard(value, fieldKey)}
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-gray-400 hover:text-white flex-shrink-0"
            aria-label={`Copy ${fieldPath}`}
            title={`Copy ${fieldPath}`}
          >
            {copiedField === fieldKey ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
          {!readOnly && (
            <Button 
              onClick={() => startEdit(fourCC, resourceId, fieldPath, value)}
              size="sm" 
              variant="ghost" 
              className="h-6 px-2 text-gray-400 hover:text-white flex-shrink-0"
              aria-label={`Edit ${fieldPath}`}
              title={`Edit ${fieldPath}`}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-500 italic">[]</span>;
      }
      
      // Short arrays of primitives: show inline
      if (value.length <= 5 && value.every(v => typeof v !== "object")) {
        return (
          <span className="text-yellow-400 font-mono text-sm">
            [{value.map((v, i) => (
              <span key={i}>
                {typeof v === "string" ? `"${v}"` : String(v)}
                {i < value.length - 1 ? ", " : ""}
              </span>
            ))}]
          </span>
        );
      }

      const nodeKey = `${fieldKey}--arr`;
      const isExpanded = expandedNodes.has(nodeKey);

      return (
        <Collapsible open={isExpanded} onOpenChange={(open) => setExpandedNodes((current) => {
          const next = new Set(current);
          if (open) next.add(nodeKey); else next.delete(nodeKey);
          return next;
        })} className="w-full">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 font-mono text-sm text-yellow-400 transition-colors hover:text-yellow-300">
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Array ({value.length} items)
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="[&>div]:pb-0">
            <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-600 pl-3">
              {value.map((item, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="min-w-[2rem] flex-shrink-0 text-xs text-gray-500">[{index}]</span>
                  <div className="min-w-0 flex-1">
                    {renderValue(item, fourCC, resourceId, `${fieldPath}[${index}]`, depth + 1)}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      );
    }

    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        return <span className="text-gray-500 italic">{"{}"}</span>;
      }

      const nodeKey = `${fieldKey}--obj`;
      const isExpanded = expandedNodes.has(nodeKey);

      return (
        <Collapsible open={isExpanded} onOpenChange={(open) => setExpandedNodes((current) => {
          const next = new Set(current);
          if (open) next.add(nodeKey); else next.delete(nodeKey);
          return next;
        })} className="w-full">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 font-mono text-sm text-purple-400 transition-colors hover:text-purple-300">
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Object ({entries.length} fields)
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="[&>div]:pb-0">
            <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-600 pl-3">
              {entries.map(([key, val]) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="min-w-fit text-sm font-medium text-gray-400">{key}:</span>
                  <div className="min-w-0 flex-1">
                    {renderValue(val, fourCC, resourceId, `${fieldPath}.${key}`, depth + 1)}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return <span className="text-gray-400">{String(value)}</span>;
  }, [editState, editValue, editError, readOnly, startEdit, saveEdit, cancelEdit, copyToClipboard, copiedField, expandedNodes]);

  const totalResources = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + item.resourceCount, 0);
  }, [filteredData]);

  if (!data || Object.keys(data).length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-gray-400">
            <Database className="h-5 w-5" />
            <span>No data available to browse</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 bg-transparent shadow-none" data-testid="data-browser">
      <CardHeader className="border-b border-gray-700/70 bg-gray-800/40 px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Database className="h-5 w-5 text-blue-400" />
              Data Browser
            </CardTitle>
            <CardDescription className="text-gray-300 mt-1 font-medium">
              {filteredData.length} four-letter codes • {totalResources} total resources
              {!readOnly && " • Click edit icon to modify values"}
              {searchQuery && ` • Showing matches for “${searchQuery}”`}
            </CardDescription>
          </div>
          <span className="hidden text-xs text-gray-500 sm:inline">Use each row’s child controls to open its contents</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-0 pt-4 sm:px-5">
        {/* Search and filter bar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fields, values, IDs…"
              aria-label="Search all fields and values"
              className="border-gray-700 bg-gray-950 pl-9 pr-9"
            />
            {searchQuery && <Button onClick={() => setSearchQuery("")} size="sm" variant="ghost" className="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2 text-gray-500 hover:text-white" aria-label="Clear search"><X className="h-3.5 w-3.5" /></Button>}
          </div>
          <div className="relative w-full sm:w-40">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={filterFourCC}
              onChange={(e) => setFilterFourCC(e.target.value)}
              placeholder="Filter by code"
              aria-label="Filter by four-letter code"
              className="border-gray-700 bg-gray-950 pl-9"
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{searchQuery ? `${searchMatchCount} matching resources` : `${totalResources} resources across ${filteredData.length} types`}</span>
          {searchQuery && <span>Search includes decoded fields and resource IDs</span>}
        </div>

        {changes.size > 0 && (
          <div className="rounded-md border border-yellow-700/60 bg-yellow-900/20 p-3 text-sm">
            <div className="mb-2 flex items-center justify-between text-yellow-200">
              <span className="font-medium">{changes.size} unsaved change{changes.size === 1 ? "" : "s"}</span>
              <span className="text-xs text-yellow-300/70">Included when you pack the resource</span>
            </div>
            <div className="space-y-1">
              {Array.from(changes.values()).map((change) => {
                const changeKey = `${change.fourCC}-${change.resourceId}-${change.fieldPath}`;
                return (
                  <div key={changeKey} className="flex items-center justify-between gap-3 rounded bg-gray-900/60 px-2 py-1.5">
                    <code className="min-w-0 truncate text-xs text-gray-200">
                      {change.fourCC} / {change.resourceId} / {change.fieldPath}: {String(change.before)} → {String(change.after)}
                    </code>
                    <Button
                      onClick={() => revertChange(change)}
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 px-2 text-xs text-yellow-200"
                      aria-label={`Revert ${change.fieldPath}`}
                    >
                      Revert
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Data tree - expands freely, no max height */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="space-y-3">
          {filteredData.map(({ fourCC, resources, resourceCount }) => (
            <Collapsible
              key={fourCC}
              open={expandedCodes.has(fourCC)}
              onOpenChange={(open) => setExpandedCodes((current) => {
                if (!open) bulkExpansionVersion.current += 1;
                const next = new Set(current);
                if (open) next.add(fourCC); else next.delete(fourCC);
                return next;
              })}
              className="border-b border-gray-700/80 bg-gray-800/30"
            >
              {/* Four-letter code header */}
              <div
                className="flex items-center border-l-2 border-blue-500/70 bg-gray-900/80"
                onClick={(event) => {
                  if (!(event.target instanceof Element && event.target.closest("button"))) {
                    setExpandedCodes((current) => {
                      const next = new Set(current);
                      if (next.has(fourCC)) next.delete(fourCC); else next.add(fourCC);
                      return next;
                    });
                  }
                }}
              >
                {editingFourCC === fourCC ? (
                  <div className="flex flex-1 flex-wrap items-start gap-2 p-2">
                    <div>
                      <Input
                        value={fourCCDraft}
                        onChange={(event) => {
                          setFourCCDraft(event.target.value.slice(0, 4));
                          setFourCCError("");
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveFourCC();
                          if (event.key === "Escape") setEditingFourCC(null);
                        }}
                        aria-label={`Edit four-letter code ${fourCC}`}
                        maxLength={4}
                        autoFocus
                        className="h-8 w-24 bg-gray-900 font-mono text-white"
                      />
                      {fourCCError && <p className="mt-1 text-xs text-red-400">{fourCCError}</p>}
                    </div>
                    <Button onClick={saveFourCC} size="sm" className="h-8 bg-green-600 px-2 hover:bg-green-700" aria-label="Save four-letter code">
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button onClick={() => setEditingFourCC(null)} size="sm" variant="ghost" className="h-8 px-2" aria-label="Cancel four-letter code edit">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                  <CollapsibleTrigger asChild>
                    <button
                      data-testid={`resource-type-${fourCC}`}
                      aria-label={`${expandedCodes.has(fourCC) ? "Collapse" : "Expand"} resource type ${fourCC}`}
                      className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left transition-colors hover:bg-blue-500/10"
                    >
                      {expandedCodes.has(fourCC) ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                      <span className="font-mono text-lg font-semibold text-white">{fourCC}</span>
                      <Badge variant="secondary" className="text-xs">
                        {resourceCount} {resourceCount === 1 ? "resource" : "resources"}
                      </Badge>
                    </button>
                  </CollapsibleTrigger>
                  {!readOnly && (
                    <Button
                      onClick={() => {
                        setEditingFourCC(fourCC);
                        setFourCCDraft(fourCC);
                        setFourCCError("");
                      }}
                      size="sm"
                      variant="ghost"
                      className="h-7 px-1.5 text-gray-400 hover:text-white"
                      aria-label={`Edit four-letter code ${fourCC}`}
                      title="Edit four-letter code"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <div className="ml-auto flex shrink-0 items-center pr-2">
                    {(() => {
                      const resourceIds = Object.keys(resources || {});
                      const allExpanded = resourceIds.length > 0 && resourceIds.every((resourceId) => expandedResources.has(`${fourCC}-${resourceId}`));
                      return (
                        <div className="group relative">
                          <Button
                            onClick={() => allExpanded ? collapseCodeChildren(fourCC) : expandCodeChildren(fourCC, resourceIds)}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                            aria-label={`${allExpanded ? "Collapse" : "Expand"} children of ${fourCC}`}
                            aria-describedby={`children-tooltip-${fourCC}`}
                          >
                            {allExpanded ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                          </Button>
                          <span id={`children-tooltip-${fourCC}`} role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-1 w-max max-w-52 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-[11px] text-gray-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            {allExpanded ? "Collapse all child resources" : "Expand all child resources"}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  </>
                )}
              </div>

              {/* Resources */}
              <CollapsibleContent className="[&>div]:pb-0">
                {resources && <div className="space-y-1 border-t border-gray-700/50 bg-gray-900/40 py-2 pl-3 sm:pl-4">
                  {Object.entries(resources).map(([resourceId, resource]) => {
                    const resourceKey = `${fourCC}-${resourceId}`;
                    const isExpanded = expandedResources.has(resourceKey);

                    return (
                      <Collapsible key={resourceId} open={isExpanded} onOpenChange={(open) => {
                        setSelectedResource({ fourCC, resourceId });
                        setExpandedResources((current) => {
                          const next = new Set(current);
                          if (open) next.add(resourceKey); else next.delete(resourceKey);
                          return next;
                        });
                      }} className={`border-b border-gray-800 last:border-b-0 ${selectedResource?.fourCC === fourCC && selectedResource.resourceId === resourceId ? "bg-blue-500/10" : "bg-gray-900/40"}`}>
                        <CollapsibleTrigger asChild>
                          <button
                            data-testid={`resource-${fourCC}-${resourceId}`}
                            aria-label={`${isExpanded ? "Collapse" : "Expand"} resource ${resourceId}`}
                            className="flex w-full items-center justify-between px-2 py-2 text-left transition-colors hover:bg-gray-700/30"
                          >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-gray-400" />
                            )}
                        <span className="text-sm font-mono text-gray-300">
                              Resource #{resourceId}
                            </span>
                            {resource.name && (
                              <span className="text-xs text-gray-500">
                                ({resource.name})
                              </span>
                            )}
                          </div>
                            {resource.conversionError && (
                              <Badge variant="destructive" className="text-xs">Error</Badge>
                            )}
                          </button>
                        </CollapsibleTrigger>

                        <CollapsibleContent className="[&>div]:pb-0">
                        {resource.obj && (
                          <div className="flex items-center justify-end border-t border-gray-700/40 px-3 py-1">
                            {(() => {
                              const childKeys = getExpandableKeys(resourceKey, resource);
                              const allExpanded = childKeys.length > 0 && childKeys.every((key) => expandedNodes.has(key));
                              return (
                                <Button
                                  onClick={() => allExpanded ? collapseResourceChildren(fourCC, resourceId, resource) : expandResourceChildren(fourCC, resourceId, resource)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                                  aria-label={`${allExpanded ? "Collapse" : "Expand"} fields in ${fourCC} resource ${resourceId}`}
                                  title="Toggle child fields"
                                  disabled={childKeys.length === 0}
                                >
                                  {allExpanded ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                                </Button>
                              );
                            })()}
                          </div>
                        )}

                        {
                          <div className="space-y-2 border-t border-gray-700/50 bg-gray-950/30 px-3 py-3">
                            {resource.conversionError && (
                              <div className="text-red-400 text-sm mb-2 p-2 bg-red-900/20 border border-red-700/30 rounded-md">
                                <strong>Error:</strong> {resource.conversionError}
                              </div>
                            )}

                            {resource.data && onResourceDataChange && selectedResource?.fourCC === fourCC && selectedResource.resourceId === resourceId && (
                              <ResourceDataEditor
                                fourCC={fourCC}
                                resourceId={resourceId}
                                hex={resource.data}
                                onChange={(hex) => onResourceDataChange(fourCC, resourceId, hex)}
                                readOnly={readOnly}
                              />
                            )}

                            {resource.obj && <ResourceFieldRows obj={resource.obj} fourCC={fourCC} resourceId={resourceId} renderValue={renderValue} changes={changes} />}

                            {resource.data && !resource.obj && !SPECIALIZED_DATA_EDITOR_TYPES.has(fourCC) && (
                              <div className="p-2 bg-gray-900/60 rounded-md border border-gray-700/40">
                                <span className="text-gray-400 text-xs font-medium">Raw Data (hex pairs):</span>
                                <code className="block mt-1.5 text-xs text-orange-300 bg-gray-950/60 p-2.5 rounded-md break-all font-mono border border-gray-800/50">
                                  {formatHexPairs(resource.data)}
                                </code>
                              </div>
                            )}
                          </div>
                        }
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>}
              </CollapsibleContent>
            </Collapsible>
          ))}

          {filteredData.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No results found for &quot;{searchQuery || filterFourCC}&quot;
            </div>
          )}
        </div>
        {selectedResource && selectedResourceEntry && (
          <aside className="border border-gray-800 bg-gray-950/70 lg:sticky lg:top-4" aria-label="Resource inspector">
            <div className="border-b border-gray-800 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Resource inspector</p><h2 className="mt-1 font-mono text-lg text-white">{selectedResource.fourCC} / {selectedResource.resourceId}</h2></div>
                <Button onClick={() => setSelectedResource(null)} size="sm" variant="ghost" className="h-7 px-2 text-gray-500 hover:text-white" aria-label="Close resource inspector"><X className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-4 p-4 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs"><dt className="text-gray-500">Name</dt><dd className="truncate text-gray-300">{selectedResourceEntry.name || "—"}</dd><dt className="text-gray-500">Order</dt><dd className="text-gray-300">{selectedResourceEntry.order ?? "—"}</dd><dt className="text-gray-500">Representation</dt><dd className="text-gray-300">{selectedResourceEntry.obj ? "Decoded fields" : "Raw bytes"}</dd></dl>
              {selectedResourceEntry.data && onResourceDataChange && <ResourceDataEditor fourCC={selectedResource.fourCC} resourceId={selectedResource.resourceId} hex={selectedResourceEntry.data} onChange={(hex) => onResourceDataChange(selectedResource.fourCC, selectedResource.resourceId, hex)} readOnly={readOnly} />}
              {selectedResourceJson && <pre className="max-h-72 overflow-auto border border-gray-800 bg-gray-900 p-3 text-[11px] leading-5 text-gray-300">{selectedResourceJson}</pre>}
              {selectedResourceEntry.conversionError && <p className="border border-red-900/70 bg-red-950/30 p-3 text-xs text-red-300">{selectedResourceEntry.conversionError}</p>}
            </div>
          </aside>
        )}
        </div>
      </CardContent>
    </Card>
  );
}

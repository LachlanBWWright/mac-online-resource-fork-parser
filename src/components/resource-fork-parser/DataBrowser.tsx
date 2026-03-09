import React, { useState, useMemo, useCallback } from "react";
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
  Database,
  Copy,
  Check,
  Filter,
  AlertCircle
} from "lucide-react";

interface DataBrowserProps {
  data: Record<string, unknown>;
  onDataChange?: (fourCC: string, resourceId: string, newData: Record<string, unknown>) => void;
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

// Constants for validation and display
const FOUR_LETTER_CODE_REGEX = /^[A-Za-z0-9]{4}$/;
const STRING_DISPLAY_MAX_LENGTH = 200;

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
      const n = parseFloat(trimmed);
      if (isNaN(n)) return { value: null, error: "Must be a valid number" };
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
        return { value: JSON.parse(raw) };
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

export default function DataBrowser({ data, onDataChange, readOnly = false }: DataBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editError, setEditError] = useState<string>("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [filterFourCC, setFilterFourCC] = useState<string>("");

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
        const resourceStr = JSON.stringify(resource).toLowerCase();
        if (resourceStr.includes(query) || resourceId.includes(query)) {
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
  }, [fourLetterCodes, searchQuery]);

  const toggleCode = useCallback((fourCC: string) => {
    setExpandedCodes(prev => {
      const next = new Set(prev);
      if (next.has(fourCC)) {
        next.delete(fourCC);
      } else {
        next.add(fourCC);
      }
      return next;
    });
  }, []);

  const toggleResource = useCallback((key: string) => {
    setExpandedResources(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleNode = useCallback((key: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedCodes(new Set(filteredData.map(item => item.fourCC)));
  }, [filteredData]);

  const collapseAll = useCallback(() => {
    setExpandedCodes(new Set());
    setExpandedResources(new Set());
  }, []);

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
    }

    setEditState(null);
    setEditValue("");
    setEditError("");
  }, [editState, editValue, onDataChange, data]);

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
              className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
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
            className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {copiedField === fieldKey ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
          {!readOnly && (
            <Button 
              onClick={() => startEdit(fourCC, resourceId, fieldPath, value)}
              size="sm" 
              variant="ghost" 
              className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
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
            className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          >
            {copiedField === fieldKey ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
          {!readOnly && (
            <Button 
              onClick={() => startEdit(fourCC, resourceId, fieldPath, value)}
              size="sm" 
              variant="ghost" 
              className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
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
        <div className="w-full">
          <button
            onClick={() => toggleNode(nodeKey)}
            className="flex items-center gap-1 text-yellow-400 font-mono text-sm hover:text-yellow-300 transition-colors"
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Array ({value.length} items)
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-600 pl-3">
              {value.map((item, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-gray-500 text-xs min-w-[2rem] flex-shrink-0">[{index}]</span>
                  <div className="flex-1 min-w-0">
                    {renderValue(item, fourCC, resourceId, `${fieldPath}[${index}]`, depth + 1)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
        <div className="w-full">
          <button
            onClick={() => toggleNode(nodeKey)}
            className="flex items-center gap-1 text-purple-400 font-mono text-sm hover:text-purple-300 transition-colors"
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Object ({entries.length} fields)
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-600 pl-3">
              {entries.map(([key, val]) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-gray-400 text-sm font-medium min-w-fit">{key}:</span>
                  <div className="flex-1 min-w-0">
                    {renderValue(val, fourCC, resourceId, `${fieldPath}.${key}`, depth + 1)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return <span className="text-gray-400">{String(value)}</span>;
  }, [editState, editValue, editError, readOnly, startEdit, saveEdit, cancelEdit, copyToClipboard, copiedField, expandedNodes, toggleNode]);

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
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Database className="h-5 w-5" />
              Data Browser
            </CardTitle>
            <CardDescription className="text-gray-400 mt-1">
              {filteredData.length} four-letter codes, {totalResources} total resources
              {!readOnly && " • Click edit icon to modify values"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={expandAll} size="sm" variant="outline" className="border-gray-600">
              Expand All
            </Button>
            <Button onClick={collapseAll} size="sm" variant="outline" className="border-gray-600">
              Collapse All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and filter bar */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all fields and values..."
              className="pl-9 bg-gray-900 border-gray-600"
            />
          </div>
          <div className="relative w-40">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={filterFourCC}
              onChange={(e) => setFilterFourCC(e.target.value)}
              placeholder="Filter by code"
              className="pl-9 bg-gray-900 border-gray-600"
            />
          </div>
        </div>

        {/* Data tree - expands freely, no max height */}
        <div className="space-y-2">
          {filteredData.map(({ fourCC, resources, resourceCount }) => (
            <div key={fourCC} className="border border-gray-700 rounded-lg overflow-hidden">
              {/* Four-letter code header */}
              <button
                onClick={() => toggleCode(fourCC)}
                className="w-full flex items-center justify-between p-3 bg-gray-750 hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedCodes.has(fourCC) ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-lg font-mono font-semibold text-white">{fourCC}</span>
                  <Badge variant="secondary" className="text-xs">
                    {resourceCount} {resourceCount === 1 ? "resource" : "resources"}
                  </Badge>
                </div>
              </button>

              {/* Resources */}
              {expandedCodes.has(fourCC) && resources && (
                <div className="p-2 space-y-2 bg-gray-900">
                  {Object.entries(resources).map(([resourceId, resource]) => {
                    const resourceKey = `${fourCC}-${resourceId}`;
                    const isExpanded = expandedResources.has(resourceKey);

                    return (
                      <div key={resourceId} className="border border-gray-700 rounded">
                        <button
                          onClick={() => toggleResource(resourceKey)}
                          className="w-full flex items-center justify-between p-2 bg-gray-800 hover:bg-gray-750 transition-colors rounded-t"
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

                        {isExpanded && (
                          <div className="p-3 space-y-2 bg-gray-850 rounded-b">
                            {resource.conversionError && (
                              <div className="text-red-400 text-sm mb-2">
                                <strong>Error:</strong> {resource.conversionError}
                              </div>
                            )}
                            
                            {resource.obj && (
                              <div className="space-y-1">
                                {Object.entries(resource.obj).map(([field, value]) => (
                                  <div key={field} className="flex items-start gap-2 py-1">
                                    <span className="text-gray-400 text-sm font-medium min-w-[120px] flex-shrink-0">
                                      {field}:
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      {renderValue(value, fourCC, resourceId, field)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {resource.data && !resource.obj && (
                              <div>
                                <span className="text-gray-400 text-xs">Raw Data (hex pairs):</span>
                                <code className="block mt-1 text-xs text-orange-300 bg-gray-900 p-2 rounded break-all font-mono">
                                  {formatHexPairs(resource.data)}
                                </code>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {filteredData.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No results found for &quot;{searchQuery || filterFourCC}&quot;
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

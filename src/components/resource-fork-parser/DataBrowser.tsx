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
  Filter
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
  field: string;
  originalValue: unknown;
}

// Constants for validation and display
const FOUR_LETTER_CODE_REGEX = /^[A-Za-z0-9]{4}$/;
const STRING_DISPLAY_MAX_LENGTH = 100;
const RAW_DATA_DISPLAY_MAX_LENGTH = 200;

export default function DataBrowser({ data, onDataChange, readOnly = false }: DataBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editValue, setEditValue] = useState<string>("");
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

  const expandAll = useCallback(() => {
    const allCodes = new Set(filteredData.map(item => item.fourCC));
    setExpandedCodes(allCodes);
  }, [filteredData]);

  const collapseAll = useCallback(() => {
    setExpandedCodes(new Set());
    setExpandedResources(new Set());
  }, []);

  const startEdit = useCallback((fourCC: string, resourceId: string, field: string, value: unknown) => {
    setEditState({ fourCC, resourceId, field, originalValue: value });
    setEditValue(typeof value === "object" ? JSON.stringify(value, null, 2) : String(value));
  }, []);

  const cancelEdit = useCallback(() => {
    setEditState(null);
    setEditValue("");
  }, []);

  const saveEdit = useCallback(() => {
    if (!editState || !onDataChange) return;

    try {
      // Parse the value based on its original type
      let parsedValue: unknown;
      const originalType = typeof editState.originalValue;

      if (originalType === "number") {
        parsedValue = parseFloat(editValue);
        if (isNaN(parsedValue as number)) {
          throw new Error("Invalid number");
        }
      } else if (originalType === "boolean") {
        parsedValue = editValue.toLowerCase() === "true";
      } else if (originalType === "object" && editState.originalValue !== null) {
        parsedValue = JSON.parse(editValue);
      } else {
        parsedValue = editValue;
      }

      // Get the current resource data and update it
      const currentResources = data[editState.fourCC] as Record<string, ResourceEntry>;
      const currentResource = currentResources?.[editState.resourceId];
      
      if (currentResource?.obj) {
        const newObj = { ...currentResource.obj, [editState.field]: parsedValue };
        onDataChange(editState.fourCC, editState.resourceId, newObj);
      }

      setEditState(null);
      setEditValue("");
    } catch (err) {
      console.error("Failed to parse value:", err);
      // Keep edit state open so user can fix
    }
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
    field: string,
    depth: number = 0
  ): React.ReactNode => {
    const fieldKey = `${fourCC}-${resourceId}-${field}`;
    const isEditing = editState?.fourCC === fourCC && 
                      editState?.resourceId === resourceId && 
                      editState?.field === field;

    if (isEditing) {
      const isMultiline = typeof value === "object" && value !== null;
      return (
        <div className="flex items-start gap-2">
          {isMultiline ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 bg-gray-900 border border-blue-500 rounded px-2 py-1 text-sm text-white font-mono min-h-[100px] resize-y"
              autoFocus
            />
          ) : (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 h-8 text-sm font-mono"
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
          {!readOnly && depth === 0 && (
            <Button 
              onClick={() => startEdit(fourCC, resourceId, field, value)}
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
          {!readOnly && depth === 0 && (
            <Button 
              onClick={() => startEdit(fourCC, resourceId, field, value)}
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
      const displayValue = value.length > STRING_DISPLAY_MAX_LENGTH ? value.substring(0, STRING_DISPLAY_MAX_LENGTH) + "..." : value;
      return (
        <div className="flex items-center gap-2 group">
          <span className="text-green-400 font-mono text-sm break-all">&quot;{displayValue}&quot;</span>
          <Button
            onClick={() => copyToClipboard(value, fieldKey)}
            size="sm"
            variant="ghost"
            className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          >
            {copiedField === fieldKey ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
          {!readOnly && depth === 0 && (
            <Button 
              onClick={() => startEdit(fourCC, resourceId, field, value)}
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
      
      if (value.length <= 5 && value.every(v => typeof v !== "object")) {
        // Show short arrays inline
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

      return (
        <details className="group">
          <summary className="cursor-pointer text-yellow-400 font-mono text-sm">
            Array ({value.length} items)
          </summary>
          <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-600 pl-3">
            {value.slice(0, 20).map((item, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-gray-500 text-xs w-6">[{index}]</span>
                {renderValue(item, fourCC, resourceId, `${field}[${index}]`, depth + 1)}
              </div>
            ))}
            {value.length > 20 && (
              <span className="text-gray-500 text-xs italic">...and {value.length - 20} more items</span>
            )}
          </div>
        </details>
      );
    }

    if (typeof value === "object") {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return <span className="text-gray-500 italic">{"{}"}</span>;
      }

      return (
        <details className="group" open={depth === 0}>
          <summary className="cursor-pointer text-purple-400 font-mono text-sm">
            Object ({entries.length} fields)
          </summary>
          <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-600 pl-3">
            {entries.map(([key, val]) => (
              <div key={key} className="flex items-start gap-2">
                <span className="text-gray-400 text-sm font-medium min-w-fit">{key}:</span>
                {renderValue(val, fourCC, resourceId, `${field}.${key}`, depth + 1)}
              </div>
            ))}
          </div>
        </details>
      );
    }

    return <span className="text-gray-400">{String(value)}</span>;
  }, [editState, editValue, readOnly, startEdit, saveEdit, cancelEdit, copyToClipboard, copiedField]);

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

        {/* Data tree */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
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
                                    <span className="text-gray-400 text-sm font-medium min-w-[120px]">
                                      {field}:
                                    </span>
                                    <div className="flex-1">
                                      {renderValue(value, fourCC, resourceId, field)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {resource.data && !resource.obj && (
                              <div>
                                <span className="text-gray-400 text-xs">Raw Data:</span>
                                <code className="block mt-1 text-xs text-gray-300 bg-gray-900 p-2 rounded break-all">
                                  {resource.data.length > RAW_DATA_DISPLAY_MAX_LENGTH 
                                    ? resource.data.substring(0, RAW_DATA_DISPLAY_MAX_LENGTH) + "..." 
                                    : resource.data}
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

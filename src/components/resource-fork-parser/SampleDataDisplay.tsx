import { useState } from "react";
import { Button } from "../ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ParsedResource } from "./types";

interface SampleDataDisplayProps {
  sampleData: unknown | null; // Changed to accept unknown
}

interface JsonDisplayProps {
  obj: Record<string, unknown>;
  title?: string;
}

function JsonDisplay({ obj, title }: JsonDisplayProps) {
  return (
    <div className="bg-gray-900 p-2 rounded">
      {title && <div className="text-xs text-gray-400 mb-1">{title}:</div>}
      <pre className="text-sm text-gray-200 overflow-x-auto max-h-80 min-h-0 overflow-y-auto">
        {JSON.stringify(obj, null, 2)}
      </pre>
    </div>
  );
}

interface ResourceItemProps {
  resource: ParsedResource;
  resourceId: string;
}

function ResourceItem({ resource, resourceId }: ResourceItemProps) {
  return (
    <div className="border border-gray-600 rounded p-2">
      <div className="text-sm text-gray-300 mb-2">
        Resource ID: {resourceId}
        {resource.name && <span> | Name: {resource.name}</span>}
        {resource.order && <span> | Order: {resource.order}</span>}
      </div>

      {resource.conversionError && (
        <div className="text-red-300 mb-2">
          <strong>Conversion Error:</strong> {resource.conversionError}
        </div>
      )}

      {resource.obj && <JsonDisplay obj={resource.obj} title="Parsed Object" />}

      {resource.data && !resource.obj && (
        <div className="text-gray-200">
          <div className="text-xs text-gray-400 mb-1">Raw Data:</div>
          <code className="break-all text-sm bg-gray-800 p-2 rounded block">
            {(resource.data as string).length > 200
              ? (resource.data as string).substring(0, 200) + "..."
              : resource.data}
          </code>
        </div>
      )}
    </div>
  );
}

export default function SampleDataDisplay({ sampleData }: SampleDataDisplayProps) {
  const [showAllResources, setShowAllResources] = useState(false);
  
  if (!sampleData) return <span className="text-gray-400">-</span>;

  // Handle object with resource IDs (e.g., {1000: {name: "...", order: 1000, obj: {...}}})
  if (typeof sampleData === "object" && !Array.isArray(sampleData)) {
    const resourceIds = Object.keys(sampleData);
    if (resourceIds.length === 0) {
      return <div className="text-gray-400">No resource data</div>;
    }

    const displayedResources = showAllResources 
      ? resourceIds 
      : resourceIds.slice(0, 3);

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-gray-300">
            Resources found: {resourceIds.length}
          </div>
          {resourceIds.length > 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllResources(!showAllResources)}
              className="flex items-center gap-1"
            >
              {showAllResources ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show All ({resourceIds.length})
                </>
              )}
            </Button>
          )}
        </div>
        
        {displayedResources.map((resourceId) => {
          const resource = (sampleData as Record<string, ParsedResource>)[resourceId];
          if (!resource) return null;

          return (
            <ResourceItem 
              key={resourceId} 
              resource={resource} 
              resourceId={resourceId} 
            />
          );
        })}
      </div>
    );
  }

  // Handle array of resources (legacy support)
  if (Array.isArray(sampleData)) {
    if (sampleData.length === 0)
      return <div className="text-gray-400">Empty array</div>;

    const displayedItems = showAllResources 
      ? sampleData 
      : sampleData.slice(0, 3);

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-gray-300">Array items: {sampleData.length}</div>
          {sampleData.length > 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllResources(!showAllResources)}
              className="flex items-center gap-1"
            >
              {showAllResources ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show All ({sampleData.length})
                </>
              )}
            </Button>
          )}
        </div>
        
        {displayedItems.map((item: ParsedResource, idx: number) => (
          <div key={idx} className="border border-gray-600 rounded p-2">
            {item.conversionError && (
              <div className="text-red-300 mb-2">
                Error: {item.conversionError}
              </div>
            )}
            {item.obj && (
              <JsonDisplay obj={item.obj} title={`Item ${idx + 1} - Parsed Object`} />
            )}
            {item.data && !item.obj && (
              <div className="text-gray-200">
                <div className="text-xs text-gray-400 mb-1">Raw Data:</div>
                <code className="break-all text-sm bg-gray-800 p-2 rounded block">
                  {(item.data as string).length > 200
                    ? (item.data as string).substring(0, 200) + "..."
                    : item.data}
                </code>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Fallback for other data types
  return (
    <div className="bg-gray-900 p-2 rounded">
      <pre className="text-sm text-gray-200">
        {JSON.stringify(sampleData, null, 2)}
      </pre>
    </div>
  );
}
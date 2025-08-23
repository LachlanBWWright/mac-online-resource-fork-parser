import React, { useState, useCallback, useRef } from 'react';
import { saveToJson, saveFromJson } from '../lib/rsrcdump/rsrcdump';
import { ottoMaticSpecs } from '../lib/rsrcdump/ottoSpecs';

interface ParsedResult {
  success: boolean;
  data?: any;
  error?: string;
  filename?: string;
}

interface StructSpec {
  id: string;
  fourCC: string;
  spec: string;
  description: string;
}

export default function ResourceForkParser() {
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [customSpecs, setCustomSpecs] = useState<StructSpec[]>([]);
  const [useOttoSpecs, setUseOttoSpecs] = useState(true);
  const [parseError, setParseError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Initialize with a default spec for demonstration
  React.useEffect(() => {
    setCustomSpecs([
      {
        id: '1',
        fourCC: 'Hedr',
        spec: 'L5i3f5i40x',
        description: 'Header: version,numItems,mapWidth,mapHeight,numTilePages,numTiles,tileSize,minY,maxY,numSplines,numFences,numUniqueSupertiles,numWaterPatches,numCheckpoints'
      }
    ]);
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setParseError('');
    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      // Create struct specs array from custom specs
      const structSpecs = customSpecs.map(spec => `${spec.fourCC}:${spec.spec}+:${spec.description}`);
      
      const result = saveToJson(data, structSpecs, [], [], useOttoSpecs);
      
      setParsedResult({
        success: true,
        data: result,
        filename: file.name
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setParseError(errorMessage);
      setParsedResult({
        success: false,
        error: errorMessage,
        filename: file.name
      });
    } finally {
      setIsProcessing(false);
    }
  }, [customSpecs, useOttoSpecs]);

  const handleJsonUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setParseError('');
    setIsProcessing(true);

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      // Create struct specs array from custom specs
      const structSpecs = customSpecs.map(spec => `${spec.fourCC}:${spec.spec}+:${spec.description}`);
      
      const resourceForkData = saveFromJson(jsonData, structSpecs, useOttoSpecs);
      
      // Create download link for binary data
      const blob = new Blob([resourceForkData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace('.json', '.rsrc');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('Resource fork file generated and downloaded!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process JSON file';
      setParseError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [customSpecs, useOttoSpecs]);

  const downloadJson = useCallback(() => {
    if (!parsedResult?.success || !parsedResult.data) return;

    const jsonString = JSON.stringify(parsedResult.data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${parsedResult.filename || 'parsed'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [parsedResult]);

  const loadSampleFile = useCallback(async () => {
    setParseError('');
    setIsProcessing(true);

    try {
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      if (!response.ok) {
        throw new Error('Failed to load sample file');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      // Create struct specs array from custom specs
      const structSpecs = customSpecs.map(spec => `${spec.fourCC}:${spec.spec}+:${spec.description}`);
      
      const result = saveToJson(data, structSpecs, [], [], useOttoSpecs);
      
      setParsedResult({
        success: true,
        data: result,
        filename: 'EarthFarm.ter.rsrc'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load sample file';
      setParseError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [customSpecs, useOttoSpecs]);

  const addCustomSpec = useCallback(() => {
    const newSpec: StructSpec = {
      id: Date.now().toString(),
      fourCC: '',
      spec: '',
      description: ''
    };
    setCustomSpecs(prev => [...prev, newSpec]);
  }, []);

  const updateCustomSpec = useCallback((id: string, field: keyof StructSpec, value: string) => {
    setCustomSpecs(prev => prev.map(spec => 
      spec.id === id ? { ...spec, [field]: value } : spec
    ));
  }, []);

  const validateStructSpec = useCallback((spec: string): string | null => {
    if (!spec.trim()) return null;
    
    // Basic validation for struct format characters
    const validChars = /^[LlhHfBbcCxsp0-9\s]*\+?$/;
    if (!validChars.test(spec)) {
      return 'Invalid format characters. Use L, h, H, f, B, x, s, p and numbers only.';
    }
    
    return null;
  }, []);

  const removeCustomSpec = useCallback((id: string) => {
    setCustomSpecs(prev => prev.filter(spec => spec.id !== id));
  }, []);

  return (
    <div className="container p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Mac Resource Fork Parser
      </h1>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Left Panel - File Operations */}
        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">File Operations</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Upload Resource Fork File (.rsrc)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".rsrc"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  disabled={isProcessing}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Upload JSON File (to convert back to .rsrc)
                </label>
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleJsonUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                  disabled={isProcessing}
                />
              </div>

              <button
                onClick={loadSampleFile}
                disabled={isProcessing}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Load Sample File (EarthFarm.ter.rsrc)'}
              </button>
            </div>
          </div>

          {/* Settings */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Settings</h2>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={useOttoSpecs}
                  onChange={(e) => setUseOttoSpecs(e.target.checked)}
                  className="mr-2"
                />
                Use Otto Matic Default Specs
              </label>
              <div className="text-sm text-gray-600 ml-6">
                Includes predefined struct specs for Otto Matic terrain files
              </div>
            </div>
          </div>

          {/* Results */}
          {parseError && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <h3 className="text-red-800 font-semibold">Error</h3>
              <p className="text-red-600 mt-1">{parseError}</p>
            </div>
          )}

          {parsedResult?.success && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <h3 className="text-green-800 font-semibold">Parsing Successful!</h3>
              <p className="text-green-600 mt-1">
                File: {parsedResult.filename}
              </p>
              <button
                onClick={downloadJson}
                className="mt-2 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
              >
                Download JSON
              </button>
            </div>
          )}
        </div>

        {/* Right Panel - Custom Specs */}
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Custom Struct Specs</h2>
              <button
                onClick={addCustomSpec}
                className="bg-blue-600 text-white py-1 px-3 rounded text-sm hover:bg-blue-700"
              >
                Add Spec
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {customSpecs.map((spec) => (
                <div key={spec.id} className="border border-gray-200 p-3 rounded bg-white">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Four-letter Code
                      </label>
                      <input
                        type="text"
                        value={spec.fourCC}
                        onChange={(e) => updateCustomSpec(spec.id, 'fourCC', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="e.g. Hedr"
                        maxLength={4}
                      />
                    </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Struct Spec
                    </label>
                    <input
                      type="text"
                      value={spec.spec}
                      onChange={(e) => updateCustomSpec(spec.id, 'spec', e.target.value)}
                      className={`w-full px-2 py-1 border rounded text-sm ${
                        spec.spec && validateStructSpec(spec.spec) 
                          ? 'border-red-300 bg-red-50' 
                          : 'border-gray-300'
                      }`}
                      placeholder="e.g. L5i3f5i40x"
                    />
                    {spec.spec && validateStructSpec(spec.spec) && (
                      <div className="text-xs text-red-600 mt-1">
                        {validateStructSpec(spec.spec)}
                      </div>
                    )}
                  </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Description (field names)
                    </label>
                    <input
                      type="text"
                      value={spec.description}
                      onChange={(e) => updateCustomSpec(spec.id, 'description', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="e.g. version,numItems,width,height"
                    />
                  </div>
                  <button
                    onClick={() => removeCustomSpec(spec.id)}
                    className="mt-2 text-red-600 text-xs hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Format Help */}
            <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
              <h4 className="font-semibold text-blue-800 mb-2">Format Characters:</h4>
              <div className="text-blue-700 space-y-1">
                <div><code>L</code> - Unsigned long (4 bytes)</div>
                <div><code>l</code> - Signed long (4 bytes)</div>
                <div><code>i</code> - Signed int (4 bytes)</div>
                <div><code>h</code> - Signed short (2 bytes)</div>
                <div><code>H</code> - Unsigned short (2 bytes)</div>
                <div><code>f</code> - Float (4 bytes)</div>
                <div><code>B</code> - Unsigned byte (1 byte)</div>
                <div><code>b</code> - Signed byte (1 byte)</div>
                <div><code>x</code> - Padding byte</div>
                <div><code>s</code> - String</div>
                <div><code>p</code> - Pascal string</div>
                <div><code>+</code> - Indicates array/multiple items</div>
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <strong>Examples:</strong>
                  <div><code>L5i3f</code> - Long + 5 ints + 3 floats</div>
                  <div><code>H2x</code> - Short + 2 padding bytes</div>
                  <div><code>200f</code> - 200 floats</div>
                </div>
              </div>
            </div>
          </div>

          {/* Otto Specs Preview */}
          {useOttoSpecs && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Otto Matic Default Specs</h3>
              <div className="max-h-40 overflow-y-auto text-xs font-mono bg-white p-2 rounded border">
                {ottoMaticSpecs.filter(spec => !spec.startsWith('//')).map((spec, index) => (
                  <div key={index} className="mb-1">{spec}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
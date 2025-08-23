import React, { useState, useCallback, useRef } from 'react';
import { saveToJson, saveFromJson } from '../lib/rsrcdump/rsrcdump';

interface ParsedResult {
  success: boolean;
  data?: any;
  error?: string;
  filename?: string;
}

interface StructField {
  id: string;
  type: 'L' | 'l' | 'i' | 'h' | 'H' | 'f' | 'B' | 'b' | 'x' | 's' | 'p';
  fieldName: string;
  count?: number;
  status: 'valid' | 'error' | 'warning';
  statusMessage?: string;
  parsedSample?: any;
}

interface StructSpec {
  id: string;
  fourCC: string;
  fields: StructField[];
  isArray: boolean;
  autoPadding: boolean;
}

export default function ResourceForkParser() {
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [customSpecs, setCustomSpecs] = useState<StructSpec[]>([]);
  const [parseError, setParseError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSpecId, setSelectedSpecId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const specFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with a default spec for demonstration
  React.useEffect(() => {
    const defaultSpec: StructSpec = {
      id: '1',
      fourCC: 'Hedr',
      isArray: false,
      autoPadding: false,
      fields: [
        { id: '1', type: 'L', fieldName: 'version', status: 'valid' },
        { id: '2', type: 'i', fieldName: 'numItems', count: 5, status: 'valid' },
        { id: '3', type: 'f', fieldName: 'dimensions', count: 3, status: 'valid' },
        { id: '4', type: 'i', fieldName: 'properties', count: 5, status: 'valid' },
        { id: '5', type: 'x', fieldName: 'padding', count: 40, status: 'valid' }
      ]
    };
    setCustomSpecs([defaultSpec]);
    setSelectedSpecId('1');
  }, []);

  const generateStructSpec = useCallback((spec: StructSpec): string => {
    let result = '';
    for (const field of spec.fields) {
      if (field.count && field.count > 1) {
        result += `${field.count}${field.type}`;
      } else {
        result += field.type;
      }
    }
    return result + (spec.isArray ? '+' : '');
  }, []);

  const getTypeDescription = useCallback((type: string): string => {
    const descriptions: Record<string, string> = {
      'L': 'Unsigned long (4 bytes)',
      'l': 'Signed long (4 bytes)', 
      'i': 'Signed int (4 bytes)',
      'h': 'Signed short (2 bytes)',
      'H': 'Unsigned short (2 bytes)',
      'f': 'Float (4 bytes)',
      'B': 'Unsigned byte (1 byte)',
      'b': 'Signed byte (1 byte)',
      'x': 'Padding byte',
      's': 'String',
      'p': 'Pascal string'
    };
    return descriptions[type] || 'Unknown type';
  }, []);

  const generateSampleData = useCallback((field: StructField): any => {
    const { type, count = 1 } = field;
    const generateSingle = () => {
      switch (type) {
        case 'L': case 'l': case 'i': return Math.floor(Math.random() * 1000);
        case 'h': case 'H': return Math.floor(Math.random() * 100);
        case 'f': return Math.random() * 100;
        case 'B': case 'b': return Math.floor(Math.random() * 256);
        case 'x': return 0;
        case 's': case 'p': return 'sample_text';
        default: return 0;
      }
    };
    
    if (count > 1) {
      return Array.from({ length: Math.min(count, 3) }, generateSingle);
    }
    return generateSingle();
  }, []);

  const validateAndParseField = useCallback((field: StructField, _spec: StructSpec): StructField => {
    const validTypes = ['L', 'l', 'i', 'h', 'H', 'f', 'B', 'b', 'x', 's', 'p'];
    
    if (!validTypes.includes(field.type)) {
      return {
        ...field,
        status: 'error',
        statusMessage: 'Invalid type. Use L, l, i, h, H, f, B, b, x, s, p'
      };
    }

    if (field.count && (field.count < 1 || field.count > 1000)) {
      return {
        ...field,
        status: 'error',
        statusMessage: 'Count must be between 1 and 1000'
      };
    }

    if (!field.fieldName.trim() && field.type !== 'x') {
      return {
        ...field,
        status: 'warning',
        statusMessage: 'Field name is recommended'
      };
    }

    // Try to generate a sample parsing result
    try {
      return {
        ...field,
        status: 'valid',
        statusMessage: `${field.type} - ${getTypeDescription(field.type)}`,
        parsedSample: generateSampleData(field)
      };
    } catch (error) {
      return {
        ...field,
        status: 'error',
        statusMessage: 'Failed to validate struct'
      };
    }
  }, [getTypeDescription, generateSampleData]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setParseError('');
    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      // Create struct specs array from custom specs
      const structSpecs = customSpecs.map((spec: StructSpec) => {
        const specStr = generateStructSpec(spec);
        const description = spec.fields.map((f: StructField) => f.fieldName).filter(Boolean).join(',');
        return `${spec.fourCC}:${specStr}:${description}`;
      });
      
      const result = saveToJson(data, structSpecs, [], [], false);
      
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
  }, [customSpecs, generateStructSpec]);

  const handleJsonUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setParseError('');
    setIsProcessing(true);

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      // Create struct specs array from custom specs
      const structSpecs = customSpecs.map((spec: StructSpec) => {
        const specStr = generateStructSpec(spec);
        const description = spec.fields.map((f: StructField) => f.fieldName).filter(Boolean).join(',');
        return `${spec.fourCC}:${specStr}:${description}`;
      });
      
      const resourceForkData = saveFromJson(jsonData, structSpecs, false);
      
      // Create download link for binary data
      const blob = new Blob([new Uint8Array(resourceForkData)], { type: 'application/octet-stream' });
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
  }, [customSpecs, generateStructSpec]);

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

  const loadEarthFarmSample = useCallback(async () => {
    setParseError('');
    setIsProcessing(true);

    try {
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      if (!response.ok) {
        throw new Error('Failed to load sample file');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      const result = saveToJson(data, [], [], [], true);
      
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
  }, [customSpecs]);

  const addCustomSpec = useCallback(() => {
    const newSpec: StructSpec = {
      id: Date.now().toString(),
      fourCC: '',
      isArray: false,
      autoPadding: false,
      fields: [
        { id: '1', type: 'i', fieldName: '', status: 'valid' }
      ]
    };
    setCustomSpecs((prev: StructSpec[]) => [...prev, newSpec]);
    setSelectedSpecId(newSpec.id);
  }, []);

  const updateSpec = useCallback((id: string, updates: Partial<StructSpec>) => {
    setCustomSpecs((prev: StructSpec[]) => prev.map((spec: StructSpec) => 
      spec.id === id ? { ...spec, ...updates } : spec
    ));
  }, []);

  const addField = useCallback((specId: string) => {
    setCustomSpecs((prev: StructSpec[]) => prev.map((spec: StructSpec) => {
      if (spec.id === specId) {
        const newField: StructField = {
          id: Date.now().toString(),
          type: 'i',
          fieldName: '',
          status: 'valid'
        };
        return { ...spec, fields: [...spec.fields, newField] };
      }
      return spec;
    }));
  }, []);

  const updateField = useCallback((specId: string, fieldId: string, updates: Partial<StructField>) => {
    setCustomSpecs((prev: StructSpec[]) => prev.map((spec: StructSpec) => {
      if (spec.id === specId) {
        const updatedFields = spec.fields.map((field: StructField) => {
          if (field.id === fieldId) {
            const updatedField = { ...field, ...updates };
            return validateAndParseField(updatedField, spec);
          }
          return field;
        });
        return { ...spec, fields: updatedFields };
      }
      return spec;
    }));
  }, [validateAndParseField]);

  const removeField = useCallback((specId: string, fieldId: string) => {
    setCustomSpecs((prev: StructSpec[]) => prev.map((spec: StructSpec) => {
      if (spec.id === specId) {
        return { ...spec, fields: spec.fields.filter((field: StructField) => field.id !== fieldId) };
      }
      return spec;
    }));
  }, []);

  const removeSpec = useCallback((id: string) => {
    setCustomSpecs((prev: StructSpec[]) => prev.filter((spec: StructSpec) => spec.id !== id));
    if (selectedSpecId === id) {
      setSelectedSpecId(customSpecs.find((s: StructSpec) => s.id !== id)?.id || '');
    }
  }, [selectedSpecId, customSpecs]);

  const saveSpecsToFile = useCallback(() => {
    const specsText = customSpecs.map((spec: StructSpec) => {
      const specStr = generateStructSpec(spec);
      const description = spec.fields.map((f: StructField) => f.fieldName).filter(Boolean).join(',');
      return `${spec.fourCC}:${specStr}:${description}`;
    }).join('\n');

    const blob = new Blob([specsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'struct_specs.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [customSpecs, generateStructSpec]);

  const loadSpecsFromFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('//'));
      
      const loadedSpecs: StructSpec[] = lines.map((line, index) => {
        const [fourCC, spec, description] = line.split(':');
        
        // Parse the spec string into fields
        const fields: StructField[] = [];
        const fieldNames = description ? description.split(',') : [];
        let fieldIndex = 0;
        let i = 0;
        
        while (i < spec.length) {
          if (spec[i] === '+') break;
          
          let count = '';
          while (i < spec.length && /\d/.test(spec[i])) {
            count += spec[i];
            i++;
          }
          
          if (i < spec.length) {
            const type = spec[i];
            const fieldName = fieldNames[fieldIndex] || '';
            
            fields.push({
              id: `${index}-${fieldIndex}`,
              type: type as 'L' | 'l' | 'i' | 'h' | 'H' | 'f' | 'B' | 'b' | 'x' | 's' | 'p',
              fieldName: fieldName.trim(),
              count: count ? parseInt(count) : undefined,
              status: 'valid' as const
            });
            
            fieldIndex++;
            i++;
          }
        }
        
        return {
          id: `loaded-${index}`,
          fourCC: fourCC.trim(),
          isArray: spec.endsWith('+'),
          autoPadding: false,
          fields
        };
      });
      
      setCustomSpecs(loadedSpecs);
      if (loadedSpecs.length > 0) {
        setSelectedSpecId(loadedSpecs[0].id);
      }
    } catch (error) {
      setParseError('Failed to load struct specs file');
    }
  }, []);

  const selectedSpec = customSpecs.find(spec => spec.id === selectedSpecId);

  return (
    <div className="container p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6 text-center text-white">
        Mac Resource Fork Parser
      </h1>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Left Panel - File Operations */}
        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4 text-white">File Operations</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
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
                <label className="block text-sm font-medium mb-2 text-gray-700">
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
                onClick={loadEarthFarmSample}
                disabled={isProcessing}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Load EarthFarm Sample'}
              </button>
            </div>
          </div>

          {/* Struct Specs File Operations */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4 text-white">Struct Specs</h2>
            <div className="space-y-2">
              <button
                onClick={saveSpecsToFile}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 text-sm"
              >
                Save Specs to .txt
              </button>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Load Specs from .txt
                </label>
                <input
                  ref={specFileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={loadSpecsFromFile}
                  className="block w-full text-sm"
                />
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

        {/* Right Panel - Struct Specification Editor */}
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Struct Specifications</h2>
              <button
                onClick={addCustomSpec}
                className="bg-blue-600 text-white py-1 px-3 rounded text-sm hover:bg-blue-700"
              >
                Add Spec
              </button>
            </div>

            {/* Spec Selector */}
            <div className="mb-4">
              <select
                value={selectedSpecId}
                onChange={(e) => setSelectedSpecId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded bg-white text-gray-700"
              >
                <option value="">Select a specification...</option>
                {customSpecs.map(spec => (
                  <option key={spec.id} value={spec.id}>
                    {spec.fourCC || 'Unnamed'} ({spec.fields.length} fields)
                  </option>
                ))}
              </select>
            </div>

            {selectedSpec && (
              <div className="space-y-4">
                {/* Spec Header */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Four-letter Code</label>
                    <input
                      type="text"
                      value={selectedSpec.fourCC}
                      onChange={(e) => updateSpec(selectedSpec.id, { fourCC: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-200 rounded"
                      placeholder="e.g. Hedr"
                      maxLength={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center text-gray-700">
                      <div className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={selectedSpec.isArray}
                          onChange={(e) => updateSpec(selectedSpec.id, { isArray: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </div>
                      <span className="ml-2 text-sm">Is Array</span>
                    </label>
                    <label className="flex items-center text-gray-700">
                      <div className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={selectedSpec.autoPadding}
                          onChange={(e) => updateSpec(selectedSpec.id, { autoPadding: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </div>
                      <span className="ml-2 text-sm">Auto Padding</span>
                    </label>
                  </div>
                </div>

                {/* Fields Table */}
                <div className="table-dark">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Count</th>
                        <th>Field Name</th>
                        <th>Status</th>
                        <th>Sample</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSpec.fields.map((field) => (
                        <tr key={field.id}>
                          <td>
                            <select
                              value={field.type}
                              onChange={(e) => updateField(selectedSpec.id, field.id, { type: e.target.value as StructField['type'] })}
                              className="w-full px-2 py-1 text-sm bg-white border border-gray-200 rounded"
                            >
                              <option value="L">L (ulong)</option>
                              <option value="l">l (long)</option>
                              <option value="i">i (int)</option>
                              <option value="h">h (short)</option>
                              <option value="H">H (ushort)</option>
                              <option value="f">f (float)</option>
                              <option value="B">B (ubyte)</option>
                              <option value="b">b (byte)</option>
                              <option value="x">x (padding)</option>
                              <option value="s">s (string)</option>
                              <option value="p">p (pstring)</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              value={field.count || ''}
                              onChange={(e) => updateField(selectedSpec.id, field.id, { 
                                count: e.target.value ? parseInt(e.target.value) : undefined 
                              })}
                              className="w-full px-2 py-1 text-sm"
                              placeholder="1"
                              min="1"
                              max="1000"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={field.fieldName}
                              onChange={(e) => updateField(selectedSpec.id, field.id, { fieldName: e.target.value })}
                              className="w-full px-2 py-1 text-sm"
                              placeholder="field_name"
                            />
                          </td>
                          <td>
                            <span className={`text-xs ${
                              field.status === 'valid' ? 'status-success' : 
                              field.status === 'error' ? 'status-error' : 'status-warning'
                            }`}>
                              {field.status === 'valid' ? '✓' : field.status === 'error' ? '✗' : '⚠'}
                            </span>
                          </td>
                          <td>
                            <span className="text-xs font-mono text-blue-700">
                              {field.parsedSample !== undefined ? JSON.stringify(field.parsedSample) : '-'}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => removeField(selectedSpec.id, field.id)}
                              className="text-red-600 text-xs hover:text-red-800"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => addField(selectedSpec.id)}
                    className="bg-green-600 text-white py-1 px-3 rounded text-sm hover:bg-green-700"
                  >
                    Add Field
                  </button>
                  <button
                    onClick={() => removeSpec(selectedSpec.id)}
                    className="bg-red-600 text-white py-1 px-3 rounded text-sm hover:bg-red-700"
                  >
                    Delete Spec
                  </button>
                </div>

                {/* Generated Spec Preview */}
                <div className="bg-blue-50 p-3 rounded text-sm">
                  <h4 className="font-semibold text-blue-800 mb-1">Generated Spec:</h4>
                  <code className="text-blue-700">{selectedSpec.fourCC}:{generateStructSpec(selectedSpec)}</code>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useCallback, useRef } from 'react';
import { saveToJson, saveFromJson } from '../lib/rsrcdump/rsrcdump';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ChevronDown, Upload, Download, FileText, Settings } from 'lucide-react';

interface ParsedResult {
  success: boolean;
  data?: any;
  error?: string;
  filename?: string;
}

interface FourLetterCodeSpec {
  fourCC: string;
  structSpec: string;
  isArray: boolean;
  autoPadding: boolean;
  status: 'valid' | 'error' | 'warning';
  statusMessage?: string;
  sampleData?: any;
  dataTypes: DataTypeField[];
}

interface DataTypeField {
  id: string;
  type: 'L' | 'l' | 'i' | 'h' | 'H' | 'f' | 'B' | 'b' | 'x' | 's' | 'p';
  count: number;
  description: string;
}

export default function ResourceForkParser() {
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [fourLetterCodes, setFourLetterCodes] = useState<FourLetterCodeSpec[]>([]);
  const [parseError, setParseError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [saveLoadOpen, setSaveLoadOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const specFileInputRef = useRef<HTMLInputElement>(null);

  // Extract four-letter codes from uploaded file and set default specs
  const extractFourLetterCodes = useCallback(async (file: File): Promise<FourLetterCodeSpec[]> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      // Parse with default specs to extract four-letter codes
      const result = saveToJson(data, [], [], [], false);
      
      // Extract unique four-letter codes from the result
      const fourLetterCodesSet = new Set<string>();
      
      if (result && typeof result === 'object') {
        Object.keys(result).forEach(key => {
          if (key.length === 4) {
            fourLetterCodesSet.add(key);
          }
        });
      }
      
      // Create default specs for each four-letter code
      const defaultSpecs: FourLetterCodeSpec[] = Array.from(fourLetterCodesSet).map(fourCC => ({
        fourCC,
        structSpec: 'i', // Default to single integer
        isArray: false,
        autoPadding: false,
        status: 'valid' as const,
        sampleData: null,
        dataTypes: [
          { id: '1', type: 'i', count: 1, description: 'field_1' }
        ]
      }));
      
      return defaultSpecs;
    } catch (error) {
      console.error('Error extracting four-letter codes:', error);
      return [];
    }
  }, []);

  const generateStructSpec = useCallback((spec: FourLetterCodeSpec): string => {
    let result = '';
    for (const dataType of spec.dataTypes) {
      if (dataType.count > 1) {
        result += `${dataType.count}${dataType.type}`;
      } else {
        result += dataType.type;
      }
    }
    return result + (spec.isArray ? '+' : '');
  }, []);

  const parseWithSpecs = useCallback(async (data: Uint8Array, specs: FourLetterCodeSpec[]) => {
    try {
      // Create struct specs array for parsing
      const structSpecs = specs.map((spec: FourLetterCodeSpec) => {
        const specStr = generateStructSpec(spec);
        const description = spec.dataTypes.map(dt => dt.description).join(',');
        return `${spec.fourCC}:${specStr}:${description}`;
      });
      
      const result = saveToJson(data, structSpecs, [], [], false);
      
      // Update specs with sample data and validation status
      const updatedSpecs = specs.map(spec => {
        const sampleData = result && result[spec.fourCC] ? result[spec.fourCC] : null;
        
        return {
          ...spec,
          sampleData,
          status: sampleData ? 'valid' as const : 'error' as const,
          statusMessage: sampleData ? 'Successfully parsed' : 'Failed to parse data'
        };
      });
      
      return { result, updatedSpecs };
    } catch (error) {
      // Mark all specs as error
      const errorSpecs = specs.map(spec => ({
        ...spec,
        status: 'error' as const,
        statusMessage: 'Parse error: ' + (error instanceof Error ? error.message : 'Unknown error')
      }));
      
      return { result: null, updatedSpecs: errorSpecs };
    }
  }, [generateStructSpec]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setParseError('');
    setIsProcessing(true);
    setCurrentFile(file);

    try {
      // Extract four-letter codes from the file
      const extractedSpecs = await extractFourLetterCodes(file);
      setFourLetterCodes(extractedSpecs);
      
      // Parse with default specs
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const { result, updatedSpecs } = await parseWithSpecs(data, extractedSpecs);
      
      setFourLetterCodes(updatedSpecs);
      
      if (result) {
        setParsedResult({
          success: true,
          data: result,
          filename: file.name
        });
      }
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
  }, [extractFourLetterCodes, parseWithSpecs]);

  const handleReparse = useCallback(async () => {
    if (!currentFile) return;
    
    setIsProcessing(true);
    try {
      const arrayBuffer = await currentFile.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const { result, updatedSpecs } = await parseWithSpecs(data, fourLetterCodes);
      
      setFourLetterCodes(updatedSpecs);
      
      if (result) {
        setParsedResult({
          success: true,
          data: result,
          filename: currentFile.name
        });
        setParseError('');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setParseError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [currentFile, fourLetterCodes, parseWithSpecs]);

  const handleJsonUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setParseError('');
    setIsProcessing(true);

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      // Create struct specs array from current four-letter codes
      const structSpecs = fourLetterCodes.map((spec: FourLetterCodeSpec) => {
        const specStr = generateStructSpec(spec);
        const description = spec.dataTypes.map(dt => dt.description).join(',');
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
  }, [fourLetterCodes, generateStructSpec]);

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
      
      // Create a File object to simulate file upload
      const file = new File([arrayBuffer], 'EarthFarm.ter.rsrc', { type: 'application/octet-stream' });
      setCurrentFile(file);
      
      // Extract four-letter codes and parse
      const extractedSpecs = await extractFourLetterCodes(file);
      
      // Set default EarthFarm specs if available
      const earthFarmSpecs = extractedSpecs.map(spec => {
        if (spec.fourCC === 'Hedr') {
          return {
            ...spec,
            dataTypes: [
              { id: '1', type: 'L' as const, count: 1, description: 'version' },
              { id: '2', type: 'i' as const, count: 5, description: 'numItems' },
              { id: '3', type: 'f' as const, count: 3, description: 'dimensions' },
              { id: '4', type: 'i' as const, count: 5, description: 'properties' },
              { id: '5', type: 'x' as const, count: 40, description: 'padding' }
            ]
          };
        } else if (spec.fourCC === 'Layr') {
          return {
            ...spec,
            dataTypes: [
              { id: '1', type: 'i' as const, count: 1, description: 'layer_data' }
            ]
          };
        }
        return spec;
      });
      
      setFourLetterCodes(earthFarmSpecs);
      
      // Parse with updated specs
      const data = new Uint8Array(arrayBuffer);
      const { result, updatedSpecs } = await parseWithSpecs(data, earthFarmSpecs);
      
      setFourLetterCodes(updatedSpecs);
      
      if (result) {
        setParsedResult({
          success: true,
          data: result,
          filename: 'EarthFarm.ter.rsrc'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load sample file';
      setParseError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [extractFourLetterCodes, parseWithSpecs]);

  const updateFourLetterCode = useCallback((fourCC: string, updates: Partial<FourLetterCodeSpec>) => {
    setFourLetterCodes(prev => prev.map(spec => 
      spec.fourCC === fourCC ? { ...spec, ...updates } : spec
    ));
  }, []);

  const updateDataType = useCallback((fourCC: string, dataTypeId: string, updates: Partial<DataTypeField>) => {
    setFourLetterCodes(prev => prev.map(spec => {
      if (spec.fourCC === fourCC) {
        const updatedDataTypes = spec.dataTypes.map(dt => 
          dt.id === dataTypeId ? { ...dt, ...updates } : dt
        );
        return { ...spec, dataTypes: updatedDataTypes };
      }
      return spec;
    }));
  }, []);

  const addDataType = useCallback((fourCC: string) => {
    setFourLetterCodes(prev => prev.map(spec => {
      if (spec.fourCC === fourCC) {
        const newDataType: DataTypeField = {
          id: Date.now().toString(),
          type: 'i',
          count: 1,
          description: `field_${spec.dataTypes.length + 1}`
        };
        return { ...spec, dataTypes: [...spec.dataTypes, newDataType] };
      }
      return spec;
    }));
  }, []);

  const removeDataType = useCallback((fourCC: string, dataTypeId: string) => {
    setFourLetterCodes(prev => prev.map(spec => {
      if (spec.fourCC === fourCC) {
        return { ...spec, dataTypes: spec.dataTypes.filter(dt => dt.id !== dataTypeId) };
      }
      return spec;
    }));
  }, []);

  const saveSpecsToFile = useCallback(() => {
    const specsText = fourLetterCodes.map((spec: FourLetterCodeSpec) => {
      const specStr = generateStructSpec(spec);
      const description = spec.dataTypes.map(dt => dt.description).join(',');
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
  }, [fourLetterCodes, generateStructSpec]);

  const loadSpecsFromFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('//'));
      
      const loadedSpecs: FourLetterCodeSpec[] = lines.map((line, index) => {
        const [fourCC, spec, description] = line.split(':');
        
        // Parse the spec string into data types
        const dataTypes: DataTypeField[] = [];
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
            const description = fieldNames[fieldIndex] || `field_${fieldIndex + 1}`;
            
            dataTypes.push({
              id: `${index}-${fieldIndex}`,
              type: type as DataTypeField['type'],
              count: count ? parseInt(count) : 1,
              description: description.trim()
            });
            
            fieldIndex++;
            i++;
          }
        }
        
        return {
          fourCC: fourCC.trim(),
          structSpec: spec,
          isArray: spec.endsWith('+'),
          autoPadding: false,
          status: 'valid' as const,
          sampleData: null,
          dataTypes
        };
      });
      
      setFourLetterCodes(loadedSpecs);
    } catch (error) {
      setParseError('Failed to load struct specs file');
    }
  }, []);

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-3xl font-bold text-center text-white mb-8">
        Mac Resource Fork Parser
      </h1>
      
      {/* Collapsible Save/Load Section */}
      <Card>
        <Collapsible open={saveLoadOpen} onOpenChange={setSaveLoadOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-accent">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="font-medium">Save & Load Specifications</span>
            </div>
            <ChevronDown className="h-4 w-4 transition-transform duration-200" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={saveSpecsToFile} variant="outline" className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  Save Specs to .txt
                </Button>
                <div>
                  <input
                    ref={specFileInputRef}
                    type="file"
                    accept=".txt"
                    onChange={loadSpecsFromFile}
                    className="hidden"
                    id="spec-file-input"
                  />
                  <Button 
                    onClick={() => specFileInputRef.current?.click()} 
                    variant="outline" 
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Load Specs from .txt
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Combined File Upload/Download Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            File Operations
          </CardTitle>
          <CardDescription>
            Upload a resource fork file to analyze, or convert JSON back to .rsrc format
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Upload Resource Fork */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Upload .rsrc file</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".rsrc"
                onChange={handleFileUpload}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                disabled={isProcessing}
              />
            </div>

            {/* Upload JSON */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Upload .json file</label>
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json"
                onChange={handleJsonUpload}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80"
                disabled={isProcessing}
              />
            </div>

            {/* Sample File */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Sample File</label>
              <Button
                onClick={loadEarthFarmSample}
                disabled={isProcessing}
                className="w-full"
                variant="secondary"
              >
                {isProcessing ? 'Loading...' : 'Load EarthFarm Sample'}
              </Button>
            </div>
          </div>

          {/* Download JSON Button */}
          {parsedResult?.success && (
            <div className="pt-4 border-t">
              <Button onClick={downloadJson} className="w-full" size="lg">
                <Download className="h-4 w-4 mr-2" />
                Download Parsed JSON
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {parseError && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{parseError}</p>
          </CardContent>
        </Card>
      )}

      {/* Success Display */}
      {parsedResult?.success && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="text-green-800 dark:text-green-200">
              Parsing Successful!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-700 dark:text-green-300">
              File: {parsedResult.filename}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Four-Letter Codes Configuration */}
      {fourLetterCodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Configure Four-Letter Codes</CardTitle>
            <CardDescription>
              Adjust data type specifications for each four-letter code found in your file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {fourLetterCodes.map((spec) => (
              <div key={spec.fourCC} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{spec.fourCC}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      spec.status === 'valid' ? 'bg-green-100 text-green-800' : 
                      spec.status === 'error' ? 'bg-red-100 text-red-800' : 
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {spec.status === 'valid' ? '✓' : spec.status === 'error' ? '✗' : '⚠'}
                      {spec.statusMessage}
                    </span>
                  </div>
                </div>

                {/* Toggle Controls */}
                <div className="flex gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={spec.isArray}
                      onChange={(e) => updateFourLetterCode(spec.fourCC, { isArray: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Is Array</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={spec.autoPadding}
                      onChange={(e) => updateFourLetterCode(spec.fourCC, { autoPadding: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Auto Padding</span>
                  </label>
                </div>

                {/* Data Types Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-border rounded-lg">
                    <thead>
                      <tr className="bg-muted">
                        <th className="border border-border p-3 text-left">Type</th>
                        <th className="border border-border p-3 text-left">Count</th>
                        <th className="border border-border p-3 text-left">Description</th>
                        <th className="border border-border p-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spec.dataTypes.map((dataType) => (
                        <tr key={dataType.id}>
                          <td className="border border-border p-3">
                            <select
                              value={dataType.type}
                              onChange={(e) => updateDataType(spec.fourCC, dataType.id, { 
                                type: e.target.value as DataTypeField['type'] 
                              })}
                              className="w-full px-3 py-1 border border-input rounded-md bg-background min-w-[120px]"
                            >
                              <option value="L">L (unsigned long)</option>
                              <option value="l">l (signed long)</option>
                              <option value="i">i (signed int)</option>
                              <option value="h">h (signed short)</option>
                              <option value="H">H (unsigned short)</option>
                              <option value="f">f (float)</option>
                              <option value="B">B (unsigned byte)</option>
                              <option value="b">b (signed byte)</option>
                              <option value="x">x (padding)</option>
                              <option value="s">s (string)</option>
                              <option value="p">p (pascal string)</option>
                            </select>
                          </td>
                          <td className="border border-border p-3">
                            <input
                              type="number"
                              value={dataType.count}
                              onChange={(e) => updateDataType(spec.fourCC, dataType.id, { 
                                count: parseInt(e.target.value) || 1 
                              })}
                              className="w-full px-3 py-1 border border-input rounded-md bg-background"
                              min="1"
                              max="1000"
                            />
                          </td>
                          <td className="border border-border p-3">
                            <input
                              type="text"
                              value={dataType.description}
                              onChange={(e) => updateDataType(spec.fourCC, dataType.id, { 
                                description: e.target.value 
                              })}
                              className="w-full px-3 py-1 border border-input rounded-md bg-background"
                              placeholder="field_name"
                            />
                          </td>
                          <td className="border border-border p-3">
                            <Button
                              onClick={() => removeDataType(spec.fourCC, dataType.id)}
                              variant="destructive"
                              size="sm"
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center">
                  <Button
                    onClick={() => addDataType(spec.fourCC)}
                    variant="outline"
                  >
                    Add Data Type
                  </Button>
                  <Button
                    onClick={handleReparse}
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Processing...' : 'Update Parse'}
                  </Button>
                </div>

                {/* Sample Data Display */}
                {spec.sampleData && (
                  <div className="bg-muted p-3 rounded-lg">
                    <h4 className="font-medium mb-2">Sample Data:</h4>
                    <pre className="text-xs font-mono overflow-x-auto">
                      {JSON.stringify(spec.sampleData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
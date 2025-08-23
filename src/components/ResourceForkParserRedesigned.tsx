import React, { useState, useCallback, useRef } from 'react';
import { saveToJson, saveFromJson } from '../lib/rsrcdump/rsrcdump';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ChevronDown, Upload, Download, FileText, Settings, Plus, Trash2, Check, X, AlertTriangle } from 'lucide-react';

interface ParsedResult {
  success: boolean;
  data?: any;
  error?: string;
  filename?: string;
}

interface FourLetterCodeSpec {
  fourCC: string;
  dataTypes: DataTypeField[];
  isArray: boolean;
  autoPadding: boolean;
  status: 'valid' | 'error' | 'warning';
  statusMessage?: string;
  sampleData?: any;
}

interface DataTypeField {
  id: string;
  type: 'L' | 'l' | 'i' | 'h' | 'H' | 'f' | 'B' | 'b' | 'x' | 's' | 'p';
  count: number;
  description: string;
}

const DATA_TYPE_OPTIONS = [
  { value: 'L', label: 'L - Unsigned Long (4 bytes)' },
  { value: 'l', label: 'l - Signed Long (4 bytes)' },
  { value: 'i', label: 'i - Signed Int (4 bytes)' },
  { value: 'h', label: 'h - Signed Short (2 bytes)' },
  { value: 'H', label: 'H - Unsigned Short (2 bytes)' },
  { value: 'f', label: 'f - Float (4 bytes)' },
  { value: 'B', label: 'B - Unsigned Byte (1 byte)' },
  { value: 'b', label: 'b - Signed Byte (1 byte)' },
  { value: 'x', label: 'x - Padding Byte (1 byte)' },
  { value: 's', label: 's - String' },
  { value: 'p', label: 'p - Pascal String' },
] as const;

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
      
      // Parse with empty specs first to get the raw structure
      const result = saveToJson(data, [], [], [], false);
      
      // Extract unique four-letter codes from the result
      const fourLetterCodesSet = new Set<string>();
      
      if (result && typeof result === 'object') {
        Object.keys(result).forEach(key => {
          if (key.length === 4 && /^[A-Za-z0-9]{4}$/.test(key)) {
            fourLetterCodesSet.add(key);
          }
        });
      }
      
      // Create default specs for each four-letter code
      const defaultSpecs: FourLetterCodeSpec[] = Array.from(fourLetterCodesSet).map(fourCC => ({
        fourCC,
        dataTypes: [
          { id: '1', type: 'i', count: 1, description: 'field_1' }
        ],
        isArray: false,
        autoPadding: false,
        status: 'valid' as const,
        sampleData: null
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
        
        let status: 'valid' | 'error' | 'warning' = 'error';
        let statusMessage = 'Failed to parse data';
        
        if (sampleData) {
          if (Array.isArray(sampleData) && sampleData.length > 0) {
            status = 'valid';
            statusMessage = `Successfully parsed ${sampleData.length} items`;
          } else if (typeof sampleData === 'object' && Object.keys(sampleData).length > 0) {
            status = 'valid';
            statusMessage = 'Successfully parsed data';
          } else {
            status = 'warning';
            statusMessage = 'Parsed but no meaningful data found';
          }
        }
        
        return {
          ...spec,
          sampleData,
          status,
          statusMessage
        };
      });
      
      return { result, updatedSpecs };
    } catch (error) {
      console.error('Error parsing with specs:', error);
      throw error;
    }
  }, [generateStructSpec]);

  // Handle .rsrc file upload - main flow starts here
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setParseError('');
    setIsProcessing(true);

    try {
      // Extract four-letter codes automatically
      const extractedSpecs = await extractFourLetterCodes(file);
      setFourLetterCodes(extractedSpecs);

      // Parse with default specs to show initial samples
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const { result, updatedSpecs } = await parseWithSpecs(data, extractedSpecs);
      
      setFourLetterCodes(updatedSpecs);
      setCurrentFile(file);
      
      if (result) {
        setParsedResult({
          success: true,
          data: result,
          filename: file.name
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse file';
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

  // Re-parse when specs change
  const reParseWithUpdatedSpecs = useCallback(async (updatedSpecs: FourLetterCodeSpec[]) => {
    if (!currentFile) return;

    try {
      const arrayBuffer = await currentFile.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const { result, updatedSpecs: newSpecs } = await parseWithSpecs(data, updatedSpecs);
      
      setFourLetterCodes(newSpecs);
      
      if (result) {
        setParsedResult({
          success: true,
          data: result,
          filename: currentFile.name
        });
      }
    } catch (error) {
      console.error('Error re-parsing:', error);
    }
  }, [currentFile, parseWithSpecs]);

  // Update four-letter code spec
  const updateFourLetterCodeSpec = useCallback((index: number, updates: Partial<FourLetterCodeSpec>) => {
    const updatedSpecs = [...fourLetterCodes];
    updatedSpecs[index] = { ...updatedSpecs[index], ...updates };
    setFourLetterCodes(updatedSpecs);
    reParseWithUpdatedSpecs(updatedSpecs);
  }, [fourLetterCodes, reParseWithUpdatedSpecs]);

  // Add data type to spec
  const addDataTypeToSpec = useCallback((specIndex: number) => {
    const updatedSpecs = [...fourLetterCodes];
    const newId = (updatedSpecs[specIndex].dataTypes.length + 1).toString();
    updatedSpecs[specIndex].dataTypes.push({
      id: newId,
      type: 'i',
      count: 1,
      description: `field_${newId}`
    });
    setFourLetterCodes(updatedSpecs);
    reParseWithUpdatedSpecs(updatedSpecs);
  }, [fourLetterCodes, reParseWithUpdatedSpecs]);

  // Remove data type from spec
  const removeDataTypeFromSpec = useCallback((specIndex: number, dataTypeId: string) => {
    const updatedSpecs = [...fourLetterCodes];
    updatedSpecs[specIndex].dataTypes = updatedSpecs[specIndex].dataTypes.filter(dt => dt.id !== dataTypeId);
    setFourLetterCodes(updatedSpecs);
    reParseWithUpdatedSpecs(updatedSpecs);
  }, [fourLetterCodes, reParseWithUpdatedSpecs]);

  // Update data type
  const updateDataType = useCallback((specIndex: number, dataTypeId: string, updates: Partial<DataTypeField>) => {
    const updatedSpecs = [...fourLetterCodes];
    const dataTypeIndex = updatedSpecs[specIndex].dataTypes.findIndex(dt => dt.id === dataTypeId);
    if (dataTypeIndex !== -1) {
      updatedSpecs[specIndex].dataTypes[dataTypeIndex] = { 
        ...updatedSpecs[specIndex].dataTypes[dataTypeIndex], 
        ...updates 
      };
      setFourLetterCodes(updatedSpecs);
      reParseWithUpdatedSpecs(updatedSpecs);
    }
  }, [fourLetterCodes, reParseWithUpdatedSpecs]);

  // Load EarthFarm sample file
  const loadEarthFarmSample = useCallback(async () => {
    setParseError('');
    setIsProcessing(true);

    try {
      const response = await fetch('/test-files/EarthFarm.ter.rsrc');
      if (!response.ok) {
        throw new Error('Failed to load EarthFarm sample file');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      // Use default Otto Matic specs for EarthFarm
      const earthFarmSpecs: FourLetterCodeSpec[] = [
        {
          fourCC: 'Hedr',
          dataTypes: [
            { id: '1', type: 'L', count: 5, description: 'header_data' },
            { id: '2', type: 'i', count: 3, description: 'integers' },
            { id: '3', type: 'f', count: 5, description: 'floats' },
            { id: '4', type: 'i', count: 40, description: 'more_data' },
            { id: '5', type: 'x', count: 40, description: 'padding' }
          ],
          isArray: false,
          autoPadding: false,
          status: 'valid' as const,
          sampleData: null
        },
        {
          fourCC: 'Layr',
          dataTypes: [
            { id: '1', type: 'i', count: 1, description: 'field_name' }
          ],
          isArray: true,
          autoPadding: false,
          status: 'valid' as const,
          sampleData: null
        }
      ];
      
      // Parse with Otto Matic specs
      const { result, updatedSpecs } = await parseWithSpecs(data, earthFarmSpecs);
      
      setFourLetterCodes(updatedSpecs);
      setCurrentFile(new File([data], 'EarthFarm.ter.rsrc'));
      
      if (result) {
        setParsedResult({
          success: true,
          data: result,
          filename: 'EarthFarm.ter.rsrc'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load EarthFarm sample';
      setParseError(errorMessage);
      setParsedResult({
        success: false,
        error: errorMessage,
        filename: 'EarthFarm.ter.rsrc'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [parseWithSpecs]);

  // Handle JSON upload
  const handleJsonUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setParseError('');
    setIsProcessing(true);

    try {
      const jsonText = await file.text();
      const jsonData = JSON.parse(jsonText);
      
      // Convert JSON back to .rsrc
      const structSpecs = fourLetterCodes.map((spec: FourLetterCodeSpec) => {
        const specStr = generateStructSpec(spec);
        const description = spec.dataTypes.map(dt => dt.description).join(',');
        return `${spec.fourCC}:${specStr}:${description}`;
      });
      
      const rsrcData = saveFromJson(jsonData, structSpecs, false);
      
      // Download as .rsrc file
      const blob = new Blob([rsrcData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'converted.rsrc';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to convert JSON';
      setParseError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [fourLetterCodes, generateStructSpec]);

  // Download JSON
  const downloadJson = useCallback(() => {
    if (!parsedResult?.data) return;
    
    const blob = new Blob([JSON.stringify(parsedResult.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${parsedResult.filename || 'parsed'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [parsedResult]);

  // Save specifications to file
  const saveSpecifications = useCallback(() => {
    const specs = fourLetterCodes.map(spec => {
      const structSpec = generateStructSpec(spec);
      const description = spec.dataTypes.map(dt => dt.description).join(',');
      return `${spec.fourCC}:${structSpec}:${description}`;
    }).join('\n');
    
    const blob = new Blob([specs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'specifications.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [fourLetterCodes, generateStructSpec]);

  // Load specifications from file
  const handleSpecUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      const loadedSpecs: FourLetterCodeSpec[] = lines.map((line) => {
        const [fourCC, structSpec] = line.split(':');
        
        // Parse the struct spec back into data types
        const dataTypes: DataTypeField[] = [];
        let currentIndex = 0;
        let fieldIndex = 1;
        
        while (currentIndex < structSpec.length) {
          let count = 1;
          let type: any = structSpec[currentIndex];
          
          // Check for count prefix
          const countMatch = structSpec.slice(currentIndex).match(/^(\d+)([A-Za-z])/);
          if (countMatch) {
            count = parseInt(countMatch[1]);
            type = countMatch[2] as any;
            currentIndex += countMatch[0].length;
          } else {
            currentIndex++;
          }
          
          dataTypes.push({
            id: fieldIndex.toString(),
            type,
            count,
            description: `field_${fieldIndex}`
          });
          fieldIndex++;
        }
        
        const isArray = structSpec.endsWith('+');
        
        return {
          fourCC,
          dataTypes,
          isArray,
          autoPadding: false,
          status: 'valid' as const,
          sampleData: null
        };
      });
      
      setFourLetterCodes(loadedSpecs);
      reParseWithUpdatedSpecs(loadedSpecs);
      
    } catch (error) {
      setParseError('Failed to load specifications file');
    }
  }, [reParseWithUpdatedSpecs]);

  const getStatusIcon = (status: 'valid' | 'error' | 'warning') => {
    switch (status) {
      case 'valid':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'error':
        return <X className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const formatSampleData = (sampleData: any): string => {
    if (!sampleData) return '-';
    
    if (Array.isArray(sampleData)) {
      if (sampleData.length === 0) return 'Empty array';
      if (sampleData.length === 1) return JSON.stringify(sampleData[0]);
      return `Array[${sampleData.length}]: ${JSON.stringify(sampleData[0])}...`;
    }
    
    if (typeof sampleData === 'object') {
      const keys = Object.keys(sampleData);
      if (keys.length === 0) return 'Empty object';
      return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
    }
    
    return JSON.stringify(sampleData);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white">Mac Resource Fork Parser</h1>
          <p className="text-gray-400 text-lg">
            Upload a resource fork file to analyze and experiment with data types
          </p>
        </div>

        {/* Save/Load Specifications - Collapsible */}
        <Card className="bg-gray-800 border-gray-700">
          <Collapsible open={saveLoadOpen} onOpenChange={setSaveLoadOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-700 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    <CardTitle className="text-white">Save & Load Specifications</CardTitle>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${saveLoadOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Save Current Specifications</label>
                    <Button
                      onClick={saveSpecifications}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={fourLetterCodes.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Save Specifications
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Load Specifications from File</label>
                    <Input
                      type="file"
                      accept=".txt"
                      onChange={handleSpecUpload}
                      ref={specFileInputRef}
                      className="hidden"
                    />
                    <Button
                      onClick={() => specFileInputRef.current?.click()}
                      className="w-full bg-gray-600 hover:bg-gray-700 text-white"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Load Specifications
                    </Button>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* File Operations - Combined Upload/Download */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <FileText className="h-5 w-5" />
              File Operations
            </CardTitle>
            <CardDescription className="text-gray-400">
              Upload files to parse or convert, or try the sample file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upload Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Upload .rsrc file */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Upload .rsrc File</label>
                <Input
                  type="file"
                  accept=".rsrc"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  disabled={isProcessing}
                  size="lg"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose .rsrc File
                </Button>
              </div>

              {/* Upload JSON file */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Upload .json File</label>
                <Input
                  type="file"
                  accept=".json"
                  onChange={handleJsonUpload}
                  ref={jsonInputRef}
                  className="hidden"
                />
                <Button
                  onClick={() => jsonInputRef.current?.click()}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={isProcessing || fourLetterCodes.length === 0}
                  size="lg"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Convert from JSON
                </Button>
              </div>

              {/* Sample file */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-300">Sample File</label>
                <Button
                  onClick={loadEarthFarmSample}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  disabled={isProcessing}
                  size="lg"
                >
                  Load EarthFarm Sample
                </Button>
              </div>
            </div>

            {/* Download JSON Button - Prominent */}
            {parsedResult?.success && (
              <div className="pt-6 border-t border-gray-700">
                <Button
                  onClick={downloadJson}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg py-4"
                  size="lg"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Download as JSON
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Display */}
        {parseError && (
          <Card className="bg-red-900 border-red-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-red-100">
                <X className="h-5 w-5" />
                <span className="font-medium">Error:</span>
                <span>{parseError}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-gray-300">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                <span>Processing...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Four-Letter Code Specifications */}
        {fourLetterCodes.length > 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Four-Letter Code Specifications</CardTitle>
              <CardDescription className="text-gray-400">
                Configure data types for each four-letter code found in your file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {fourLetterCodes.map((spec, specIndex) => (
                <div key={spec.fourCC} className="border border-gray-600 rounded-lg p-6 space-y-6 bg-gray-750">
                  {/* Four-letter code header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <h3 className="text-xl font-semibold text-white">{spec.fourCC}</h3>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(spec.status)}
                        <Badge 
                          variant={spec.status === 'valid' ? 'default' : spec.status === 'error' ? 'destructive' : 'secondary'}
                          className="text-sm"
                        >
                          {spec.statusMessage || spec.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={spec.isArray}
                          onChange={(e) => updateFourLetterCodeSpec(specIndex, { isArray: e.target.checked })}
                          className="rounded bg-gray-700 border-gray-600"
                        />
                        Is Array
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={spec.autoPadding}
                          onChange={(e) => updateFourLetterCodeSpec(specIndex, { autoPadding: e.target.checked })}
                          className="rounded bg-gray-700 border-gray-600"
                        />
                        Auto Padding
                      </label>
                    </div>
                  </div>

                  {/* Sample Data Display */}
                  {spec.sampleData && (
                    <div className="bg-gray-900 rounded p-4 space-y-2">
                      <h4 className="font-medium text-gray-300">Sample Data:</h4>
                      <pre className="text-sm text-gray-400 overflow-x-auto">
                        {formatSampleData(spec.sampleData)}
                      </pre>
                    </div>
                  )}

                  {/* Data types table */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-200">Data Type Fields</h4>
                      <Button
                        onClick={() => addDataTypeToSpec(specIndex)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Field
                      </Button>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-600">
                          <TableHead className="text-gray-300">Type</TableHead>
                          <TableHead className="text-gray-300">Count</TableHead>
                          <TableHead className="text-gray-300">Description</TableHead>
                          <TableHead className="text-gray-300">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {spec.dataTypes.map((dataType) => (
                          <TableRow key={dataType.id} className="border-gray-600">
                            <TableCell>
                              <Select
                                value={dataType.type}
                                onValueChange={(value: any) => 
                                  updateDataType(specIndex, dataType.id, { type: value })
                                }
                              >
                                <SelectTrigger className="w-64 bg-gray-700 border-gray-600 text-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-700 border-gray-600">
                                  {DATA_TYPE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value} className="text-white hover:bg-gray-600">
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={dataType.count}
                                onChange={(e) => 
                                  updateDataType(specIndex, dataType.id, { count: parseInt(e.target.value) || 1 })
                                }
                                className="w-20 bg-gray-700 border-gray-600 text-white"
                                min="1"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={dataType.description}
                                onChange={(e) => 
                                  updateDataType(specIndex, dataType.id, { description: e.target.value })
                                }
                                className="w-48 bg-gray-700 border-gray-600 text-white"
                                placeholder="Field description"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                onClick={() => removeDataTypeFromSpec(specIndex, dataType.id)}
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white"
                                disabled={spec.dataTypes.length === 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
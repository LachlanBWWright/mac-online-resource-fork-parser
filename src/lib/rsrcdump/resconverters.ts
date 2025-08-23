// Resource converters for different resource types

import type { Resource, ResourceFork, ResourceConverter, StructTemplate } from './types';
import { StructTemplateParser } from './structtemplate';

export class Base16Converter implements ResourceConverter {
  unpack(resource: Resource, _fork?: ResourceFork): string {
    return Array.from(resource.data)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  pack(obj: string): Uint8Array {
    if (typeof obj !== 'string') {
      throw new Error('Expected string for base16 data');
    }
    
    const result = new Uint8Array(obj.length / 2);
    for (let i = 0; i < obj.length; i += 2) {
      result[i / 2] = parseInt(obj.substr(i, 2), 16);
    }
    return result;
  }
}

export class StructConverter implements ResourceConverter {
  private template: StructTemplate;

  static fromTemplateStringWithTypename(templateArg: string): [StructConverter | null, Uint8Array | null] {
    const trimmed = templateArg.trim();
    if (!trimmed || trimmed.startsWith('//')) {
      return [null, null];
    }

    const split = trimmed.split(':', 3);
    if (split.length < 2) {
      throw new Error('Invalid template format');
    }

    const restype = parseTypeName(split[0]);
    const formatAndFields = split.slice(1).join(':'); // Rejoin format and fields
    const template = StructTemplateParser.fromTemplateString(formatAndFields);
    
    return [new StructConverter(template), restype];
  }

  constructor(template: StructTemplate) {
    this.template = template;
  }

  unpack(resource: Resource, _fork?: ResourceFork): any {
    if (this.template.isList) {
      const result: any[] = [];
      
      if (resource.data.length % this.template.recordLength !== 0) {
        throw new Error(
          `The length of ${resource.type} ${resource.id} (${resource.data.length} bytes) ` +
          `isn't a multiple of the struct format for this resource type ` +
          `(${this.template.recordLength} bytes)`
        );
      }

      const numRecords = resource.data.length / this.template.recordLength;
      for (let i = 0; i < numRecords; i++) {
        const record = StructTemplateParser.unpackRecord(
          resource.data, 
          i * this.template.recordLength, 
          this.template
        );
        result.push(record);
      }
      return result;
    } else {
      if (resource.data.length !== this.template.recordLength) {
        throw new Error(
          `The length of ${resource.type} ${resource.id} (${resource.data.length} bytes) ` +
          `doesn't match the struct format for this resource type ` +
          `(${this.template.recordLength} bytes)`
        );
      }

      return StructTemplateParser.unpackRecord(resource.data, 0, this.template);
    }
  }

  pack(obj: any): Uint8Array {
    if (this.template.isList) {
      if (!Array.isArray(obj)) {
        throw new Error('Expected array for list struct');
      }
      
      const result = new Uint8Array(obj.length * this.template.recordLength);
      for (let i = 0; i < obj.length; i++) {
        const record = this.packRecord(obj[i], this.template);
        result.set(record, i * this.template.recordLength);
      }
      return result;
    } else {
      return this.packRecord(obj, this.template);
    }
  }

  private packRecord(obj: any, template: StructTemplate): Uint8Array {
    const result = new Uint8Array(template.recordLength);
    const view = new DataView(result.buffer);
    const fields = StructTemplateParser.splitStructFormatFields(template.format);
    
    let pos = 0;
    let fieldIndex = 0;

    for (const field of fields) {
      let value: any;
      
      if (fieldIndex < template.fieldNames.length) {
        const fieldName = template.fieldNames[fieldIndex];
        if (fieldName !== null) {
          value = obj[fieldName];
        }
      }
      
      switch (field) {
        case 'B': // unsigned char
          view.setUint8(pos, value || 0);
          pos += 1;
          break;
        case 'b': // signed char
          view.setInt8(pos, value || 0);
          pos += 1;
          break;
        case 'H': // unsigned short (big-endian)
          view.setUint16(pos, value || 0, false);
          pos += 2;
          break;
        case 'h': // signed short (big-endian)
          view.setInt16(pos, value || 0, false);
          pos += 2;
          break;
        case 'I': // unsigned int (big-endian)
        case 'L': // unsigned long (big-endian)
          view.setUint32(pos, value || 0, false);
          pos += 4;
          break;
        case 'i': // signed int (big-endian)
        case 'l': // signed long (big-endian)
          view.setInt32(pos, value || 0, false);
          pos += 4;
          break;
        case 'f': // float (big-endian)
          view.setFloat32(pos, value || 0.0, false);
          pos += 4;
          break;
        case 'Q': // unsigned long long (big-endian)
          view.setBigUint64(pos, BigInt(value || 0), false);
          pos += 8;
          break;
        case 'q': // signed long long (big-endian)
          view.setBigInt64(pos, BigInt(value || 0), false);
          pos += 8;
          break;
        case 'd': // double (big-endian)
          view.setFloat64(pos, value || 0.0, false);
          pos += 8;
          break;
        case 'x': // pad byte
          view.setUint8(pos, 0); // Write padding as zero
          pos += 1;
          break;
        case '?': // bool
          view.setUint8(pos, value ? 1 : 0);
          pos += 1;
          break;
        default:
          if (field.endsWith('s')) {
            // String field
            const num = parseInt(field.slice(0, -1));
            const str = (value || '').toString();
            const encoded = new TextEncoder().encode(str);
            const toCopy = Math.min(encoded.length, num);
            result.set(encoded.slice(0, toCopy), pos);
            pos += num;
          } else {
            throw new Error(`Unknown field type: ${field}`);
          }
      }
      
      // Only increment field index for non-padding fields
      if (field !== 'x') {
        fieldIndex++;
      }
    }
    
    return result;
  }
}

// Helper function to parse type names (moved from textio to avoid circular imports)
function parseTypeName(saneName: string): Uint8Array {
  const decoded = new TextEncoder().encode(decodeURIComponent(saneName));
  const result = new Uint8Array(4);
  result.fill(0x20); // space character
  
  for (let i = 0; i < Math.min(decoded.length, 4); i++) {
    result[i] = decoded[i];
  }
  
  if (decoded.length > 4) {
    throw new Error(`decoded restype doesn't work out to 4 bytes`);
  }
  
  return result;
}

export const standardConverters: Map<string, ResourceConverter> = new Map([
  // Add standard converters here as needed
  // For now we'll focus on struct converters
]);
# Mac Resource Fork Parser - Online Tool

**⚠️ Work In Progress Disclaimer: This application is currently under active development. Features may be incomplete, and parsing results should be verified. Use with caution for production data.**

A web-based tool for parsing Mac resource fork files (.rsrc) to JSON format. This online parser allows you to upload resource fork files, experiment with different data type configurations, and download the parsed results as JSON or TypeScript interfaces.

## Purpose

This tool provides an accessible web interface for the rsrcdump TypeScript component, enabling users to:

- **Analyze Resource Fork Files**: Upload and inspect the structure of Mac resource fork files
- **Experiment with Data Types**: Configure and test different struct specifications for four-letter resource codes  
- **Validate Parsing**: Get real-time feedback on parsing success with sample data preview
- **Export Results**: Download parsed data as JSON or TypeScript interface files
- **Learn Resource Structure**: Understand how different data types affect parsing outcomes

The parser is particularly useful for reverse engineering game assets, examining legacy Mac application resources, and educational purposes in understanding binary file formats.

## Features

- **File Upload & Processing**: Upload .rsrc files and convert them to JSON
- **Advanced Array Support**: Configure complex array fields with multiple backtick-separated field names (e.g., `x`y[100]`)
- **Custom Struct Specs**: Define custom struct specifications for resource types using Python format characters
- **Real-time Validation**: Instant feedback on struct spec validity with status indicators and sample data
- **Sample File Testing**: Includes EarthFarm.ter.rsrc for testing and demonstration
- **CI/CD Deployment**: Automated GitHub Pages deployment with proper base path configuration
- **Toast Notifications**: User-friendly feedback system for all operations
- **TypeScript Generation**: Download TypeScript interface definitions from parsed data
- **Dark Theme**: Professional dark interface with proper contrast and modern styling

## How to Use

### 1. Load a Resource Fork File
- Click "Choose .rsrc File" and select a resource fork file
- Or click "Load EarthFarm Sample" to test with the included sample file
- The application will automatically extract all four-letter codes found in the file

### 2. Configure Data Types
- Each four-letter code will appear with default struct specifications
- Modify data types, field names, and array configurations as needed
- Use "Add Field" to add simple fields or "Add Array Field" for complex array structures
- Configure array fields with multiple field names separated by backticks
- Enable "Auto Padding" to automatically insert padding bytes
- Mark specifications as "Is Array" for repeated structures

### 3. Monitor Real-time Feedback
- Status indicators show parsing success (✓), errors (✗), or warnings (⚠)
- Sample data preview shows the actual parsed JSON structure
- Error messages provide specific guidance on parsing issues

### 4. Export Results
- Click "Download as JSON" to save the parsed data
- Click "Download TypeScript Interfaces" to generate type definitions
- Use "Save Specifications" to export your struct configurations

## Array Field Configuration

The parser supports complex array field specifications using backtick-separated field names:

```
x`y[100]  // Creates x_0, y_0, x_1, y_1, ... x_99, y_99
type`flags`height[50]  // Creates type_0, flags_0, height_0, type_1, flags_1, height_1, ...
```

This allows you to define multiple related fields that repeat together as a group, similar to C struct arrays.

## Struct Format Characters

| Character | Description | Size |
|-----------|-------------|------|
| `L` | Unsigned long | 4 bytes |
| `l` | Signed long | 4 bytes |
| `i` | Signed int | 4 bytes |
| `h` | Signed short | 2 bytes |
| `H` | Unsigned short | 2 bytes |
| `f` | Float | 4 bytes |
| `B` | Unsigned byte | 1 byte |
| `b` | Signed byte | 1 byte |
| `x` | Padding byte | 1 byte |
| `s` | String | Variable |
| `p` | Pascal string | Variable |
| `+` | Array indicator | - |

### Examples
- `L5i3f` - Long + 5 integers + 3 floats
- `H2x` - Short + 2 padding bytes  
- `200f` - Array of 200 floats

## Development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
# Clone the repository with submodules
git clone --recurse-submodules https://github.com/LachlanBWWright/mac-online-resource-fork-parser.git

# Or if you've already cloned it, initialize the submodules
git submodule init && git submodule update

# Install dependencies
npm install

# Start development server
npm run dev
```

### Testing
The application includes comprehensive Playwright tests:

```bash
npm run test
npm run test:unit
```

### Building
```bash
npm run build
```

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Parser**: rsrcdump TypeScript component (submodule)
- **Styling**: Tailwind CSS with shadcn/ui components
- **Testing**: Playwright for end-to-end testing, Vitest for unit tests
- **Deployment**: GitHub Actions with automated GitHub Pages deployment

## File Structure

```
src/
├── components/
│   ├── ResourceForkParser.tsx    # Main UI component
│   └── ui/                       # shadcn/ui components
├── lib/
│   └── toast.ts                  # Toast notification system
└── exten/
    └── rsrcdump/                 # Parser library (submodule)
public/
└── test-files/
    └── EarthFarm.ter.rsrc       # Sample file for testing
tests/
├── screenshots/                 # Test screenshots
└── *.spec.ts                   # Test files
```

## Otto Matic Support

The application includes built-in support for Otto Matic terrain file specifications, including:
- Header structures (Hedr)
- Tile attributes (Atrb) 
- Supertile grids (STgd)
- Map layers (Layr)
- Height coordinates (YCrd)
- Items, splines, fences, and liquids

## License

See the rsrcdump submodule for licensing information.

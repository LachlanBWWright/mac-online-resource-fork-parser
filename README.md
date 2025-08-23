# Mac Resource Fork Parser - Online Tool

A web-based tool for parsing Mac resource fork files (.rsrc) to JSON and vice versa, built using the rsrcdump TypeScript component.

## Features

- **File Upload & Processing**: Upload .rsrc files and convert them to JSON
- **Reverse Conversion**: Upload JSON files and convert them back to .rsrc
- **Custom Struct Specs**: Define custom struct specifications for resource types
- **Otto Matic Integration**: Built-in support for Otto Matic terrain file specs
- **Sample File Testing**: Includes EarthFarm.ter.rsrc for testing
- **Real-time Validation**: Instant feedback on struct spec validity
- **Download Support**: Download parsed JSON and converted .rsrc files

## How to Use

### 1. Load a Resource Fork File
- Click "Upload Resource Fork File" and select a .rsrc file
- Or click "Load Sample File" to test with the included EarthFarm.ter.rsrc

### 2. Customize Struct Specs (Optional)
- Add custom specifications for four-letter resource type codes
- Use Python struct format characters (L, i, h, H, f, B, x, etc.)
- Enable/disable Otto Matic default specs as needed

### 3. Parse and Download
- File is automatically parsed when uploaded
- Click "Download JSON" to save the parsed data
- Upload JSON files to convert back to .rsrc format

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
npm install
npm run dev
```

### Testing
The application includes Playwright tests that demonstrate functionality:

```bash
npm run test
```

Screenshots are automatically generated in `tests/screenshots/` showing:
- Initial application load
- UI sections and components
- Custom spec management
- Sample file parsing
- JSON download functionality
- Validation feedback

### Building
```bash
npm run build
```

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Parser**: rsrcdump TypeScript component (submodule)
- **Styling**: Custom CSS (Tailwind-inspired classes)
- **Testing**: Playwright for end-to-end testing

## File Structure

```
src/
├── components/
│   └── ResourceForkParser.tsx    # Main UI component
├── lib/
│   └── rsrcdump/                 # Parser library (copied from submodule)
│       ├── rsrcdump.ts          # Main API
│       ├── ottoSpecs.ts         # Otto Matic specifications
│       └── ...                  # Supporting modules
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

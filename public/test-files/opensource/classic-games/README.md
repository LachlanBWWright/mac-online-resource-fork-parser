# Classic open-source Mac game resource forks

These fixtures are raw resource forks extracted from files distributed by open-source Classic Mac game projects:

- `glider-pro-empty-house.rsrc` comes from the `Empty House.binhex` house file in [SoftDorothy/GliderPRO](https://github.com/softdorothy/GliderPRO), which is GPLv2-licensed. The BinHex wrapper and its two-byte resource-fork framing were removed while preserving the resource map and payload.
- `pararena2-para-sounds.rsrc` comes from the `Para Sounds.bin` MacBinary file in [SoftDorothy/Pararena2](https://github.com/softdorothy/Pararena2), which is MIT-licensed. The MacBinary header and data fork were removed, leaving the embedded resource fork.

The files are retained as small, inspectable fixtures for the parser and UI. Refer to the upstream repositories for the complete projects and their license terms.

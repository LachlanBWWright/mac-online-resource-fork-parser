# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]: "[plugin:vite:import-analysis]"
    - generic [ref=e6]: Failed to resolve import "../exten/rsrcdump/rsrcdump-ts/src/rsrcdump" from "src/components/ResourceForkParser.tsx". Does the file exist?
  - generic [ref=e8] [cursor=pointer]: /home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/src/components/ResourceForkParser.tsx:5:7
  - generic [ref=e9]: "21 | var _s = $RefreshSig$(); 22 | import React, { useState, useCallback, useRef } from \"react\"; 23 | import { saveToJson, saveFromJson } from \"../exten/rsrcdump/rsrcdump-ts/src/rsrcdump\"; | ^ 24 | import { ottoMaticSpecs } from \"../exten/rsrcdump/ottoSpecs\"; 25 | import { Card, CardContent, CardDescription, CardHeader, CardTitle } from \"./ui/card\";"
  - generic [ref=e10]:
    - text: at TransformPluginContext._formatLog (
    - generic [ref=e11] [cursor=pointer]: file:///home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/node_modules/vite/dist/node/chunks/dep-Bj7gA1-0.js:31422:43
    - text: ) at TransformPluginContext.error (
    - generic [ref=e12] [cursor=pointer]: file:///home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/node_modules/vite/dist/node/chunks/dep-Bj7gA1-0.js:31419:14
    - text: ) at normalizeUrl (
    - generic [ref=e13] [cursor=pointer]: file:///home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/node_modules/vite/dist/node/chunks/dep-Bj7gA1-0.js:29891:18
    - text: ) at async
    - generic [ref=e14] [cursor=pointer]: file:///home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/node_modules/vite/dist/node/chunks/dep-Bj7gA1-0.js:29949:32
    - text: at async Promise.all (index 4) at async TransformPluginContext.transform (
    - generic [ref=e15] [cursor=pointer]: file:///home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/node_modules/vite/dist/node/chunks/dep-Bj7gA1-0.js:29917:4
    - text: ) at async EnvironmentPluginContainer.transform (
    - generic [ref=e16] [cursor=pointer]: file:///home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/node_modules/vite/dist/node/chunks/dep-Bj7gA1-0.js:31220:14
    - text: ) at async loadAndTransform (
    - generic [ref=e17] [cursor=pointer]: file:///home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/node_modules/vite/dist/node/chunks/dep-Bj7gA1-0.js:26307:26
    - text: ) at async viteTransformMiddleware (
    - generic [ref=e18] [cursor=pointer]: file:///home/runner/work/mac-online-resource-fork-parser/mac-online-resource-fork-parser/node_modules/vite/dist/node/chunks/dep-Bj7gA1-0.js:27392:20
    - text: )
  - generic [ref=e19]:
    - text: Click outside, press
    - generic [ref=e20]: Esc
    - text: key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e21]: server.hmr.overlay
    - text: to
    - code [ref=e22]: "false"
    - text: in
    - code [ref=e23]: vite.config.ts
    - text: .
```
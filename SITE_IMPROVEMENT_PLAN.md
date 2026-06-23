# Site Improvement Plan

## Objective

Make the app useful for two connected workflows:

1. Let people iteratively edit resource `specs` until the parsed output reveals the underlying binary data structures.
2. Let people who already understand those structures safely edit parsed resource data and pack it back into `.rsrc` files.

The current app has the right primitives: file upload, spec loading/saving, live reparsing, an undefined-struct editor, a data browser, JSON export, TypeScript export, and `.rsrc` packing. The next step is to make those primitives feel like one guided reverse-engineering and editing environment instead of separate panels.

## Current State

- `ResourceForkParser.tsx` owns the workflow, uploaded file, parsed JSON, `FourLetterCodeSpec[]`, live reparsing, spec import/export, JSON export, and `.rsrc` packing.
- `FourLetterCodeSpecification.tsx` renders one four-character resource type and switches undefined default specs into `UndefinedStructEditor`.
- `UndefinedStructEditor.tsx` shows raw size, possible record sizes, hex/ASCII previews, suggested padding, and a simple field list for first-time struct definition.
- `DataBrowser.tsx` lets users browse parsed objects and edit scalar/object/array values, then calls back into `ResourceForkParser` to mark the parsed data dirty.
- `rsrcdump-ts` can unpack and pack struct templates, but the current UI does not expose enough byte offsets, validation, or packing preview to make structural edits trustworthy.

## Main Problems To Solve

- Specs are edited as fields, but users cannot easily see which bytes each field consumes.
- The undefined-struct flow suggests record sizes, but does not provide enough tools to compare candidate interpretations against actual bytes and parsed values.
- Spec edits and data edits are separated by tabs, so users do not get a tight feedback loop between "change spec" and "inspect parsed resources".
- Imported specs preserve `rawOttoSpec`, which can cause later UI edits to be ignored during parsing and packing unless that raw spec is invalidated or regenerated.
- `autoPadding` exists in UI state but does not appear to affect generated specs.
- Data edits are type-aware at the JSON level, but not range-aware for the backing struct type. For example, editing a `B` field should validate `0..255`, while `h` should validate signed 16-bit range.
- Packing can fail late. Users need preflight validation before downloading an edited `.rsrc`.
- There is no durable project/session format that keeps the original file, current specs, parsed edits, notes, and confidence state together.

## Product Direction

### 1. Add A Workbench Layout

Replace the current mostly vertical "Struct Specs" and "Browse Data" split with a workbench for a selected four-character code.

- Left rail: resource types with status, byte size, resource count, spec confidence, dirty state, and search/filter.
- Center panel: selected spec editor with byte offsets, field rows, and validation.
- Right panel: live parsed preview for the selected resource type, including a selectable resource ID.
- Bottom or side drawer: raw byte inspector with synchronized field highlighting.

This makes the core loop visible: select type, inspect bytes, edit spec, inspect parsed values, repeat.

### 2. Build A Byte-Aware Spec Editor

Upgrade spec editing from "type/count/description rows" to a byte-layout editor.

- Show each field's offset, byte length, type, count, field name, and computed end offset.
- Highlight gaps, overflows, and padding explicitly.
- Show record length for non-array structs and list record count for array/list specs.
- Allow fields to be reordered with stable offsets recalculated immediately.
- Add quick field actions: split count, merge adjacent same-type fields, convert to padding, duplicate field, insert before/after.
- Regenerate the canonical spec string from structured rows and show it in a read-only preview.
- When users manually edit the raw spec string, parse it back into structured rows and display parse errors inline.

Implementation note: centralize spec parsing/generation in one tested module instead of duplicating logic in `ResourceForkParser.tsx`, `UndefinedStructEditor.tsx`, and save/load handlers.

### 3. Make Struct Discovery More Intuitive

Turn `UndefinedStructEditor` into a hypothesis builder.

- Keep the current size/divisor hints, but add candidate interpretations:
  - all bytes
  - signed/unsigned 16-bit grid
  - signed/unsigned 32-bit fields
  - float fields
  - common coordinate pairs/triples
  - fixed-size records for every divisor
- For each candidate, show a small parsed preview and "Use as starting spec".
- Add a byte histogram and printable ASCII preview to reveal text-like resources.
- Add endian visibility, even if big-endian remains the default.
- Let users select a byte range and define it as a field.
- Let users pin notes per field and per resource type, such as "looks like x coordinate" or "unknown flags".
- Add confidence states: unknown, hypothesis, verified.

### 4. Connect Specs And Parsed Data

Make every parsed value traceable back to the spec and byte range that produced it.

- In parsed previews, show field type and byte offset on hover/focus.
- Clicking a parsed field should select the corresponding spec row and byte range.
- Clicking a spec row should highlight its parsed value for the current resource.
- Show before/after parsed previews when editing a spec.
- Preserve raw fallback data for resources that fail conversion so users can continue investigation.

### 5. Make File Editing Safe For Known Structures

Improve `DataBrowser` from generic JSON editing into struct-aware editing.

- Validate edited values against their struct type:
  - `B`: `0..255`
  - `b`: `-128..127`
  - `H`: `0..65535`
  - `h`: `-32768..32767`
  - `I`/`L`: unsigned 32-bit
  - `i`/`l`: signed 32-bit
  - `f`: finite numeric value
  - `?`: boolean
  - fixed strings: encoded byte length must fit
- Use appropriate controls where possible: boolean toggle, numeric input with min/max, string input with byte-length counter.
- Show the original value, edited value, and dirty marker per field.
- Add revert field, revert resource, and revert all edits.
- Add a pack preflight button that validates every dirty field before producing a file.
- Show binary size stability: "packed data length matches original" or exact changed length.

### 6. Fix Spec Source Of Truth

Remove ambiguity between `rawOttoSpec` and structured fields.

- Track spec origin separately: generated, imported, built-in sample, user-edited.
- Once a user edits any field, regenerate the raw spec string from the structured model and stop using stale `rawOttoSpec`.
- Save specs from the canonical structured model.
- Load specs into the same model used by the editor.
- Add unit tests for spec parse/generate round trips, including padding, arrays, booleans, strings, list specs with `+`, and numbered Otto-style lines.

### 7. Add Project Persistence

Specs alone are not enough for real reverse engineering sessions.

Create a project export/import format, likely JSON:

```json
{
  "version": 1,
  "sourceFileName": "EarthFarm.ter.rsrc",
  "sourceFileHash": "...",
  "specs": [],
  "edits": {},
  "notes": {},
  "selectedResourceHints": {}
}
```

Do not embed the `.rsrc` bytes initially unless there is a clear UX need. Hashing the source file is enough to warn users if they reopen a project against a different file.

### 8. Improve Validation And Error Reporting

Make parser feedback actionable.

- Show conversion errors beside the affected type/resource, not only as global errors.
- For length mismatch errors, show expected length, actual length, record length, and nearest valid padding or array/list choice.
- For packing errors, identify the exact resource and field when possible.
- Distinguish spec syntax errors, layout errors, parse errors, and pack errors.
- Keep a compact status summary: total resource types, valid specs, warnings, errors, dirty edited resources.

## Implementation Phases

### Phase 1: Stabilize Spec Modeling

- Extract spec parsing, generation, byte-size calculation, field-name expansion, and validation into `src/components/resource-fork-parser/spec-model.ts`.
- Add tests for existing supported syntax before changing behavior.
- Ensure UI edits invalidate `rawOttoSpec` or regenerate it.
- Implement `autoPadding` or remove it until implemented.
- Add canonical spec preview to every spec editor.

Deliverable: spec import, editing, save, parse, and pack all use one source of truth.

### Phase 2: Byte Layout Feedback

- Add offset and byte-size columns to field rows.
- Add record-length and array/list validation summaries.
- Add raw byte highlighting for selected fields.
- Improve undefined structs with candidate layouts and "use as starting spec".

Deliverable: users can reason visually about which bytes a spec covers.

### Phase 3: Integrated Workbench

- Add selected resource type and selected resource ID state.
- Replace the full-page list of spec sections with a selectable workbench.
- Show spec editor and parsed preview together.
- Add synchronized selection between spec fields, parsed values, and byte ranges.

Deliverable: the reverse-engineering loop is visible without tab switching.

### Phase 4: Struct-Aware Data Editing

- Pass field metadata from specs into `DataBrowser`.
- Add range validation, byte-length validation, dirty markers, and revert controls.
- Add pack preflight with a clear result panel.
- Add before/after value display for edited resources.

Deliverable: users who know the structure can edit resources confidently and pack valid `.rsrc` output.

### Phase 5: Session Persistence And Polish

- Add project export/import.
- Add notes and confidence labels.
- Add keyboard shortcuts for common spec editing actions.
- Add focused Playwright coverage for discovery, edit, save specs, edit data, preflight, and pack flows.

Deliverable: users can return to long-running reverse-engineering work and share progress.

## Testing Plan

- Unit tests:
  - spec parse/generate round trips
  - byte-size and offset calculations
  - array/list field expansion
  - numeric range validation
  - JSON/project import/export validation
- Integration tests:
  - load EarthFarm with specs, edit a spec, verify parsed preview changes
  - load EarthFarm without specs, create a candidate struct, save specs, reload specs
  - edit typed data, run pack preflight, pack `.rsrc`
  - verify stale imported raw specs do not override user-edited structured specs
- Visual/UI tests:
  - desktop and narrow viewport workbench layout
  - no text overlap in field rows, byte inspector, and parsed preview

## Early Wins

These should be done first because they reduce confusion quickly:

1. Show the canonical generated spec string beside each editor.
2. Display field offsets and total bytes covered.
3. Fix `rawOttoSpec` overriding later UI edits.
4. Add numeric range validation before packing.
5. Add "revert edited value" in the data browser.

## Open Questions

- Should the app support editing resource metadata such as name, flags, order, and IDs, or only resource payload data?
- Should project files eventually embed source `.rsrc` bytes for portability?
- Should unknown bytes preserve original values during packing instead of writing zero padding?
- Should users be able to define nested structures, or is flat struct syntax enough for the intended resource files?
- Should the parser support little-endian specs explicitly, or keep all current behavior big-endian?

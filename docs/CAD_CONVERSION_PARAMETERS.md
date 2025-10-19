# CAD Conversion Parameter Mapping

## Overview
This document maps the desired CAD conversion features to CloudConvert API parameters for DWG/DXF to PDF conversion.

## CloudConvert CAD Conversion Capabilities

### Supported Input Formats
- `.dwg` (AutoCAD Drawing)
- `.dxf` (Drawing Exchange Format)
- `.step/.stp` (Standard for Exchange of Product Data)
- `.iges/.igs` (Initial Graphics Exchange Specification)

### Engine Options
- `autocad` - Recommended for DWG/DXF files
- `libreofficedraw` - Alternative engine
- `aspose-cad` - Third-party engine with advanced options

## Parameter Mapping

### Layout Selection
**UI Option**: Layout dropdown (Model Space, Layout1, Layout2, etc.)
**CloudConvert Parameter**: `layout`
- **Type**: `string`
- **Values**: 
  - `null` or omitted - Uses default (typically Model Space)
  - `"Model"` - Model Space
  - `"Layout1"`, `"Layout2"`, etc. - Specific layouts
- **Engine Support**: `autocad`, `aspose-cad`
- **Status**: ✅ Supported

### Plot Style Table (CTB)
**UI Option**: CTB file selection
**CloudConvert Parameter**: Multiple approach needed
- **Method 1**: Additional input file + `plot_style_table` reference
- **Method 2**: `converteroptions.plot_style_table` with file reference
- **Type**: Reference to imported CTB file
- **Engine Support**: `autocad` (primary), `aspose-cad` (limited)
- **Status**: ✅ Supported (requires multi-input job)

### Scaling and Positioning

#### Fit to Page
**UI Option**: "Fit to page" radio button
**CloudConvert Parameter**: `fit_to_page`
- **Type**: `boolean`
- **Default**: `false`
- **Status**: ✅ Supported

#### Custom Scale
**UI Option**: Custom scale input (1:n)
**CloudConvert Parameter**: `scale`
- **Type**: `string`
- **Format**: `"1:100"`, `"1:50"`, etc.
- **Status**: ✅ Supported

#### Plot Area
**UI Option**: Plot area dropdown
**CloudConvert Parameters**: `plot_area`
- **Type**: `string`
- **Values**:
  - `"extents"` - Drawing extents (default)
  - `"display"` - Current display
  - `"limits"` - Drawing limits
  - `"window"` - Custom window (requires window coordinates)
- **Status**: ✅ Supported

#### Window Coordinates
**UI Option**: Window coordinate inputs (if plot_area = "window")
**CloudConvert Parameter**: `window`
- **Type**: `object`
- **Format**: `{ "x1": number, "y1": number, "x2": number, "y2": number }`
- **Status**: ✅ Supported

#### Center Drawing
**UI Option**: "Center drawing" checkbox
**CloudConvert Parameter**: `center`
- **Type**: `boolean`
- **Default**: `true`
- **Status**: ✅ Supported

#### Keep Aspect Ratio
**UI Option**: "Keep aspect ratio" checkbox
**CloudConvert Parameter**: `keep_aspect_ratio`
- **Type**: `boolean`
- **Default**: `true`
- **Status**: ✅ Supported

### Paper Settings

#### Paper Size
**UI Option**: Paper size dropdown
**CloudConvert Parameter**: `paper_size`
- **Type**: `string`
- **Values**: `"Auto"`, `"A4"`, `"A3"`, `"A2"`, `"A1"`, `"A0"`, `"Letter"`, `"Legal"`, `"Tabloid"`, etc.
- **Status**: ✅ Supported

#### Orientation
**UI Option**: Orientation toggle
**CloudConvert Parameter**: `orientation`
- **Type**: `string`
- **Values**: `"portrait"`, `"landscape"`
- **Status**: ✅ Supported

#### Margins
**UI Option**: Margin inputs (mm)
**CloudConvert Parameter**: `margins`
- **Type**: `object`
- **Format**: `{ "top": number, "right": number, "bottom": number, "left": number }`
- **Unit**: millimeters
- **Status**: ✅ Supported

#### DPI
**UI Option**: DPI input
**CloudConvert Parameter**: `dpi`
- **Type**: `number`
- **Default**: `300`
- **Range**: `72-600`
- **Status**: ✅ Supported

## Job Structure Example

```typescript
const job = {
  tasks: {
    "import-cad": {
      operation: "import/url",
      url: cadFileUrl
    },
    "import-ctb": {  // Optional
      operation: "import/url", 
      url: ctbFileUrl
    },
    "convert": {
      operation: "convert",
      input: ["import-cad", "import-ctb"], // CTB is optional
      input_format: "dwg", // or "dxf"
      output_format: "pdf",
      engine: "autocad",
      converteroptions: {
        layout: "Layout1",
        plot_area: "extents",
        center: true,
        fit_to_page: false,
        scale: "1:100",
        keep_aspect_ratio: true,
        paper_size: "A3",
        orientation: "landscape",
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
        dpi: 300,
        plot_style_table: "import-ctb" // Reference to CTB import
      }
    },
    "export": {
      operation: "export/url",
      input: "convert"
    }
  }
}
```

## Layout Discovery Strategy

Since CloudConvert doesn't provide a direct "list layouts" API, we'll use these approaches:

### Method 1: Probe Conversion (Recommended)
- Create a lightweight conversion job with `list_layouts: true` option
- Parse the error message or metadata to extract layout names
- Cache results by file revision

### Method 2: Fallback - Default Layouts
- Provide common layout names: "Model", "Layout1", "Layout2", "Layout3"
- Allow manual text input for custom layout names

### Method 3: Alternative Provider
- If CloudConvert limitations are too restrictive, consider Aspose CAD Cloud API
- Aspose provides dedicated layout listing endpoints

## Limitations and Fallbacks

1. **Layout Discovery**: No direct API - using probe method
2. **CTB Validation**: Limited validation before conversion
3. **Window Coordinates**: Manual input required (no extents preview)
4. **Engine Differences**: Some options may not work with all engines

## Cost Implications

- Layout discovery probe: ~$0.001 per file (cached)
- CTB conversions: Same cost as regular conversions (~$0.008)
- No additional cost for parameter variations

## Implementation Notes

1. Always include error handling for unsupported parameter combinations
2. Provide fallback to basic `fit_to_page: true` if advanced options fail
3. Cache layout discovery results by file revision
4. Validate CTB file format before including in job
5. Show preview warnings for unsupported engine/parameter combinations
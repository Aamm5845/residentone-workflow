# CAD Preferences System

## Overview

The CAD Preferences System allows users to customize how CAD files (DWG, DXF, etc.) are converted to PDF in the spec book generation process. The system supports per-file preferences with project-level defaults and system-level fallbacks.

## Architecture

### Database Models

1. **CadPreferences** - Per-file conversion settings
2. **ProjectCadDefaults** - Project-level default settings  
3. **CadLayoutCache** - Cached layout discovery results

### Preference Resolution Hierarchy

When converting a CAD file, preferences are resolved in this order:

1. **Per-File Preferences** - Specific settings for this file
2. **Project Defaults** - Default settings for all files in this project
3. **System Defaults** - Hard-coded fallback values

### Key Features

- **Layout Selection** - Choose Model Space, Layout1, Layout2, etc.
- **CTB Plot Styles** - Use color table files for line weights and colors
- **Scaling Options** - Fit to page or custom scale (1:n)
- **Plot Area** - Extents, display, limits, or custom window
- **Paper Settings** - Size, orientation, margins, DPI
- **Positioning** - Center drawing, keep aspect ratio

## Database Schema

### CadPreferences Table

```sql
CREATE TABLE "CadPreferences" (
    "id" TEXT PRIMARY KEY,
    "linkedFileId" TEXT NOT NULL UNIQUE, -- References DropboxFileLink
    "projectId" TEXT NOT NULL,           -- References Project
    "layoutName" TEXT,                   -- Layout to plot (null = default)
    "ctbDropboxPath" TEXT,              -- Path to CTB file in Dropbox
    "ctbFileId" TEXT,                   -- Dropbox file ID for CTB
    "plotArea" TEXT DEFAULT 'extents',  -- extents|display|limits|window
    "window" JSONB,                     -- {x1,y1,x2,y2} if plotArea='window'
    "centerPlot" BOOLEAN DEFAULT true,
    "scaleMode" TEXT DEFAULT 'fit',     -- fit|custom
    "scaleDenominator" INTEGER,         -- For 1:n scale if scaleMode='custom'
    "keepAspectRatio" BOOLEAN DEFAULT true,
    "margins" JSONB DEFAULT '{"top":10,"right":10,"bottom":10,"left":10}',
    "paperSize" TEXT DEFAULT 'Auto',    -- A4|A3|Letter|etc
    "orientation" TEXT,                 -- portrait|landscape|null (auto)
    "dpi" INTEGER DEFAULT 300,
    "createdAt" TIMESTAMP DEFAULT now(),
    "updatedAt" TIMESTAMP DEFAULT now()
);
```

### ProjectCadDefaults Table

Same structure as CadPreferences but linked to Project instead of individual files.

### CadLayoutCache Table

```sql
CREATE TABLE "CadLayoutCache" (
    "id" TEXT PRIMARY KEY,
    "dropboxPath" TEXT NOT NULL,
    "dropboxRevision" TEXT NOT NULL,
    "layouts" JSONB NOT NULL,           -- Array of layout names
    "discoveredAt" TIMESTAMP DEFAULT now(),
    "expiresAt" TIMESTAMP DEFAULT (now() + INTERVAL '7 days'),
    UNIQUE("dropboxPath", "dropboxRevision")
);
```

## Default Values

### System Defaults (Hard-coded)

```typescript
const SYSTEM_DEFAULTS = {
  layoutName: null,        // Use first available layout
  ctbDropboxPath: null,    // No plot style table
  plotArea: 'extents',     // Plot drawing extents
  centerPlot: true,        // Center on page
  scaleMode: 'fit',        // Fit to page
  keepAspectRatio: true,   // Maintain proportions
  margins: { top: 10, right: 10, bottom: 10, left: 10 }, // 10mm margins
  paperSize: 'Auto',       // Auto-detect paper size
  orientation: null,       // Auto-detect orientation
  dpi: 300                 // Standard print DPI
}
```

### Preference Resolution Logic

```typescript
function getEffectivePreferences(linkedFileId: string): EffectiveCadPreferences {
  // 1. Try per-file preferences
  const filePrefs = await CadPreferences.findUnique({ 
    where: { linkedFileId } 
  })
  
  if (filePrefs) {
    return { ...filePrefs, source: 'file' }
  }
  
  // 2. Try project defaults
  const projectId = await getProjectIdForFile(linkedFileId)
  const projectDefaults = await ProjectCadDefaults.findUnique({ 
    where: { projectId } 
  })
  
  if (projectDefaults) {
    return { ...projectDefaults, source: 'project' }
  }
  
  // 3. Use system defaults
  return { ...SYSTEM_DEFAULTS, source: 'system' }
}
```

## Migration Strategy

### Backward Compatibility

- **Existing files** continue to work with system defaults
- **Legacy `fit_to_page: true`** behavior is preserved as default
- **No breaking changes** to existing spec book generation

### Data Migration

1. No automatic migration of existing files
2. Users opt-in by configuring preferences for specific files
3. Project defaults can be set to apply to all future files
4. Migration script available to bulk-apply settings if needed

### Feature Flag

Environment variable `ENABLE_CAD_PREFERENCES` allows gradual rollout:

```env
ENABLE_CAD_PREFERENCES=true   # Enable new system
ENABLE_CAD_PREFERENCES=false  # Use legacy behavior only
```

## API Endpoints

### Get Effective Preferences
```
GET /api/cad/preferences?fileId={linkedFileId}
```

Returns the effective preferences for a file (resolved from file > project > system).

### Update File Preferences
```
POST /api/cad/preferences
```

Create or update per-file preferences.

### Update Project Defaults
```
POST /api/cad/project-defaults
```

Set project-level default preferences.

### Discover Layouts
```
GET /api/cad/layouts?dropboxPath={path}
```

Get available layouts in a CAD file (cached for 7 days).

### Convert with Preferences
```
POST /api/cad/convert
```

Convert a CAD file using stored or provided preferences.

## CloudConvert Integration

### Job Structure

```javascript
const job = {
  tasks: {
    "import-cad": {
      operation: "import/url",
      url: cadFileSignedUrl
    },
    "import-ctb": {  // Optional - only if CTB selected
      operation: "import/url",
      url: ctbFileSignedUrl
    },
    "convert": {
      operation: "convert",
      input: ["import-cad", "import-ctb"], // CTB optional
      input_format: "dwg",
      output_format: "pdf",
      engine: "autocad",
      converteroptions: {
        layout: prefs.layoutName,
        plot_area: prefs.plotArea,
        window: prefs.window,
        center: prefs.centerPlot,
        fit_to_page: prefs.scaleMode === 'fit',
        scale: prefs.scaleMode === 'custom' ? `1:${prefs.scaleDenominator}` : undefined,
        keep_aspect_ratio: prefs.keepAspectRatio,
        margins: prefs.margins,
        paper_size: prefs.paperSize,
        orientation: prefs.orientation,
        dpi: prefs.dpi,
        plot_style_table: ctbSelected ? "import-ctb" : undefined
      }
    },
    "export": {
      operation: "export/url",
      input: "convert"
    }
  }
}
```

### Layout Discovery

Since CloudConvert doesn't provide direct layout listing, we use a probe approach:

1. Create a minimal conversion job with layout discovery enabled
2. Parse the result or error message for layout names
3. Cache results by file revision for 7 days
4. Fallback to common layouts if discovery fails

## UI Components

### SpecBookSettings Enhancement

Each linked CAD file gets an "Edit CAD Options" button that opens a comprehensive dialog with:

- **Layout Selection** - Dropdown with discovered layouts
- **Plot Style** - CTB file selection from Dropbox
- **Scaling** - Fit to page vs custom scale ratio
- **Plot Area** - What part of drawing to include
- **Positioning** - Center, aspect ratio options
- **Paper** - Size, orientation, margins, DPI

### DropboxFileBrowser Enhancement

- **CTB Mode** - Filter to only show .ctb files
- **File Metadata** - Include revision info for caching
- **Temporary Links** - Generate signed URLs for CloudConvert

## Performance Considerations

### Caching Strategy

1. **Layout Discovery** - Cache for 7 days per file revision
2. **CTB Files** - Cache signed URLs with short expiry
3. **Converted PDFs** - Cache by file revision + preferences hash

### Cost Optimization

1. **Layout Discovery** - Batch multiple file discoveries
2. **Incremental Updates** - Only convert changed files
3. **Preference Validation** - Client-side validation before API calls

## Error Handling

### Conversion Failures

1. **Invalid Layout** - Fall back to default layout
2. **Missing CTB** - Continue without plot style
3. **CloudConvert Errors** - Retry with simplified options
4. **Timeout** - Queue for later processing

### UI Error States

1. **Layout Discovery Failed** - Show manual input option
2. **CTB Not Found** - Show warning, allow proceeding
3. **Conversion Errors** - Display clear error messages with retry

## Testing Strategy

### Unit Tests

- Preference resolution logic
- CloudConvert job building
- Input validation

### Integration Tests

- API endpoints
- Database operations  
- CloudConvert integration

### Manual QA Scenarios

- Different file types and layouts
- CTB files with various styles
- Paper sizes and orientations
- Error conditions and fallbacks

## Rollout Plan

### Phase 1: Foundation
- Database schema and migrations
- API endpoints
- Basic UI integration

### Phase 2: Enhanced UI  
- Comprehensive preferences dialog
- Layout discovery
- CTB file selection

### Phase 3: Optimization
- Caching improvements
- Performance optimization
- Advanced error handling

### Phase 4: Full Release
- Documentation complete
- Training materials
- Gradual feature enablement
# CAD Version Tracking Plan — Project Files V2

## Problem Statement

A single CAD file (e.g., `E-101.dwg`) contains multiple layouts (Electrical Plan, Plumbing Plan, RCP, etc.). Each layout gets plotted as a separate PDF and tracked as its own `ProjectDrawing` with revisions.

When the CAD file is saved in Dropbox, the Dropbox revision changes for the **entire file** — even if only one layout was modified. We need a system that:

1. Records **which CAD file + Dropbox revision** a PDF was plotted from
2. Detects when the source CAD file has changed since the last plot
3. Flags all drawings from that file as "possibly stale"
4. Lets the user dismiss false positives per-drawing (e.g., "I only changed electrical, plumbing is fine")
5. Lets the user mark a drawing as needing re-plot

---

## Existing Architecture (What We Have)

### Models Already In Place

- **ProjectDrawing** — has `dropboxPath` (optional), `currentRevision`, links to `DrawingRevision[]`
- **DrawingRevision** — has `dropboxPath`, `dropboxUrl`, `fileName`, `revisionNumber`, `issuedDate`
- **CadLayoutCache** — tracks `dropboxPath` + `dropboxRevision` + `layouts[]` (7-day cache)
- **DropboxFileLink** — has `dropboxRevision`, `lastModified`, used for spec book and checklist items

### Services Already In Place

- **DropboxServiceV2** — has `getFileMetadata(path)` returning revision, `checkFileUpdated(path, lastKnownRevision)` returning boolean
- **EnhancedCADConversionService** — handles layout discovery and CAD-to-PDF conversion

### What's Missing

- No link between a **plotted PDF** (DrawingRevision) and the **source CAD file's state** at time of plotting
- No mechanism to compare current CAD state vs. when the PDF was plotted
- No status/flag system for "CAD modified since last plot"
- No dismiss/acknowledge workflow for layout-level false positives

---

## Data Model Changes

### 1. New Model: `CadSourceLink`

This is the core new model. It connects a `ProjectDrawing` to its source CAD file and tracks the CAD file's revision at the time of the last plot.

```prisma
model CadSourceLink {
  id                String   @id @default(cuid())

  // Which drawing this link belongs to
  drawingId         String   @unique
  drawing           ProjectDrawing @relation(fields: [drawingId], references: [id])

  // Source CAD file info
  cadDropboxPath    String              // e.g., "/Projects/123/E-101.dwg"
  cadLayoutName     String?             // e.g., "E-101 Electrical Plan" (optional, for reference)

  // Snapshot of CAD file state when last PDF was plotted
  plottedFromRevision   String?         // Dropbox rev ID at time of last plot
  plottedAt             DateTime?       // When the last plot happened

  // Freshness status
  cadFreshnessStatus    CadFreshnessStatus @default(UNKNOWN)
  statusDismissedAt     DateTime?       // When user dismissed a MODIFIED warning
  statusDismissedBy     String?         // User who dismissed

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([cadDropboxPath])
  @@index([cadFreshnessStatus])
  @@index([drawingId])
}
```

### 2. New Enum: `CadFreshnessStatus`

```prisma
enum CadFreshnessStatus {
  UP_TO_DATE       // CAD file hasn't changed since last plot
  CAD_MODIFIED     // CAD file has changed — PDF may be stale
  DISMISSED        // User confirmed the change doesn't affect this drawing
  NEEDS_REPLOT     // User confirmed this drawing needs a new PDF
  UNKNOWN          // No tracking data yet (initial state)
}
```

### 3. Add Relation to ProjectDrawing

Add to the existing `ProjectDrawing` model:

```prisma
model ProjectDrawing {
  // ... existing fields ...
  cadSourceLink     CadSourceLink?    // Optional 1:1 relation
}
```

### 4. Add Source Tracking Fields to DrawingRevision

Add to the existing `DrawingRevision` model to record what CAD state each revision was plotted from:

```prisma
model DrawingRevision {
  // ... existing fields ...
  sourceCadPath         String?       // CAD file this PDF was plotted from
  sourceCadRevision     String?       // Dropbox rev of CAD file at plot time
}
```

---

## API Endpoints

### 1. Link a Drawing to its Source CAD File

**POST** `/api/projects/[id]/project-files-v2/drawings/[drawingId]/cad-source`

```json
// Request
{
  "cadDropboxPath": "/Projects/123/E-101.dwg",
  "cadLayoutName": "E-101 Electrical Plan"    // optional
}

// Response
{
  "id": "clxxx...",
  "drawingId": "clyyy...",
  "cadDropboxPath": "/Projects/123/E-101.dwg",
  "cadLayoutName": "E-101 Electrical Plan",
  "cadFreshnessStatus": "UNKNOWN",
  "plottedFromRevision": null,
  "plottedAt": null
}
```

**Logic:**
- Creates or updates the `CadSourceLink` for this drawing
- If the drawing already has a link, update it (upsert)
- On create, status starts as `UNKNOWN`

### 2. Record a Plot (Mark as Freshly Plotted)

**POST** `/api/projects/[id]/project-files-v2/drawings/[drawingId]/cad-source/mark-plotted`

```json
// Request
{
  "cadRevision": "abc123def"    // Optional — if omitted, API fetches current revision from Dropbox
}

// Response
{
  "cadFreshnessStatus": "UP_TO_DATE",
  "plottedFromRevision": "abc123def",
  "plottedAt": "2026-02-19T..."
}
```

**Logic:**
- Fetch current Dropbox revision for the CAD file (if not provided)
- Update `CadSourceLink`: set `plottedFromRevision`, `plottedAt`, status = `UP_TO_DATE`
- Clear any `statusDismissedAt` / `statusDismissedBy`
- Also store `sourceCadRevision` on the new `DrawingRevision` if one is being created

### 3. Check Freshness for a Project

**GET** `/api/projects/[id]/project-files-v2/cad-freshness`

```json
// Response
{
  "checkedAt": "2026-02-19T...",
  "cadFiles": [
    {
      "cadDropboxPath": "/Projects/123/E-101.dwg",
      "currentRevision": "xyz789",
      "drawings": [
        {
          "drawingId": "cl1...",
          "drawingNumber": "E-101",
          "title": "Electrical Plan",
          "cadLayoutName": "E-101 Electrical Plan",
          "plottedFromRevision": "abc123",
          "cadFreshnessStatus": "CAD_MODIFIED",
          "plottedAt": "2026-02-15T..."
        },
        {
          "drawingId": "cl2...",
          "drawingNumber": "P-101",
          "title": "Plumbing Plan",
          "cadLayoutName": "P-101 Plumbing Plan",
          "plottedFromRevision": "abc123",
          "cadFreshnessStatus": "CAD_MODIFIED",
          "plottedAt": "2026-02-15T..."
        }
      ]
    }
  ],
  "summary": {
    "total": 10,
    "upToDate": 6,
    "cadModified": 3,
    "dismissed": 1,
    "needsReplot": 0,
    "unknown": 0
  }
}
```

**Logic:**
1. Find all `CadSourceLink` records for this project (via drawing → project)
2. Group by `cadDropboxPath` (so we only check each CAD file once)
3. For each unique CAD file, call `dropboxService.getFileMetadata(path)` to get current revision
4. Compare current revision against each drawing's `plottedFromRevision`
5. If different and status was `UP_TO_DATE` → update to `CAD_MODIFIED`
6. If different and status was `DISMISSED` → leave as `DISMISSED` (user already acknowledged)
7. If same → ensure status is `UP_TO_DATE`
8. Return grouped results with summary counts

### 4. Dismiss a Warning (Per Drawing)

**POST** `/api/projects/[id]/project-files-v2/drawings/[drawingId]/cad-source/dismiss`

```json
// Request — no body needed

// Response
{
  "cadFreshnessStatus": "DISMISSED",
  "statusDismissedAt": "2026-02-19T...",
  "statusDismissedBy": "user_123"
}
```

**Logic:**
- Set status = `DISMISSED`, record who and when
- This means: "Yes the CAD file changed, but this layout wasn't affected"

### 5. Mark as Needs Re-plot (Per Drawing)

**POST** `/api/projects/[id]/project-files-v2/drawings/[drawingId]/cad-source/needs-replot`

```json
// Response
{
  "cadFreshnessStatus": "NEEDS_REPLOT"
}
```

**Logic:**
- Set status = `NEEDS_REPLOT`
- This means: "This drawing's PDF is outdated and needs to be re-plotted"

### 6. Bulk Link Drawings to CAD Files (Auto-match)

**POST** `/api/projects/[id]/project-files-v2/cad-source/auto-link`

```json
// Request
{
  "cadDropboxPath": "/Projects/123/E-101.dwg",
  "mappings": [
    { "drawingId": "cl1...", "layoutName": "E-101 Electrical Plan" },
    { "drawingId": "cl2...", "layoutName": "P-101 Plumbing Plan" }
  ]
}

// Response
{
  "linked": 2,
  "links": [ ... ]
}
```

**Logic:**
- Creates `CadSourceLink` records for multiple drawings at once
- All from the same CAD file
- Useful when user first sets up the link between a DWG and its drawings

---

## Workflow Integration

### When User Creates a New Drawing Revision (Plots a PDF)

Modify the existing **POST /revisions** endpoint:

1. Accept optional new fields: `sourceCadPath`, `sourceCadRevision`
2. If `sourceCadPath` is provided, store it on the `DrawingRevision`
3. If the drawing has a `CadSourceLink`, auto-update it:
   - Set `plottedFromRevision` = current CAD revision
   - Set `plottedAt` = now
   - Set `cadFreshnessStatus` = `UP_TO_DATE`

### When User Opens Project Files Page

The frontend should call **GET /cad-freshness** to get the current status of all drawings. This:

1. Checks each linked CAD file against Dropbox
2. Updates statuses in the database
3. Returns the results for display

**Caching consideration:** Don't call Dropbox on every page load. Cache the freshness check for ~5 minutes. Add a "Refresh" button for manual re-check.

### When CAD File Changes Are Detected

The freshness check shows banners/badges next to affected drawings:

```
┌─────────────────────────────────────────────────┐
│ E-101 Electrical Plan          Rev B (Feb 15)   │
│ ⚠️ Source CAD file modified since last plot       │
│ [Still Valid]  [Needs Re-plot]                   │
├─────────────────────────────────────────────────┤
│ P-101 Plumbing Plan            Rev A (Feb 10)   │
│ ⚠️ Source CAD file modified since last plot       │
│ [Still Valid]  [Needs Re-plot]                   │
├─────────────────────────────────────────────────┤
│ RCP-101 Reflected Ceiling      Rev C (Feb 18)   │
│ ✓ Up to date                                    │
└─────────────────────────────────────────────────┘
```

### When User Sends a Transmittal

At transmittal creation time, check the freshness status of included drawings:

- If any drawing has status `CAD_MODIFIED` or `NEEDS_REPLOT`:
  - Show a warning: "The following drawings may have outdated PDFs:"
  - List the affected drawings
  - Options: "Send Anyway" / "Cancel and Re-plot"
- If status is `DISMISSED` or `UP_TO_DATE`: proceed normally

---

## UI Components Needed

### 1. Freshness Badge Component

Small inline badge shown next to each drawing in the register:

| Status | Badge | Color |
|--------|-------|-------|
| UP_TO_DATE | "Current" or checkmark | Green |
| CAD_MODIFIED | "CAD Modified" | Amber/Yellow |
| DISMISSED | "Reviewed" | Gray |
| NEEDS_REPLOT | "Needs Re-plot" | Red |
| UNKNOWN | "Not Tracked" | Gray dashed |

### 2. CAD Source Link Setup

When adding or editing a drawing, a section to:
- Browse/search for the source CAD file in Dropbox
- Select which layout in the CAD file corresponds to this drawing
- Uses existing Dropbox file browser + layout discovery

### 3. Freshness Dashboard Widget

A summary card on the project files page:
- "3 of 10 drawings may need re-plotting"
- Quick action to review all flagged drawings

### 4. Transmittal Warning Dialog

Modal when creating a transmittal with stale drawings:
- Lists affected drawings with their status
- "Send Anyway" vs "Go Back"

---

## Auto-Linking Strategy

To reduce manual setup, attempt to auto-match drawings to CAD files:

1. When a drawing's `dropboxPath` ends in `.dwg` → that's the CAD source
2. When a drawing's `dropboxPath` ends in `.pdf` → look for a `.dwg` file with matching name in the same folder
3. Use `CadLayoutCache` to match layout names to drawing numbers
4. Propose matches to user for confirmation

Example:
```
Found: /Projects/123/E-101.dwg
  Layouts: ["E-101 Electrical Plan", "P-101 Plumbing Plan", "RCP-101 Reflected Ceiling"]

Suggested matches:
  Drawing E-101 "Electrical Plan" ← Layout "E-101 Electrical Plan"  [✓ Confirm]
  Drawing P-101 "Plumbing Plan"   ← Layout "P-101 Plumbing Plan"    [✓ Confirm]
  Drawing RCP-101 "Reflected Ceiling" ← Layout "RCP-101 Reflected Ceiling" [✓ Confirm]
```

---

## Migration Plan

### Step 1: Schema Migration

1. Add `CadFreshnessStatus` enum
2. Add `CadSourceLink` model
3. Add `sourceCadPath` and `sourceCadRevision` to `DrawingRevision`
4. Add relation on `ProjectDrawing`
5. Run `prisma migrate dev`

### Step 2: Backend API

1. Create CRUD endpoints for `CadSourceLink`
2. Create freshness check endpoint
3. Modify revision creation to accept and store CAD source info
4. Add transmittal warning logic

### Step 3: Frontend — Drawing Register

1. Add freshness badge to drawing list
2. Add CAD source link setup to drawing edit form
3. Add dismiss/needs-replot action buttons

### Step 4: Frontend — Freshness Dashboard

1. Add summary widget to project files page
2. Add bulk review interface

### Step 5: Frontend — Transmittal Integration

1. Add stale drawing warning to transmittal creation flow

### Step 6: Auto-Linking

1. Implement auto-match logic
2. Add confirmation UI

---

## Edge Cases

1. **Drawing with no CAD source** — status stays `UNKNOWN`, no warnings. Many drawings (details, schedules) may not come from a tracked CAD file.

2. **CAD file deleted from Dropbox** — freshness check should handle 404 gracefully, set a special status or log a warning.

3. **CAD file moved/renamed** — Dropbox path changes, link breaks. User needs to update the `cadDropboxPath`. Could use Dropbox file ID for more resilient tracking.

4. **Multiple CAD files per drawing** — Rare but possible (e.g., xrefs). V1 supports one source per drawing. Can extend later with multiple `CadSourceLink` records (remove `@unique` on `drawingId`).

5. **User plots PDF outside the system** — They can still manually trigger "mark as plotted" to update the revision snapshot.

6. **Rapid CAD saves** — Dropbox revision changes on every save. The freshness check should NOT send notifications on every save — only flag on the next page load or manual check.

7. **Dismissed then CAD changes again** — If a drawing is `DISMISSED` and the CAD file changes again (new revision different from the one that was dismissed), it should go back to `CAD_MODIFIED`. Track `dismissedAtRevision` to handle this.

### Additional Field for Edge Case 7

Add to `CadSourceLink`:
```prisma
  dismissedAtCadRevision  String?   // The CAD revision that was active when user dismissed
```

Then in freshness check:
- If status is `DISMISSED` and current CAD revision !== `dismissedAtCadRevision` → set back to `CAD_MODIFIED`
- This catches the case where user dismissed for one change, but CAD changed again

---

## Performance Considerations

1. **Batch Dropbox API calls** — Group drawings by `cadDropboxPath` so you only check each CAD file once
2. **Cache freshness results** — Store check timestamp, skip re-check within 5 minutes
3. **Don't check on every page load** — Check on first load, then use cached status. Manual refresh button.
4. **Background refresh** — Could add a periodic check (e.g., when project is opened) that updates statuses

---

## Summary

| What | How |
|------|-----|
| Track CAD source per drawing | `CadSourceLink` model (1:1 with `ProjectDrawing`) |
| Know when PDF was plotted | `plottedFromRevision` + `plottedAt` on `CadSourceLink` |
| Detect CAD changes | Compare Dropbox current rev vs `plottedFromRevision` |
| Handle multiple layouts in one DWG | All drawings from same DWG get flagged, user dismisses per-drawing |
| Prevent sending stale PDFs | Warning at transmittal creation |
| Auto-match drawings to CAD files | Name/layout matching with user confirmation |

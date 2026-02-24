# Project Files V2

## Overview

Project Files V2 is the drawing management and transmittal system. It handles uploading drawings, organizing them by section, sending them to recipients via email with stamped/combined PDFs, and tracking transmittal history with email open detection.

---

## Drawing Fields

Only these fields are actively tracked and displayed:

| Field | Description |
|-------|-------------|
| **Drawing #** | Unique identifier (e.g., A-101, P2-1) |
| **Title** | Drawing name (e.g., "Basement Plan") |
| **Section** | Project section with color (e.g., Plumbing Plan) |
| **Page #** | Page number (e.g., P5-0) |
| **Review** | Review number (e.g., 03) |
| **Drawn By** | Default: Sami Yossef, option: Manual Vitor |
| **Status** | Active, Draft, Superseded, Archived |
| **Notes** | Optional description |

**Removed fields** (exist in schema but not used in UI): Floor, Drawing Type, Scale, Paper Size, Discipline, CAD file linking.

---

## Send Files Flow

The core feature. Multi-step process:

1. **Select files** - Upload new or pick from Dropbox
2. **Assign metadata** - Title, section, drawn by, review, page number
3. **Select recipients** - Name, email, company, type (Client/Contractor/Sub/etc.)
4. **Review & send**

### What happens on send:

1. Files uploaded to Dropbox at `4-drawings/{SectionName}/{YYYY-MM-DD}/`
2. `ProjectDrawing` records created (or existing ones updated with new revision)
3. `DrawingRevision` records created
4. `Transmittal` + `TransmittalItem` records created (one transmittal per recipient)
5. PDFs stamped with drawing number, revision, title
6. All PDFs merged into single combined file, **sorted by page number**
7. Combined PDF uploaded to Dropbox at `5-transmittals/{ProjectName} - T-001 - 2026-02-23.pdf`
8. HTML email sent with combined PDF attachment
9. Transmittal status set to SENT, email tracking pixel embedded

### Email Template

Matches the meeting email design:
- Company logo + "DRAWING TRANSMITTAL" header
- Personalized greeting with recipient first name
- Transmittal details card (number, date, project, recipient)
- Drawing table with columns: Title, Section, Review, Page (sorted by page #)
- Optional notes section
- Footer with company email and phone (clickable links)
- Tracking pixel for email open detection

---

## Sent Tab (Transmittal Log)

Shows one row per transmittal with columns:

| Column | Description |
|--------|-------------|
| # | Transmittal number (T-001) |
| Drawings | Title(s) - grouped when same title/section/review |
| Section | Section name per drawing |
| Review | Review number per drawing |
| Page | Page numbers, comma-separated when grouped (e.g., "P2-0, P5-0") |
| Recipient | Name + company |
| Method | Email or Manual |
| Sent | Date, time, email open status |
| PDF | Link to download combined PDF |

Features: Search, sort (date/recipient/title), filter (section/recipient/date range), bulk delete, side panel showing latest files by section.

---

## Drawing Register (Drawings Tab)

Table with sortable columns: Drawing #, Title, Drawn By, Page #, Review, Section (full name), Status, Last Sent.

- **Filter sidebar**: Section filter (with counts), Status filter
- **Actions per drawing**: Edit, New Revision, Add to Transmittal, Archive
- **Detail panel**: Slide-out panel showing Drawn By, Page #, Review, file info, revision history timeline, sent history with open tracking

### New Revision Dialog

Simple form:
- What changed? (description, required)
- Issue Date (defaults to today)

No CAD file linking.

---

## Combined PDF

- All PDFs in a transmittal are stamped and merged into one file
- **Sort order**: By page number (numeric sort)
- **Filename**: `{ProjectName} - {T-XXX} - {YYYY-MM-DD}.pdf`
- **Storage**: Uploaded to Dropbox at `5-transmittals/` folder
- **Path stored**: On `Transmittal.combinedPdfPath` field
- **Download**: Via `/api/projects/{id}/project-files-v2/transmittals/{transmittalId}/download`

---

## Dropbox Folder Structure

```
ProjectName/
  1-renderings/
  2-photos/
  3-samples/
  4-drawings/
    {SectionName}/
      {YYYY-MM-DD}/
        [uploaded PDFs]
  5-transmittals/
    ProjectName - T-001 - 2026-02-23.pdf
```

---

## Components

| Component | Purpose |
|-----------|---------|
| `ProjectFilesV2Workspace` | Main workspace with 6 tabs, data fetching, dialog management |
| `DrawingRegisterTable` | Sortable drawing table |
| `DrawingRegisterCards` | Card grid view for drawings |
| `DrawingDetailPanel` | Right slide-out panel with drawing details + history |
| `DrawingFormDialog` | Create/edit drawing form (section, description) |
| `NewRevisionDialog` | Add revision to existing drawing |
| `FilterSidebar` | Section + status filters with counts |
| `SendFileDialog` | Multi-step send files flow |
| `TransmittalLog` | Sent transmittals table with grouping |
| `TransmittalDetail` | Full transmittal detail view |
| `AllFilesBrowser` | Dropbox folder browser with preview |
| `ReceiveFileDialog` | Log received files |
| `ReceivedFilesLog` | Received files table |
| `LatestFilesBySection` | Side panel showing recent files by section |
| `PhotosGallery` | Photo gallery from Dropbox |
| `RenderingsGallery` | Renderings gallery from Dropbox |
| `PdfViewer` | PDF document viewer |
| `PdfThumbnail` | PDF thumbnail previewer |

---

## API Routes

Base: `/api/projects/{projectId}/project-files-v2/`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `drawings` | GET | List drawings with section/status filters + counts |
| `drawings` | POST | Create drawing with initial revision |
| `drawings/{drawingId}` | GET | Get drawing with full details |
| `drawings/{drawingId}` | PATCH | Update drawing (title, section, description, status) |
| `drawings/{drawingId}` | DELETE | Archive drawing |
| `drawings/{drawingId}/revisions` | POST | Add new revision |
| `send-files` | POST | Create drawings + transmittals + send emails |
| `transmittals` | GET | List all transmittals |
| `transmittals/{id}` | GET | Get transmittal detail |
| `transmittals/{id}` | PATCH | Update transmittal |
| `transmittals/{id}/send` | POST | Send/resend transmittal email |
| `transmittals/{id}/download` | GET | Download combined PDF |
| `receive-files` | GET/POST | List/create received files |
| `sections` | GET/POST | List/create sections |
| `browse` | GET | Browse Dropbox folder |
| `upload` | POST | Upload file to Dropbox |
| `recipients` | GET | List recipients for autocomplete |
| `check-duplicates` | POST | Check for duplicate drawings |
| `pdf-thumbnail` | GET | Generate PDF thumbnail |
| `photos` | GET | List photos |
| `renderings` | GET | List renderings |

---

## Key Schema Models

### ProjectDrawing
```
id, projectId, sectionId, drawingNumber, title, status,
currentRevision, description, dropboxPath, dropboxUrl,
fileName, fileSize, drawnBy, reviewNo, pageNo, createdBy
```

### Transmittal
```
id, projectId, transmittalNumber, subject, recipientName,
recipientEmail, recipientCompany, recipientType, method,
status, notes, sentAt, sentBy, emailId, emailOpenedAt,
combinedPdfPath, createdBy
```

### TransmittalItem
```
id, transmittalId, drawingId, revisionId, revisionNumber, purpose, notes
```

### DrawingRevision
```
id, drawingId, revisionNumber, description, dropboxPath,
dropboxUrl, fileName, fileSize, issuedDate, issuedBy
```

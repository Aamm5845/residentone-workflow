# FFE Sharing & Export Guide

> **For AI Agencies**: This document covers share links, PDF generation, CSV export, and client portals.

---

## Overview

| Feature | Purpose | Output |
|---------|---------|--------|
| Share Links | Public client viewing | URL with token |
| PDF Export | Downloadable spec sheets | PDF file |
| CSV Export | Spreadsheet data | CSV file |
| Spec Book | Full project documentation | Large-format PDF |
| Client Approval | Get client sign-off | In-app approval |

---

## 1. Shareable Links

### How It Works
Create public links for clients to view specs without logging in.

### Data Model

```prisma
model SpecShareLink {
  id              String    @id
  orgId           String
  projectId       String
  token           String    @unique   // Public access token

  // Items (empty = share all)
  itemIds         String[]  // Specific items, or [] for all

  // Visibility Settings
  showSupplier    Boolean   @default(true)
  showBrand       Boolean   @default(true)
  showPricing     Boolean   @default(false)  // RRP only
  showDetails     Boolean   @default(true)   // Dimensions, finish, etc.
  showSpecSheets  Boolean   @default(true)
  showNotes       Boolean   @default(false)

  // Client Actions
  allowApproval   Boolean   @default(false)

  // Status
  isActive        Boolean   @default(true)
  expiresAt       DateTime?

  // Tracking
  viewedAt        DateTime?
  lastAccessedAt  DateTime?
  accessCount     Int       @default(0)
}
```

### Create Share Link

```
POST /api/projects/[id]/spec-share-links
```

```typescript
{
  // Sharing Mode
  itemIds: string[],        // Specific items, or [] for "Share All"

  // Visibility
  showSupplier: boolean,
  showBrand: boolean,
  showPricing: boolean,     // Shows RRP, never trade price
  showDetails: boolean,
  showSpecSheets: boolean,
  showNotes: boolean,

  // Client Actions
  allowApproval: boolean,

  // Expiry
  expiresAt?: string        // ISO date
}
```

### Response
```typescript
{
  id: string,
  token: string,
  url: string,  // Full shareable URL
  // ... all settings
}
```

### Share All Mode
When `itemIds` is empty, link dynamically includes all specs:
- Filters to `visibility: VISIBLE`
- Excludes `specStatus` in `['DRAFT', 'NEEDS_SPEC', 'HIDDEN']`
- Includes future items automatically

### Access Share Link (Public)

```
GET /api/shared/specs/link/[token]
```

Returns specs with visibility settings applied:
```typescript
{
  project: { name, clientName },
  organization: { name, email },
  items: Array<{
    id,
    name,
    docCode,
    room,
    section,
    // Conditional based on settings:
    brand?,
    supplier?,
    rrp?,
    dimensions?,
    // ...
  }>,
  settings: {
    showSupplier,
    showPricing,
    allowApproval,
    // ...
  }
}
```

### Tracking
Every access updates:
- `viewedAt` (first view)
- `lastAccessedAt` (most recent)
- `accessCount` (increments)

---

## 2. Client Approval via Share Link

### Enable Approval
Set `allowApproval: true` when creating link.

### Security: Address Verification
Clients must verify project address before approving:

```typescript
// Request
POST /api/shared/specs/link/[token]/approve
{
  itemId: string,
  streetNumber: string  // Must match project address
}
```

### Approval Logic
```typescript
// Extract street numbers from project address
const projectNumbers = project.address.match(/\d+/g);

// Verify client's input matches
if (!projectNumbers.includes(streetNumber)) {
  throw new Error('Address verification failed');
}

// Mark item approved
await prisma.roomFFEItem.update({
  where: { id: itemId },
  data: {
    clientApproved: true,
    clientApprovedAt: new Date(),
    clientApprovedVia: 'share_link'
  }
});
```

### Approval Restrictions
Cannot approve items with `specStatus: 'CONTRACTOR_TO_ORDER'`

---

## 3. PDF Export

### Spec PDF Export Dialog
**Component**: `src/components/specs/SpecPDFExportDialog.tsx`

### Options

**Page Sizes**
- 24" x 36" (large format) - Currently active
- Tabloid - Coming soon
- Letter - Coming soon

**Layout Styles**
- Grid (6x2 items per page) - Currently active
- List - Coming soon

**Grouping**
- By Category
- By Room

### Visibility Toggles
- Brand/Manufacturer
- Supplier/Vendor
- Pricing (RRP)
- Dimensions
- Finish
- Color
- Material
- Notes
- Product Links (clickable in PDF)
- Lead Time

### API Endpoint

```
POST /api/specs/export-pdf
```

```typescript
{
  projectId: string,
  itemIds?: string[],       // Optional: specific items

  // Layout
  pageSize: "24x36" | "tabloid" | "letter",
  layoutStyle: "grid" | "list",
  groupBy: "category" | "room",

  // Visibility
  showBrand: boolean,
  showSupplier: boolean,
  showPricing: boolean,
  showDimensions: boolean,
  showFinish: boolean,
  showColor: boolean,
  showMaterial: boolean,
  showNotes: boolean,
  showLinks: boolean,
  showLeadTime: boolean,

  // Cover
  includeCover: boolean
}
```

### Response
Returns PDF blob for immediate download.

### File Naming
```
{projectName}-specs-{YYYY-MM-DD}-{HHMM}.pdf
```

### PDF Features
- Circular image masks for product photos
- Item cards with image, doc code, name, metadata
- Clickable product links (PDF annotations)
- Component information with pricing breakdown
- Color-coded pricing (CAD/USD distinction)
- Professional header/footer

---

## 4. CSV Export

### Spec CSV Export Dialog
**Component**: `src/components/specs/SpecCSVExportDialog.tsx`

### Available Columns

**Basic Info**
- Doc Code
- Name
- Room
- Section
- Brand
- Model/SKU
- Supplier
- Quantity

**Pricing**
- Trade Price (CAD)
- Trade Price (USD)
- RRP (CAD)
- RRP (USD)
- Markup %
- Line Total (CAD)
- Line Total (USD)

**Details**
- Status
- Lead Time
- Color
- Finish
- Material
- Dimensions (WxHxD)

**Other**
- Description
- Notes
- Client Approved (Yes/No)

### Options
- **Include Components**: Add component rows (indented with →)
- **Column Selection**: Pick specific columns by category

### API (Client-Side Generation)

CSV is generated in browser, no server endpoint needed:

```typescript
// Generate CSV string
const csvContent = items.map(item => {
  return selectedColumns.map(col => {
    const value = item[col.field];
    // Escape quotes and commas
    return `"${String(value).replace(/"/g, '""')}"`;
  }).join(',');
}).join('\n');

// Download
const blob = new Blob([csvContent], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
downloadFile(url, `${projectName}_specs_${date}.csv`);
```

### File Naming
```
{projectName}_specs_{YYYY-MM-DD}.csv
```

---

## 5. Spec Book Generation

### Overview
Large-format PDF combining:
- Cover page
- Table of contents
- Project plans (floorplans, CAD drawings)
- Room sections with renderings

### API Endpoint

```
POST /api/spec-books/generate
```

```typescript
{
  projectId: string,

  // Sections to include
  includeFloorplans: boolean,
  includeLighting: boolean,
  includeElectrical: boolean,
  includePlumbing: boolean,
  includeStructural: boolean,
  includeRCP: boolean,
  includeRooms: boolean,

  // Cover
  coverData?: {
    type: string,       // "Design Development", "Construction"
    customTitle?: string
  }
}
```

### Generation Process

```
1. Create SpecBookGeneration record (status: GENERATING)
2. Load cover template PDF
3. Add dynamic cover overlay (project name, date)
4. Generate TOC placeholder
5. Add project sections:
   - Fetch CAD PDFs from Dropbox
   - Convert if needed (DWG → PDF)
   - Embed all pages
6. Add room sections:
   - Fetch renderings
   - Scale and position images
   - Add professional borders/headers
7. Generate final TOC with page numbers
8. Add page numbers to all pages
9. Upload to Vercel Blob
10. Mirror to Dropbox
11. Update generation record (status: COMPLETED)
```

### Storage Locations
- **Primary**: Vercel Blob (`/specbooks/generated/`)
- **Backup**: Dropbox (`/[Project]/11- SOFTWARE UPLOADS/Spec Books/Generated/`)

### PDF Structure

```
Page 1: Cover
  - Black background
  - "NEW COVER.pdf" template
  - Project name overlay
  - Address overlay
  - Date overlay

Page 2: Table of Contents
  - PROJECT PLANS section
  - ROOMS section
  - Dotted leaders with page numbers

Pages 3+: Project Plans
  - Floorplans (all pages from CAD)
  - Lighting plans
  - Electrical plans
  - etc.

Pages N+: Room Sections
  - Room name header
  - Renderings (scaled to fit)
  - Room CAD drawings
```

### Tracking

```prisma
model SpecBookGeneration {
  id              String    @id
  specBookId      String
  version         Int
  status          String    // GENERATING, COMPLETED, FAILED
  pdfUrl          String?
  dropboxPath     String?
  fileSize        Int?
  pageCount       Int?
  sectionsIncluded Json?    // Which sections were included
  roomsIncluded   Json?     // Which rooms were included
  coverData       Json?
  generatedById   String
  errorMessage    String?
  downloadCount   Int       @default(0)
  lastDownloadAt  DateTime?
}
```

### History Endpoint

```
GET /api/spec-books/[projectId]/history
```

Returns all generations with metadata for version comparison.

---

## 6. Dropbox Integration

### Service Location
`src/lib/dropbox-service-v2.ts`

### Project Folder Structure

```
/Team Folder/{ProjectName}/
├── 1- CAD/
├── 2- MAX/
├── 3- RENDERING/
├── 4- SENT/
├── 5- RECIEVED/
├── 6- SHOPPING/
│   └── {CategoryName}/
│       ├── Drawings/
│       ├── Quotes/
│       ├── Photos/
│       ├── Invoices/
│       └── Receipts/
├── 7- SOURCES/
├── 8- DRAWINGS/
├── 9- SKP/
├── 10- REFERENCE MOOD/
└── 11- SOFTWARE UPLOADS/
    ├── Project Covers/
    ├── Spec Books/
    │   ├── Generated/
    │   └── Uploaded/
    ├── Floorplan Approvals/
    ├── Chat Attachments/
    └── General Assets/
```

### Core Operations

```typescript
// List folder contents
await dropbox.listFolder(path);

// Download file
await dropbox.downloadFile(path);

// Upload file
await dropbox.uploadFile(path, content);

// Create shared link (for embedding)
const link = await dropbox.createSharedLink(path);
// Returns raw=1 URL for direct access

// Search for CAD files
await dropbox.searchCADFiles(projectPath);
```

### Shared Link Format
```
// Standard shared link
https://www.dropbox.com/s/abc123/file.pdf?dl=0

// Converted for embedding (raw=1)
https://www.dropbox.com/s/abc123/file.pdf?raw=1
```

---

## 7. Email Sharing

### Sending Share Links

When sharing specs, system can send email with link:

```typescript
// 1. Create share link
const link = await createShareLink({...});

// 2. Send email
await sendEmail({
  to: clientEmail,
  subject: `Specifications for ${projectName}`,
  html: `
    <p>Please review the specifications:</p>
    <p><a href="${link.url}">View Specifications</a></p>
    <p>This link ${link.expiresAt ? `expires on ${formatDate(link.expiresAt)}` : 'does not expire'}.</p>
  `
});

// 3. Track email (optional)
await prisma.specShareLinkEmail.create({
  data: {
    linkId: link.id,
    to: clientEmail,
    sentAt: new Date()
  }
});
```

### Email Tracking
- Track open via tracking pixel
- Track click on link
- Log in `ClientQuoteEmailLog` model

---

## Common Patterns

### Create Share Link and Send Email

```typescript
// 1. Create link
const link = await fetch(`/api/projects/${projectId}/spec-share-links`, {
  method: 'POST',
  body: JSON.stringify({
    itemIds: [],  // Share all
    showPricing: true,
    showBrand: true,
    allowApproval: true,
    expiresAt: addDays(new Date(), 30).toISOString()
  })
});

// 2. Send to client
await sendClientEmail(link.url);
```

### Export Specs as PDF with Components

```typescript
const response = await fetch('/api/specs/export-pdf', {
  method: 'POST',
  body: JSON.stringify({
    projectId,
    groupBy: 'room',
    showPricing: true,
    showComponents: true,
    includeCover: true
  })
});

const blob = await response.blob();
downloadBlob(blob, `${projectName}-specs.pdf`);
```

### Generate Spec Book

```typescript
// Start generation
const { generationId } = await fetch('/api/spec-books/generate', {
  method: 'POST',
  body: JSON.stringify({
    projectId,
    includeFloorplans: true,
    includeRooms: true,
    coverData: {
      type: 'Construction Documents'
    }
  })
});

// Poll for completion
const checkStatus = async () => {
  const status = await fetch(`/api/spec-books/${projectId}/status/${generationId}`);
  if (status.status === 'COMPLETED') {
    window.open(status.pdfUrl);
  } else if (status.status === 'GENERATING') {
    setTimeout(checkStatus, 5000);
  }
};
checkStatus();
```

---

## Security Considerations

### Share Links
- Tokens are cryptographically random (CUID)
- Can be deactivated (`isActive: false`)
- Optional expiration
- Track all access

### Client Approval
- Requires address verification
- Prevents unauthorized approvals
- Logs approval source

### Pricing Visibility
- Never expose trade prices to clients
- RRP only when `showPricing: true`
- Components include markup in client view

---

*Last updated: January 2025*

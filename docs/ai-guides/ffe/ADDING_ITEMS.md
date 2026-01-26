# Adding Items to All Specs / FFE

> **For AI Agencies**: This document covers ALL methods to add items to the FFE system.

---

## Overview

Items can be added to All Specs (FFE) through multiple methods:

| Method | Use Case | Location |
|--------|----------|----------|
| Manual Form | Quick single item entry | FFE Workspace UI |
| Chrome Extension | Clip products from websites | Browser extension |
| URL Smart Fill | Paste supplier URL | Extension or dialog |
| AI Generation | Detect items from renderings | Room detail page |
| Template Import | Apply predefined templates | Room FFE setup |
| Programa Import | Excel file from Programa.design | Import dialog |
| Duplicate | Clone existing items | Item context menu |
| Product Library | Reuse saved products | Library panel |

---

## 1. Manual Form Creation

### Endpoint
```
POST /api/ffe/v2/rooms/[roomId]/items
```

### Request Body
```typescript
{
  // Required
  name: string,
  sectionId: string,

  // Optional - Basic Info
  description?: string,
  quantity?: number,        // Default: 1
  unitType?: string,        // "each", "set", "pair", etc.

  // Optional - Product Details
  brand?: string,
  sku?: string,
  docCode?: string,         // Auto-generated if not provided
  modelNumber?: string,
  color?: string,
  finish?: string,
  material?: string,

  // Optional - Dimensions
  width?: string,
  height?: string,
  depth?: string,
  length?: string,

  // Optional - Pricing
  unitCost?: number,
  tradePrice?: number,
  tradePriceCurrency?: "CAD" | "USD",
  rrp?: number,
  rrpCurrency?: "CAD" | "USD",
  markupPercent?: number,

  // Optional - Supplier
  supplierId?: string,
  supplierName?: string,
  supplierLink?: string,
  leadTime?: string,

  // Optional - Media
  images?: string[],        // Array of image URLs

  // Optional - Linking
  ffeRequirementId?: string,  // Link to FFE requirement
  isOption?: boolean,         // Mark as option for requirement
  optionNumber?: number,

  // Optional - Custom
  customFields?: Record<string, any>
}
```

### Auto-Generated Fields
- **docCode**: Generated from section prefix + incrementing number (e.g., "PL-001")
- **visibility**: Defaults to `HIDDEN` (must explicitly add to workspace)
- **specStatus**: Defaults to `DRAFT`
- **state**: Defaults to `PENDING`

### Example
```typescript
// Create a basic item
const response = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
  method: 'POST',
  body: JSON.stringify({
    name: 'Pendant Light',
    sectionId: 'section-uuid',
    brand: 'Tom Dixon',
    sku: 'TD-BEAT-BLK',
    tradePrice: 450,
    tradePriceCurrency: 'USD',
    rrp: 650,
    rrpCurrency: 'CAD',
    supplierName: 'Design Within Reach',
    supplierLink: 'https://dwr.com/product/123',
    images: ['https://blob.vercel-storage.com/image1.jpg']
  })
});
```

---

## 2. Chrome Extension Integration

### Overview
The Chrome extension ("Clip to Room") captures product information from supplier websites.

### Key Files
- `chrome-extension/popup.js` - Main popup UI
- `chrome-extension/background.js` - Service worker
- `src/app/api/extension/clip/route.ts` - Backend handler

### Capabilities

#### Image Capture
- Right-click context menu to clip images
- Crop tool to select specific areas
- Multiple images per item

#### Smart Fill (AI Extraction)
- Analyzes page content with GPT-4o-mini
- Extracts: name, brand, SKU, pricing, dimensions, materials
- Processes up to 12,000 characters of page content

#### Text Selection
- Click + button to capture specific text
- Selected text parsed for product details

#### Attachment Detection
- Scans page for downloadable PDFs/spec sheets
- Automatically links documents to item

### Extension Workflow

```
1. User on supplier website
2. Click extension icon
3. Smart Fill analyzes page
4. Form pre-populated with extracted data
5. User selects destination room
6. User can link to multiple FFE requirements
7. Save to room and/or library
```

### Extension API Endpoint

```
POST /api/extension/clip
```

```typescript
{
  // Item data
  name: string,
  description?: string,
  brand?: string,
  modelNumber?: string,
  sku?: string,

  // Pricing
  tradePrice?: number,
  rrp?: number,
  currency?: "CAD" | "USD",

  // Details
  color?: string,
  finish?: string,
  material?: string,
  dimensions?: string,
  leadTime?: string,

  // Media
  images?: string[],
  attachments?: Array<{ name: string, url: string }>,

  // Destination
  roomId: string,
  sectionId?: string,

  // Linking
  ffeRequirementIds?: string[],  // Link to multiple FFE items

  // Library
  saveToLibrary?: boolean,

  // Source
  sourceUrl: string
}
```

### Multi-Select Linking
The extension supports linking a single product to multiple FFE requirements:

```typescript
{
  ffeRequirementIds: ['req-1', 'req-2', 'req-3'],
  // Creates one spec item linked to all three FFE requirements
}
```

### "Link Similar Items" Feature
- Finds similar FFE items across all project rooms
- Matches by name similarity
- Allows batch linking to related requirements

---

## 3. URL Smart Fill (AI Extraction)

### Endpoint
```
POST /api/extension/smart-fill
```

### How It Works

1. User pastes supplier product page URL
2. System fetches page content
3. GPT-4o-mini analyzes content
4. Returns structured product data

### Request
```typescript
{
  url: string,           // Supplier product page URL
  pageContent?: string   // Optional: pre-fetched content
}
```

### Response
```typescript
{
  success: true,
  data: {
    name: string,
    brand: string,
    description: string,
    sku: string,
    modelNumber: string,

    // Pricing
    retailPrice: number,
    wholesalePrice: number,
    currency: string,

    // Details
    materials: string[],
    colors: string[],
    finishes: string[],

    // Dimensions
    width: string,
    height: string,
    depth: string,

    // Availability
    leadTime: string,

    // Images
    imageUrls: string[],

    // Confidence
    confidence: "high" | "medium" | "low"
  }
}
```

### Supported Sites
- E-commerce sites (furniture, lighting, fixtures)
- Interior design product pages
- Manufacturer catalogs
- Trade supplier websites

### Limitations
- Requires public page (no login-protected content)
- Best with standard e-commerce product page structure
- May not capture all fields for unusual layouts

---

## 4. AI Generation from Renderings

### Endpoint
```
POST /api/ffe/v2/rooms/[roomId]/ai-generate
```

### How It Works

1. User clicks "Generate from Rendering"
2. System fetches room's latest 3D renderings
3. GPT-4o with vision analyzes images
4. Returns categorized item suggestions
5. User reviews, edits, and imports

### Request
```typescript
{
  // Optional: specific rendering to analyze
  renderingUrl?: string
}
```

### Response
```typescript
{
  success: true,
  suggestions: Array<{
    category: string,         // "Lighting", "Furniture", etc.
    items: Array<{
      name: string,
      description: string,
      quantity: number,
      confidence: "high" | "medium" | "low",
      suggestedSection: string,

      // Optional extracted details
      estimatedDimensions?: string,
      style?: string,
      material?: string
    }>
  }>,

  // Analysis metadata
  renderingSource: string,    // "blob" | "dropbox" | "specbook"
  analysisTimestamp: string
}
```

### Rate Limiting
- 1 request per 30 seconds per room
- Prevents duplicate/spam requests

### Rendering Sources (Priority Order)
1. Vercel Blob storage (fastest)
2. Dropbox project folder
3. Spec book renderings (fallback)

### Context Awareness
- Uses room's existing section presets
- Suggests appropriate categories
- Considers room type (bathroom, kitchen, etc.)

---

## 5. Template Import

### Endpoint
```
POST /api/ffe/v2/rooms/[roomId]/import-template
```

### How It Works

1. Select template for room type
2. Choose sections/items to import
3. System creates room FFE instance
4. Sections and items copied from template
5. Items default to HIDDEN visibility

### Request
```typescript
{
  templateId: string,

  // Optional: selective import
  sectionIds?: string[],    // Only import these sections
  itemIds?: string[]        // Only import these items
}
```

### Response
```typescript
{
  success: true,
  instance: {
    id: string,
    roomId: string,
    templateId: string,
    sections: Array<{
      id: string,
      name: string,
      itemCount: number
    }>
  },
  itemsCreated: number
}
```

### Template Structure
```
FFETemplate
├── FFETemplateSection (Lighting)
│   ├── FFETemplateItem (Pendant)
│   ├── FFETemplateItem (Sconce)
│   └── FFETemplateItem (Recessed)
├── FFETemplateSection (Plumbing)
│   └── FFETemplateItem (Faucet)
└── FFETemplateSection (Hardware)
    └── FFETemplateItem (Pulls)
```

### Import Behavior
- Creates `RoomFFEInstance` linked to room
- Creates `RoomFFESection` for each template section
- Creates `RoomFFEItem` for each template item
- Preserves item hierarchy (linked components)
- Generates new doc codes per section prefix

---

## 6. Programa.design Import

### Endpoint
```
POST /api/programa-import
```

### How It Works

1. Export Excel file from Programa.design
2. Upload via import dialog
3. System parses Excel with XLSX library
4. Extracts embedded images from Excel
5. Creates items in batch

### Request (FormData)
```typescript
FormData {
  file: File,              // .xlsx file
  roomId: string,
  sectionId?: string       // Target section
}
```

### Excel Parsing Features
- Reads multiple worksheets
- Maps column headers to item fields
- Extracts embedded images:
  - Unzips Excel (ZIP format)
  - Reads drawing relationships
  - Maps images to row numbers
  - Uploads to Vercel Blob

### Expected Excel Columns
| Column | Maps To |
|--------|---------|
| Name | name |
| Description | description |
| Brand | brand |
| Model | modelNumber |
| SKU | sku |
| Qty | quantity |
| Trade Price | tradePrice |
| RRP | rrp |
| Color | color |
| Material | material |
| Size | dimensions |
| Lead Time | leadTime |
| Supplier | supplierName |
| Link | supplierLink |

### Image Extraction
```typescript
// Excel structure
├── [Content_Types].xml
├── xl/
│   ├── worksheets/sheet1.xml
│   ├── drawings/
│   │   ├── drawing1.xml
│   │   └── _rels/drawing1.xml.rels
│   └── media/
│       ├── image1.png
│       └── image2.jpg
```

---

## 7. Duplicate Items

### Endpoint
```
POST /api/ffe/v2/rooms/[roomId]/items/[itemId]/duplicate
```

### How It Works

1. Fetches source item with all fields
2. Creates new item with copied data
3. Generates new docCode
4. Resets status to DRAFT

### Request
```typescript
{
  // Optional: override target section
  targetSectionId?: string,

  // Optional: new name
  name?: string,

  // Optional: duplicate to different room
  targetRoomId?: string
}
```

### Copied Fields
- All product details (name, brand, sku, etc.)
- Pricing information
- Supplier information
- Images (references, not duplicated)
- Custom fields

### Reset Fields
- `id`: New UUID
- `docCode`: New auto-generated
- `specStatus`: Reset to DRAFT
- `visibility`: Reset to HIDDEN
- `clientApproved`: Reset to false
- `acceptedQuoteLineItemId`: Cleared

---

## 8. Product Library

### Overview
Organization-wide library of reusable products.

### Saving to Library
When clipping via extension:
```typescript
{
  saveToLibrary: true,
  // Creates library entry alongside room item
}
```

### Library Endpoints

**List Library Items**
```
GET /api/ffe/items
GET /api/ffe/items?category=Lighting
GET /api/ffe/items?search=pendant
```

**Add from Library to Room**
```
POST /api/ffe/v2/rooms/[roomId]/items
{
  libraryItemId: string,  // Copy from library
  sectionId: string
}
```

### Library Item Fields
Same as RoomFFEItem, stored at org level without room association.

---

## Item Creation Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ITEM CREATION METHODS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Manual Form ─────────┐                                        │
│                       │                                        │
│  Chrome Extension ────┤                                        │
│    ├─ Image Clip      │                                        │
│    ├─ Smart Fill      │                                        │
│    └─ Text Select     │                                        │
│                       ├──► POST /api/ffe/v2/rooms/[roomId]/items│
│  URL Smart Fill ──────┤                                        │
│                       │                                        │
│  AI Generation ───────┤                                        │
│                       │                                        │
│  Template Import ─────┤                                        │
│                       │                                        │
│  Programa Import ─────┘                                        │
│                                                                 │
│  Duplicate ───────────► POST .../items/[itemId]/duplicate      │
│                                                                 │
│  Library ─────────────► POST with libraryItemId                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RoomFFEItem Created                        │
├─────────────────────────────────────────────────────────────────┤
│  • visibility: HIDDEN (default)                                │
│  • specStatus: DRAFT                                           │
│  • docCode: Auto-generated from section prefix                 │
│  • Activity logged if linking to FFE requirement               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Common Patterns

### Create Item and Link to FFE Requirement
```typescript
await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
  method: 'POST',
  body: JSON.stringify({
    name: 'Tom Dixon Pendant',
    sectionId: lightingSection.id,
    ffeRequirementId: 'ffe-requirement-uuid',
    isSpecItem: true
  })
});
```

### Bulk Create from Template
```typescript
await fetch(`/api/ffe/v2/rooms/${roomId}/import-template`, {
  method: 'POST',
  body: JSON.stringify({
    templateId: 'bathroom-template-uuid',
    sectionIds: ['plumbing', 'hardware']  // Selective import
  })
});
```

### Create with Components
```typescript
// First create parent item
const parent = await createItem({ name: 'Pendant Fixture' });

// Then add components
await fetch(`/api/ffe/v2/rooms/${roomId}/items/${parent.id}/linked-items`, {
  method: 'PATCH',
  body: JSON.stringify({
    action: 'add',
    itemName: 'LED Driver',
    itemPrice: 45.00
  })
});
```

---

*Last updated: January 2025*

# FFE & Procurement Module Guide

> **For AI Agencies**: Read this document BEFORE making any changes to FFE or Procurement modules.

---

## Table of Contents
1. [Module Overview](#module-overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Key File Locations](#key-file-locations)
5. [FFE Module](#ffe-module)
6. [Procurement Module](#procurement-module)
7. [Integration Points](#integration-points)
8. [Workflows](#workflows)
9. [API Endpoints](#api-endpoints)
10. [Important Conventions](#important-conventions)

---

## Module Overview

### FFE (Furniture, Fixtures & Equipment)
Manages room-level furniture and equipment specifications. Think of it as "what items go in each room."

**Core Purpose**: Track FFE requirements per room, link them to product specifications, and manage templates.

### Procurement
Handles the purchasing workflow from RFQ (Request for Quote) through delivery. Think of it as "buying the items."

**Core Purpose**: Quote management, client invoicing, order tracking, delivery management.

### Relationship
```
FFE (What to buy) → Procurement (How to buy it)

RoomFFEItem (spec item) → RFQ → SupplierQuote → ClientQuote → Order → Delivery
```

---

## Architecture

### Tech Stack
- **Frontend**: Next.js 14+ App Router, React, TypeScript
- **State**: Zustand (stores), React Query (API)
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL via Prisma ORM
- **File Storage**: Dropbox

### Key Patterns
- **Feature Flags**: `src/lib/feature-flags/ffe-feature-flags.ts`
- **Services**: Backend logic in `src/lib/services/`
- **Stores**: Zustand stores in `src/stores/`
- **Hooks**: React Query hooks in `src/hooks/`
- **API**: RESTful routes in `src/app/api/`

---

## Database Schema

### FFE Models

```prisma
// Template for reusable FFE configurations
model FFETemplate {
  id          String   @id
  orgId       String
  name        String
  status      TemplateStatus  // DRAFT, PUBLISHED
  isDefault   Boolean
  sections    FFETemplateSection[]
  instances   RoomFFEInstance[]
}

// Section within a template (e.g., "Lighting", "Plumbing")
model FFETemplateSection {
  id          String
  templateId  String
  name        String
  order       Int
  items       FFETemplateItem[]
}

// Room-specific FFE instance
model RoomFFEInstance {
  id          String   @id
  roomId      String   @unique  // One instance per room
  templateId  String?
  status      InstanceStatus  // NOT_STARTED, IN_PROGRESS, COMPLETE
  progress    Decimal  // 0-100
  sections    RoomFFESection[]
}

// Section within a room instance
model RoomFFESection {
  id              String
  instanceId      String
  presetId        String?      // Links to FFESectionPreset
  name            String
  docCodePrefix   String?      // e.g., "PL" for Plumbing
  order           Int
  items           RoomFFEItem[]
}

// THE CORE MODEL - Individual FFE item/spec
model RoomFFEItem {
  id                      String   @id
  sectionId               String
  name                    String
  description             String?

  // State & Visibility
  state                   FFEItemState     // PENDING, CONFIRMED, COMPLETE, NOT_NEEDED
  visibility              ItemVisibility   // VISIBLE, HIDDEN
  specStatus              FFESpecStatus    // DRAFT → ORDERED → DELIVERED

  // Pricing
  unitCost                Decimal?
  totalCost               Decimal?
  tradePrice              Decimal?
  rrp                     Decimal?
  quantity                Int      @default(1)
  currency                String   @default("CAD")

  // Supplier Info
  supplierId              String?
  supplierName            String?
  supplierLink            String?
  brand                   String?
  modelNumber             String?
  sku                     String?

  // Spec Linking (for options/alternatives)
  isSpecItem              Boolean  @default(false)
  isOption                Boolean  @default(false)
  optionNumber            Int?
  ffeRequirementId        String?  // Parent FFE item if this is a spec

  // PROCUREMENT FIELDS
  acceptedQuoteLineItemId String?  @unique  // The accepted supplier quote
  paymentStatus           ItemPaymentStatus  // NOT_INVOICED, INVOICED, FULLY_PAID
  paidAmount              Decimal?
  paidAt                  DateTime?

  // Relations
  acceptedQuoteLineItem   SupplierQuoteLineItem?
  allQuoteLineItems       SupplierQuoteLineItem[]
  clientQuoteLineItems    ClientQuoteLineItem[]
  orderItems              OrderItem[]
  rfqLineItems            RFQLineItem[]
  activities              ItemActivity[]
  components              ItemComponent[]
}

// Predefined section presets
model FFESectionPreset {
  id              String   @id
  orgId           String
  name            String
  docCodePrefix   String   // e.g., "ELEC", "PL", "BATH"
  order           Int
  isActive        Boolean
}
```

### Procurement Models

```prisma
// Request for Quote
model RFQ {
  id              String   @id
  orgId           String
  projectId       String
  rfqNumber       String   @unique
  title           String
  status          RFQStatus  // DRAFT, SENT, QUOTED, CLOSED
  lineItems       RFQLineItem[]
  supplierRfqs    SupplierRFQ[]
}

// RFQ sent to specific supplier
model SupplierRFQ {
  id              String   @id
  rfqId           String
  supplierId      String?
  vendorEmail     String
  accessToken     String   @unique  // Portal access
  status          SupplierRFQStatus  // PENDING, SUBMITTED, DECLINED
  quotes          SupplierQuote[]
}

// Quote from supplier
model SupplierQuote {
  id              String   @id
  supplierRFQId   String
  quoteNumber     String
  status          QuoteStatus  // PENDING, SUBMITTED, ACCEPTED, REJECTED
  totalAmount     Decimal
  lineItems       SupplierQuoteLineItem[]
}

// Individual line item in supplier quote
model SupplierQuoteLineItem {
  id                  String   @id
  supplierQuoteId     String
  roomFFEItemId       String?  // Direct link to spec item

  // Pricing
  unitPrice           Decimal
  quantity            Int
  totalPrice          Decimal

  // Availability
  leadTimeWeeks       Int?
  availability        String?

  // Acceptance
  isAccepted          Boolean  @default(false)
  acceptedAt          DateTime?
  matchApproved       Boolean  @default(false)

  // Versioning
  quoteVersion        Int      @default(1)
  isLatestVersion     Boolean  @default(true)
}

// Quote sent to client (with markup)
model ClientQuote {
  id                  String   @id
  projectId           String
  quoteNumber         String
  status              ClientQuoteStatus  // DRAFT, SENT, APPROVED, PAID

  // Pricing (what client sees)
  subtotal            Decimal
  taxAmount           Decimal
  totalAmount         Decimal
  defaultMarkupPercent Decimal?

  lineItems           ClientQuoteLineItem[]
  payments            Payment[]
}

// Line item in client quote
model ClientQuoteLineItem {
  id                  String   @id
  clientQuoteId       String
  roomFFEItemId       String?

  // Client-facing pricing
  clientUnitPrice     Decimal
  clientTotalPrice    Decimal

  // Hidden supplier cost
  supplierUnitPrice   Decimal?
  supplierTotalPrice  Decimal?

  // Markup
  markupType          MarkupType  // PERCENTAGE, FIXED
  markupValue         Decimal?
}

// Purchase order
model Order {
  id              String   @id
  projectId       String
  supplierId      String?
  orderNumber     String
  status          OrderStatus  // PENDING_PAYMENT, ORDERED, SHIPPED, DELIVERED

  // Amounts
  totalAmount     Decimal

  // Tracking
  trackingNumber  String?
  expectedDelivery DateTime?
  actualDelivery  DateTime?

  items           OrderItem[]
  deliveries      Delivery[]
}

// Supplier info
model Supplier {
  id              String   @id
  orgId           String
  name            String
  email           String?
  categoryId      String?
  markupPercent   Decimal?  // Override category markup
  hasPortalAccess Boolean   @default(false)
}
```

### Key Enums

```prisma
enum FFEItemState {
  PENDING
  CONFIRMED
  IN_PROGRESS
  COMPLETE
  NOT_NEEDED
}

enum ItemVisibility {
  VISIBLE
  HIDDEN
}

enum FFESpecStatus {
  DRAFT
  SELECTED
  RFQ_SENT
  QUOTE_RECEIVED
  QUOTE_APPROVED
  BUDGET_SENT
  BUDGET_APPROVED
  INVOICED_TO_CLIENT
  CLIENT_PAID
  ORDERED
  SHIPPED
  RECEIVED
  DELIVERED
  INSTALLED
  CLOSED
  // Manual statuses
  HIDDEN
  CLIENT_TO_ORDER
  CONTRACTOR_TO_ORDER
  NEED_SAMPLE
  ISSUE
  ARCHIVED
}

enum ItemPaymentStatus {
  NOT_INVOICED
  INVOICED
  DEPOSIT_PAID
  FULLY_PAID
  REFUNDED
}
```

---

## Key File Locations

### FFE Module

| Purpose | Location |
|---------|----------|
| **Main Workspace UI** | `src/components/ffe/FFEUnifiedWorkspace.tsx` |
| **Room Service** | `src/lib/services/ffe-room-service.ts` |
| **Template Service** | `src/lib/services/ffe-template-service.ts` |
| **Backend Logic** | `src/lib/ffe/ffe-management-backend.ts` |
| **Types** | `src/types/ffe-management.ts`, `src/types/ffe-v2.ts` |
| **React Query Hooks** | `src/hooks/ffe/useFFEApi.ts` |
| **Zustand Stores** | `src/stores/ffe-room-store.ts`, `src/stores/ffe-template-store.ts` |
| **Feature Flags** | `src/lib/feature-flags/ffe-feature-flags.ts` |
| **Section Presets** | `src/lib/constants/ffe-section-presets.ts` |
| **API Routes** | `src/app/api/ffe/v2/**/*.ts` |

### Procurement Module

| Purpose | Location |
|---------|----------|
| **Project Procurement Page** | `src/app/projects/[id]/procurement/page.tsx` |
| **Procurement Content** | `src/app/projects/[id]/procurement/components/ProcurementContent.tsx` |
| **Tab Components** | `src/app/projects/[id]/procurement/components/*Tab.tsx` |
| **Shared Components** | `src/components/procurement/*.tsx` |
| **Status Sync Service** | `src/lib/procurement/status-sync.ts` |
| **API Routes** | `src/app/api/projects/[id]/procurement/**/*.ts` |

### Shared/Integration

| Purpose | Location |
|---------|----------|
| **Prisma Schema** | `prisma/schema.prisma` |
| **Supplier Model** | Search "model Supplier" in schema |
| **Item Activities** | `ItemActivity` model for tracking |

---

## FFE Module

### Core Concepts

1. **Template → Instance Pattern**
   - Templates are org-level blueprints
   - When assigned to a room, creates an instance
   - Instance copies template structure but allows customization

2. **Section Presets**
   - Predefined sections: Bathroom, Kitchen, Lighting, Plumbing, etc.
   - Each has a `docCodePrefix` (e.g., "PL" for Plumbing)
   - Used for organizing items and generating doc codes

3. **Item Visibility**
   - `VISIBLE`: Shows in workspace
   - `HIDDEN`: Not shown in workspace (but still exists)
   - UI labels this as "In Workspace" vs "Not in Workspace"

4. **Spec Linking**
   - FFE Requirement (`isSpecItem=false`): The need (e.g., "1x Pendant Light")
   - Spec Item (`isSpecItem=true`): The product (e.g., "Tom Dixon Pendant")
   - Options: Multiple spec items linked to one requirement via `ffeRequirementId`

### Item State Flow
```
PENDING → CONFIRMED → COMPLETE
    ↘ NOT_NEEDED
```

### API Pattern
```
GET    /api/ffe/v2/rooms/[roomId]                    # Get room FFE instance
GET    /api/ffe/v2/rooms/[roomId]/items              # List items
POST   /api/ffe/v2/rooms/[roomId]/items              # Create item
PUT    /api/ffe/v2/rooms/[roomId]/items/[itemId]     # Update item
DELETE /api/ffe/v2/rooms/[roomId]/items/[itemId]     # Delete item
PATCH  /api/ffe/v2/rooms/[roomId]/items/[itemId]/visibility  # Toggle visibility
```

---

## Procurement Module

### Workflow Overview

```
1. SELECT ITEMS    → Mark spec items for quoting
2. CREATE RFQ      → Bundle items into RFQ document
3. SEND TO SUPPLIERS → Email with portal access token
4. RECEIVE QUOTES  → Suppliers submit via portal
5. ACCEPT QUOTE    → Choose best quote per item
6. CREATE CLIENT QUOTE → Add markup, send to client
7. CLIENT APPROVAL → Client approves/pays
8. CREATE ORDERS   → Generate POs per supplier
9. TRACK DELIVERY  → Monitor shipping and delivery
```

### Key Data Flows

**Quote Acceptance**:
```typescript
// When accepting a quote:
1. Mark previous accepted quote as isAccepted: false
2. Mark new quote as isAccepted: true
3. Update RoomFFEItem.acceptedQuoteLineItemId
4. Update RoomFFEItem.tradePrice from quote
5. Update RoomFFEItem.specStatus to QUOTE_APPROVED
6. Create ItemActivity log
```

**Status Sync Triggers**:
| Event | New specStatus |
|-------|----------------|
| RFQ sent | RFQ_SENT |
| Quote received | QUOTE_RECEIVED |
| Quote accepted | QUOTE_APPROVED |
| Client quote sent | BUDGET_SENT |
| Client approves | BUDGET_APPROVED |
| Payment received | CLIENT_PAID |
| Order created | ORDERED |
| Order shipped | SHIPPED |
| Order delivered | DELIVERED |

### Tabs in Procurement

1. **Inbox**: Centralized messages/notifications
2. **RFQs**: Create and manage RFQs
3. **Supplier Quotes**: Review incoming quotes
4. **Budget Quotes**: Simplified client estimates
5. **Client Invoices**: Formal invoices with payment tracking
6. **Orders**: Purchase orders
7. **Delivery**: Shipping/delivery tracking

---

## Integration Points

### FFE ↔ Procurement

```
RoomFFEItem ──────┬─────── RFQLineItem (RFQ request)
                  ├─────── SupplierQuoteLineItem (supplier quotes)
                  ├─────── ClientQuoteLineItem (client invoices)
                  └─────── OrderItem (purchase orders)
```

### Key Relationships

```prisma
RoomFFEItem {
  // Direct link to accepted quote (unique, one accepted per item)
  acceptedQuoteLineItemId → SupplierQuoteLineItem

  // All quotes for comparison
  allQuoteLineItems → SupplierQuoteLineItem[]

  // Client invoicing
  clientQuoteLineItems → ClientQuoteLineItem[]

  // Orders
  orderItems → OrderItem[]
}
```

### Supplier Integration

```
Supplier ──┬── SupplierRFQ (RFQ sent to this supplier)
           ├── Orders (POs to this supplier)
           └── RoomFFEItem.supplierId (selected supplier for item)
```

---

## Workflows

### Creating an FFE Item

```typescript
// 1. Create via API
POST /api/ffe/v2/rooms/[roomId]/items
{
  sectionId: "section-uuid",
  name: "Pendant Light",
  description: "Over dining table",
  quantity: 1,
  state: "PENDING"
}

// 2. Item created with defaults
{
  visibility: "HIDDEN",  // Must explicitly add to workspace
  specStatus: "DRAFT",
  paymentStatus: "NOT_INVOICED"
}
```

### Quote Acceptance Flow

```typescript
// 1. Get all quotes for item
GET /api/projects/[id]/procurement/items/[itemId]/quotes

// 2. Accept specific quote
POST /api/projects/[id]/procurement/supplier-quotes/accept
{
  roomFFEItemId: "item-uuid",
  supplierQuoteLineItemId: "quote-line-uuid",
  markupPercent: 25  // Optional
}

// 3. System automatically:
// - Updates acceptedQuoteLineItemId
// - Sets specStatus to QUOTE_APPROVED
// - Logs activity
```

### Client Invoice Flow

```typescript
// 1. Create client quote from accepted supplier quotes
POST /api/projects/[id]/procurement/client-quotes
{
  title: "Kitchen FFE Quote",
  lineItemIds: ["item-1", "item-2"],
  defaultMarkupPercent: 25
}

// 2. Send to client
POST /api/projects/[id]/procurement/client-quotes/[quoteId]/send
{
  email: "client@example.com"
}

// 3. Client approves via portal (updates clientDecision)

// 4. Record payment
POST /api/projects/[id]/procurement/client-invoices/[invoiceId]/payment
{
  amount: 5000,
  method: "CREDIT_CARD",
  stripePaymentId: "pi_xxx"
}
```

---

## API Endpoints

### FFE APIs

```
Templates
GET    /api/ffe/v2/templates              List templates
POST   /api/ffe/v2/templates              Create template
GET    /api/ffe/v2/templates/[id]         Get template
PUT    /api/ffe/v2/templates/[id]         Update template
DELETE /api/ffe/v2/templates/[id]         Delete template
POST   /api/ffe/v2/templates/[id]/copy    Copy template

Rooms
GET    /api/ffe/v2/rooms/[roomId]         Get room FFE instance
POST   /api/ffe/v2/rooms/[roomId]/import-template  Import template

Items
GET    /api/ffe/v2/rooms/[roomId]/items                    List items
POST   /api/ffe/v2/rooms/[roomId]/items                    Create item
GET    /api/ffe/v2/rooms/[roomId]/items/[itemId]           Get item
PUT    /api/ffe/v2/rooms/[roomId]/items/[itemId]           Update item
DELETE /api/ffe/v2/rooms/[roomId]/items/[itemId]           Delete item
PATCH  /api/ffe/v2/rooms/[roomId]/items/[itemId]/visibility  Toggle visibility
POST   /api/ffe/v2/rooms/[roomId]/items/[itemId]/duplicate   Duplicate item
POST   /api/ffe/v2/rooms/[roomId]/items/[itemId]/archive     Archive item

Sections
GET    /api/ffe/v2/rooms/[roomId]/sections        List sections
POST   /api/ffe/v2/rooms/[roomId]/sections        Create section
POST   /api/ffe/v2/rooms/[roomId]/sections/duplicate  Duplicate section

Presets
GET    /api/ffe/section-presets           List presets
POST   /api/ffe/section-presets           Create preset
```

### Procurement APIs

```
RFQs
GET    /api/projects/[id]/procurement/rfqs        List RFQs
POST   /api/projects/[id]/procurement/rfqs        Create RFQ

Supplier Quotes
GET    /api/projects/[id]/procurement/supplier-quotes              List quotes
POST   /api/projects/[id]/procurement/supplier-quotes/accept       Accept quote
PATCH  /api/projects/[id]/procurement/supplier-quotes/[id]/status  Update status

Client Quotes/Invoices
GET    /api/projects/[id]/procurement/client-invoices             List invoices
POST   /api/projects/[id]/procurement/client-invoices             Create invoice
POST   /api/projects/[id]/procurement/client-invoices/[id]/send   Send to client
POST   /api/projects/[id]/procurement/client-invoices/[id]/payment  Record payment

Orders
GET    /api/projects/[id]/procurement/orders/ready-to-order  Items ready to order
POST   /api/projects/[id]/procurement/orders/create-manual   Create manual order

Item Summary
GET    /api/projects/[id]/procurement/items/[itemId]/summary  Item procurement status
GET    /api/projects/[id]/procurement/items/[itemId]/quotes   All quotes for item
```

---

## Important Conventions

### Naming Conventions

| Concept | Convention |
|---------|------------|
| FFE Item in room | `RoomFFEItem` |
| Spec item | `RoomFFEItem` with `isSpecItem=true` |
| FFE requirement | `RoomFFEItem` with `isSpecItem=false` |
| Template item | `FFETemplateItem` |
| Client-facing price | `clientUnitPrice`, `clientTotalPrice` |
| Hidden supplier price | `supplierUnitPrice`, `supplierTotalPrice` |

### Status Update Rules

1. **Never skip statuses** - Status should progress forward (e.g., DRAFT → SELECTED → RFQ_SENT)
2. **Auto-sync on procurement events** - Use `status-sync.ts` triggers
3. **Manual statuses are sticky** - HIDDEN, ISSUE, ARCHIVED don't auto-update

### Price Fields

```
tradePrice      = What we pay supplier (from accepted quote)
rrp             = Retail price (for reference)
unitCost        = Legacy field, use tradePrice
totalCost       = tradePrice * quantity
clientPrice     = tradePrice * (1 + markup)
```

### Visibility vs specStatus

- `visibility` = UI display (VISIBLE/HIDDEN in workspace)
- `specStatus` = Procurement progress (DRAFT → DELIVERED)

They are independent! An item can be:
- HIDDEN + ORDERED (not shown in workspace but ordered)
- VISIBLE + DRAFT (shown in workspace but not yet quoted)

### Activity Logging

Always log significant actions to `ItemActivity`:

```typescript
await prisma.itemActivity.create({
  data: {
    itemId: roomFFEItemId,
    type: 'QUOTE_ACCEPTED',
    title: 'Quote Accepted',
    description: `Quote from ${supplierName} accepted at $${price}`,
    actorId: userId,
    actorType: 'user'
  }
});
```

---

## Common Pitfalls

1. **Forgetting to update specStatus** - Always sync after procurement events
2. **Not handling multiple quotes** - Items can have quotes from multiple suppliers
3. **Confusing visibility with status** - They're independent concepts
4. **Direct schema changes** - Always use Prisma migrations
5. **Missing activity logs** - Log all significant state changes
6. **Ignoring feature flags** - Check `ffe-feature-flags.ts` before adding features

---

## Quick Reference

### Get item with procurement data:
```typescript
const item = await prisma.roomFFEItem.findUnique({
  where: { id: itemId },
  include: {
    acceptedQuoteLineItem: {
      include: { supplierQuote: true }
    },
    allQuoteLineItems: true,
    orderItems: { include: { order: true } },
    activities: { orderBy: { createdAt: 'desc' } }
  }
});
```

### Check if item is fully procured:
```typescript
const isFullyProcured =
  item.specStatus === 'DELIVERED' ||
  item.specStatus === 'INSTALLED' ||
  item.specStatus === 'CLOSED';
```

### Get items ready for ordering:
```typescript
const readyItems = await prisma.roomFFEItem.findMany({
  where: {
    specStatus: 'CLIENT_PAID',
    orderItems: { none: {} }  // Not yet ordered
  }
});
```

---

## Related Documentation

### FFE Detailed Docs (this folder)
- `ffe/ADDING_ITEMS.md` - All methods to add items (Chrome extension, URL, AI, templates)
- `ffe/WORKSPACE_AND_VISIBILITY.md` - Workspace vs All Specs, visibility system, sections
- `ffe/SHARING_AND_EXPORT.md` - Share links, PDF generation, CSV export, spec books
- `ffe/SUPPLIER_INTEGRATION.md` - Supplier linking, phonebook, quote requests
- `ffe/LINKED_ITEMS_AND_OPTIONS.md` - Spec options, components, parent-child items

### Procurement Detailed Docs (this folder)
- `procurement/CURRENCY_HANDLING.md` - USD/CAD multi-currency handling
- `procurement/STATUS_WORKFLOW.md` - Status sync and workflow progression
- `procurement/QUOTE_MANAGEMENT.md` - Quote versioning, acceptance, comparison
- `procurement/PAYMENT_TRACKING.md` - Payment status and reconciliation
- `procurement/PORTALS.md` - Supplier and client portal systems

### Other Reference (parent docs folder)
- `../FFE_API_ROUTES.md` - Complete API endpoint reference
- `../FFE_SYSTEM_USER_GUIDE.md` - User-facing documentation
- `prisma/schema.prisma` - Full database schema

---

*Last updated: January 2025*

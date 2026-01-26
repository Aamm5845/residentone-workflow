# FFE Supplier Integration Guide

> **For AI Agencies**: This document covers how suppliers connect to FFE items.

---

## Overview

Suppliers integrate with FFE at multiple levels:

| Level | Purpose | Data |
|-------|---------|------|
| **Item Level** | Product source | supplierId, supplierName, supplierLink |
| **Quote Level** | Pricing quotes | SupplierQuote, SupplierQuoteLineItem |
| **Order Level** | Purchase orders | Order, OrderItem |
| **Phonebook** | Supplier database | Supplier model |

---

## Supplier Fields on FFE Items

### RoomFFEItem Supplier Fields

```prisma
model RoomFFEItem {
  // Supplier Reference
  supplierId          String?   // FK to Supplier (phonebook)
  supplierName        String?   // Display name
  supplierLink        String?   // Product page URL

  // Product Identification
  brand               String?
  sku                 String?
  modelNumber         String?

  // Pricing (from supplier)
  tradePrice          Decimal?  // What we pay
  tradePriceCurrency  String?   @default("CAD")
  rrp                 Decimal?  // Retail price
  rrpCurrency         String?   @default("CAD")
  markupPercent       Decimal?  // Client markup

  // Availability
  leadTime            String?   // "2-4 weeks"

  // Quote Tracking
  acceptedQuoteLineItemId String? @unique  // Accepted quote
}
```

### Setting Supplier on Item

```typescript
// Manual assignment
await prisma.roomFFEItem.update({
  where: { id: itemId },
  data: {
    supplierId: 'supplier-uuid',
    supplierName: 'Design Within Reach',
    supplierLink: 'https://dwr.com/product/123',
    tradePrice: 450,
    tradePriceCurrency: 'USD'
  }
});

// Via quote acceptance (automatic)
// When accepting quote, supplier info copied from quote
```

---

## Supplier Phonebook

### Supplier Model

```prisma
model Supplier {
  id              String    @id
  orgId           String
  name            String
  contactName     String
  email           String
  emails          Json?     // Additional emails

  // Category
  categoryId      String?
  category        SupplierCategory?

  // Contact
  phone           String?
  address         String?
  website         String?
  logo            String?
  notes           String?

  // Defaults
  currency        String    @default("CAD")
  markupPercent   Decimal?  // Default markup

  // Status
  isActive        Boolean   @default(true)

  // Portal Access
  hasPortalAccess Boolean   @default(false)
  portalPassword  String?   // Hashed
  portalLastLogin DateTime?

  // Relations
  ffeItems        RoomFFEItem[]
  supplierRFQs    SupplierRFQ[]
  orders          Order[]
  quoteRequests   ItemQuoteRequest[]
}
```

### Supplier Category

```prisma
model SupplierCategory {
  id          String    @id
  orgId       String
  name        String
  icon        String?   // Icon name
  color       String?   // Hex color
  isDefault   Boolean   @default(false)
  isActive    Boolean   @default(true)
  sortOrder   Int       @default(0)
  suppliers   Supplier[]
}
```

### Phonebook Endpoints

**List Suppliers**
```
GET /api/suppliers
GET /api/suppliers?category=lighting
GET /api/suppliers?search=tom+dixon
GET /api/suppliers?active=true
```

**Create Supplier**
```
POST /api/suppliers
```

```typescript
{
  name: string,
  contactName: string,
  email: string,
  emails?: string[],
  categoryId?: string,
  phone?: string,
  address?: string,
  website?: string,
  logo?: string,
  currency?: "CAD" | "USD",
  markupPercent?: number,
  notes?: string
}
```

**Update Supplier**
```
PATCH /api/suppliers/[id]
```

Currency change syncs to linked items:
```typescript
// When supplier currency changes, update all linked items
if (data.currency !== existingSupplier.currency) {
  await prisma.roomFFEItem.updateMany({
    where: { supplierId },
    data: {
      tradePriceCurrency: data.currency,
      rrpCurrency: data.currency
    }
  });
}
```

**Delete Supplier**
```
DELETE /api/suppliers/[id]
```

### Category Endpoints

```
GET /api/supplier-categories
POST /api/supplier-categories
DELETE /api/supplier-categories/[id]
```

---

## Quote Requests

### From Item Detail

When viewing an item, users can request quotes directly.

### ItemQuoteRequest Model

```prisma
model ItemQuoteRequest {
  id              String    @id
  itemId          String
  item            RoomFFEItem

  // Supplier (either from phonebook OR one-time)
  supplierId      String?
  supplier        Supplier?
  vendorEmail     String?   // One-time vendor
  vendorName      String?

  // RFQ Link (if part of bulk RFQ)
  rfqId           String?
  supplierRfqId   String?

  // Status
  status          QuoteRequestStatus  // SENT, VIEWED, QUOTED, DECLINED, EXPIRED
  sentAt          DateTime
  sentById        String
  respondedAt     DateTime?

  // Response
  quoteAmount     Decimal?
  quoteId         String?   // Link to SupplierQuote

  // Resend
  isResend        Boolean   @default(false)
  previousRequestId String?

  @@unique([itemId, supplierId, isResend])
}

enum QuoteRequestStatus {
  SENT
  VIEWED
  QUOTED
  DECLINED
  EXPIRED
}
```

### Quote Request Flow

```
1. User clicks "Request Quote" on item
2. Selects supplier(s) from phonebook OR enters one-time email
3. System creates ItemQuoteRequest
4. Email sent with item details
5. Supplier responds (quote or decline)
6. Quote attached to item for comparison
```

### API Endpoint

```
POST /api/procurement/quote-requests
```

```typescript
{
  itemId: string,

  // Supplier (one of):
  supplierId?: string,       // From phonebook
  vendorEmail?: string,      // One-time vendor
  vendorName?: string,

  // Optional message
  message?: string
}
```

---

## RFQ (Request for Quote) System

### Bulk Quote Requests

For quoting multiple items at once, use the RFQ system.

### RFQ Model

```prisma
model RFQ {
  id              String    @id
  orgId           String
  projectId       String
  rfqNumber       String    @unique  // RFQ-YYYY-###
  title           String
  description     String?

  // Status
  status          RFQStatus  // DRAFT, SENT, QUOTED, CLOSED

  // Timing
  validUntil      DateTime?
  responseDeadline DateTime?
  sentAt          DateTime?
  sentById        String?

  // Relations
  lineItems       RFQLineItem[]
  supplierRfqs    SupplierRFQ[]
  documents       RFQDocument[]
}
```

### RFQ Line Item

```prisma
model RFQLineItem {
  id              String    @id
  rfqId           String
  roomFFEItemId   String?   // Link to spec item

  // Item snapshot (at time of RFQ)
  itemName        String
  itemDescription String?
  quantity        Int
  unitType        String?
  specifications  Json?

  // Target pricing
  targetUnitPrice Decimal?
  targetTotalPrice Decimal?
  notes           String?

  // Relations
  quoteLineItems  SupplierQuoteLineItem[]
}
```

### Creating an RFQ

```
POST /api/rfq
```

```typescript
{
  projectId: string,
  title: string,
  description?: string,
  validUntil?: string,
  responseDeadline?: string,

  // Items to quote
  lineItems: Array<{
    roomFFEItemId: string,
    quantity: number,
    notes?: string
  }>,

  // Suppliers to send to
  supplierIds: string[],

  // Attachments
  documentIds?: string[]
}
```

### RFQ Number Generation
```typescript
// Format: RFQ-YYYY-###
const year = new Date().getFullYear();
const count = await prisma.rFQ.count({
  where: { rfqNumber: { startsWith: `RFQ-${year}` } }
});
const rfqNumber = `RFQ-${year}-${String(count + 1).padStart(3, '0')}`;
```

---

## Supplier Portal

### How It Works

1. RFQ sent to supplier
2. Supplier receives email with unique portal link
3. Supplier views RFQ details without login
4. Supplier submits quote through portal
5. Quote automatically linked to items

### SupplierRFQ Model

```prisma
model SupplierRFQ {
  id              String    @id
  rfqId           String

  // Supplier
  supplierId      String?
  vendorName      String?
  vendorEmail     String
  vendorPhone     String?
  vendorCompany   String?

  // Portal Access
  accessToken     String    @unique
  tokenExpiresAt  DateTime?
  sentAt          DateTime?
  viewedAt        DateTime?
  lastAccessedAt  DateTime?
  accessCount     Int       @default(0)

  // Response
  status          SupplierRFQStatus  // PENDING, SUBMITTED, DECLINED

  // Relations
  quotes          SupplierQuote[]
  accessLogs      SupplierAccessLog[]
}
```

### Portal Endpoint

```
GET /api/supplier-portal/[token]
```

Returns:
- RFQ details
- Line items with specs
- Documents (if visible)
- Project info

### Access Logging

```prisma
model SupplierAccessLog {
  id              String    @id
  supplierRFQId   String
  ipAddress       String?
  userAgent       String?
  action          String    // 'viewed', 'downloaded', 'submitted'
  timestamp       DateTime
}
```

Every portal access creates a log entry for audit.

### Quote Submission

```
POST /api/supplier-portal/[token]/quote
```

```typescript
{
  // Quote totals
  subtotal: number,
  taxAmount?: number,
  shippingCost?: number,
  totalAmount: number,
  currency: "CAD" | "USD",

  // Terms
  validUntil: string,
  paymentTerms?: string,
  estimatedLeadTime?: string,

  // Line items
  lineItems: Array<{
    rfqLineItemId: string,
    unitPrice: number,
    quantity: number,
    availability?: string,
    leadTime?: string,
    notes?: string,

    // Alternate product (if different from requested)
    alternateProduct?: boolean,
    supplierSKU?: string,
    supplierModelNumber?: string
  }>,

  // Documents
  quoteDocumentUrl?: string
}
```

---

## Quote Acceptance

### Accepting a Quote

When a quote is accepted:

```typescript
import { acceptQuoteForItem } from '@/lib/procurement/status-sync';

await acceptQuoteForItem(
  roomFFEItemId,
  supplierQuoteLineItemId,
  userId,
  markupPercent  // Optional
);
```

### What Happens

1. Previous accepted quote cleared (`isAccepted: false`)
2. New quote marked accepted
3. RoomFFEItem updated:
   - `acceptedQuoteLineItemId` set
   - `tradePrice` from quote
   - `supplierId` from quote's supplier
   - `supplierName` from quote
   - `specStatus` → `QUOTE_APPROVED`
   - `markupPercent` saved
4. Activity logged

### Multiple Quotes Comparison

```typescript
const quotes = await getItemQuotes(roomFFEItemId);

// Returns all quotes with comparison data
quotes.forEach(q => {
  console.log({
    supplier: q.supplierName,
    price: q.unitPrice,
    leadTime: q.leadTime,
    isLowestPrice: q.isLowestPrice,
    priceDifference: q.priceDifference  // vs lowest
  });
});
```

---

## Markup System

### Markup Hierarchy

1. **Item RRP** (if set): Use RRP directly, no calculation
2. **Approved Markup**: Markup set when accepting quote
3. **Item Markup**: `markupPercent` on item
4. **Category Markup**: Default for FFE category
5. **Supplier Markup**: Default for supplier
6. **System Default**: 25%

### Category Markup Settings

```prisma
model CategoryMarkup {
  id              String    @id
  orgId           String
  categoryName    String    // LIGHTING, FURNITURE, etc.
  markupPercent   Decimal
  description     String?
  isActive        Boolean   @default(true)

  @@unique([orgId, categoryName])
}
```

### Markup Calculation

```typescript
// From /src/lib/pricing.ts

// RRP from trade price + markup
function calculateRRPFromMarkup(tradePrice: number, markupPercent: number): number {
  return tradePrice * (1 + markupPercent / 100);
}

// Trade price from RRP - discount
function calculateTradePriceFromDiscount(rrp: number, discountPercent: number): number {
  return rrp * (1 - discountPercent / 100);
}

// Calculate markup percentage
function calculateMarkupPercent(tradePrice: number, rrp: number): number {
  return ((rrp - tradePrice) / tradePrice) * 100;
}
```

### Component Pricing
Components get parent's markup applied:

```typescript
function calculateComponentsRRP(components: Component[], markupPercent: number): number {
  const total = components.reduce((sum, c) => sum + (c.price * c.quantity), 0);
  return total * (1 + markupPercent / 100);
}
```

---

## Activity Timeline

### Item Activity Types

```typescript
enum ItemActivityType {
  // Quote events
  QUOTE_REQUESTED
  QUOTE_RECEIVED
  QUOTE_ACCEPTED
  QUOTE_DECLINED
  QUOTE_VIEWED

  // Status events
  STATUS_CHANGED
  ITEM_SELECTED

  // Price events
  PRICE_UPDATED

  // Client events
  CLIENT_APPROVED
  CLIENT_UNAPPROVED
  CLIENT_REJECTED

  // Order events
  ADDED_TO_ORDER
  ORDERED
  SHIPPED
  DELIVERED

  // Other
  NOTE_ADDED
  DOCUMENT_UPLOADED
  SENT_TO_CLIENT_QUOTE
  CLIENT_QUOTE_VIEWED
  CLIENT_QUOTE_PAID
}
```

### Logging Activity

```typescript
await prisma.itemActivity.create({
  data: {
    itemId: roomFFEItemId,
    type: 'QUOTE_ACCEPTED',
    title: 'Quote Accepted',
    description: `Quote from ${supplierName} accepted at $${unitPrice}`,
    actorId: userId,
    actorType: 'user',
    metadata: {
      supplierQuoteLineItemId,
      unitPrice,
      supplierName
    }
  }
});
```

### Fetching Timeline

```
GET /api/ffe/v2/rooms/[roomId]/items/[itemId]/activity
```

Returns combined timeline of:
- ItemActivity records
- ItemQuoteRequest records
- RFQ responses

---

## Common Patterns

### Request Quote from Phonebook Supplier

```typescript
// 1. Get supplier from phonebook
const supplier = await prisma.supplier.findFirst({
  where: { name: { contains: 'Tom Dixon' } }
});

// 2. Create quote request
await fetch('/api/procurement/quote-requests', {
  method: 'POST',
  body: JSON.stringify({
    itemId: 'item-uuid',
    supplierId: supplier.id
  })
});
```

### Accept Quote and Set Markup

```typescript
import { acceptQuoteForItem } from '@/lib/procurement/status-sync';

await acceptQuoteForItem(
  itemId,
  quoteLineItemId,
  userId,
  30  // 30% markup
);
```

### Get All Quotes for Item

```typescript
import { getItemQuotes } from '@/lib/procurement/status-sync';

const quotes = await getItemQuotes(itemId);

// Find lowest price
const lowest = quotes.find(q => q.isLowestPrice);

// Find accepted
const accepted = quotes.find(q => q.isAccepted);
```

---

*Last updated: January 2025*

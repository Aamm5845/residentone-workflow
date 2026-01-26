# Quote Management Guide

> **For AI Agencies**: This document covers quote versioning, acceptance, and comparison.

---

## Overview

Each spec item can receive multiple quotes from multiple suppliers. The system tracks:
- Multiple quotes per item (for comparison)
- Quote versions (when same supplier re-quotes)
- Accepted quote (which one was chosen)
- Quote history and audit trail

---

## Data Model

### SupplierQuoteLineItem (The Core Quote Record)

```prisma
model SupplierQuoteLineItem {
  id                  String    @id

  // Links
  supplierQuoteId     String    // Parent quote document
  rfqLineItemId       String?   // Link through RFQ
  roomFFEItemId       String?   // Direct link to spec item

  // Pricing
  unitPrice           Decimal
  quantity            Int
  totalPrice          Decimal
  currency            String    @default("CAD")

  // Availability
  availability        String?   // "In Stock", "Backorder", etc.
  leadTimeWeeks       Int?
  leadTime            String?   // Freeform: "2-3 weeks"

  // Product Info
  itemName            String?
  supplierSKU         String?
  supplierModelNumber String?
  alternateProduct    Boolean   @default(false)  // Is this an alternative?

  // Match Verification
  matchApproved       Boolean   @default(false)  // Designer verified product match
  matchApprovedAt     DateTime?
  matchApprovedById   String?

  // Acceptance
  isAccepted          Boolean   @default(false)  // THE chosen quote
  acceptedAt          DateTime?
  acceptedById        String?
  approvedMarkupPercent Decimal?  // Markup when accepted

  // Versioning (same supplier, new quote)
  quoteVersion        Int       @default(1)
  isLatestVersion     Boolean   @default(true)
  previousVersionId   String?   // Link to superseded quote
}
```

### RoomFFEItem Quote Fields

```prisma
model RoomFFEItem {
  // The ONE accepted quote
  acceptedQuoteLineItemId  String?  @unique
  acceptedQuoteLineItem    SupplierQuoteLineItem?

  // ALL quotes for this item (for comparison)
  allQuoteLineItems        SupplierQuoteLineItem[]
}
```

---

## Quote Acceptance Flow

### Step 1: Get All Quotes for Item

```typescript
import { getItemQuotes } from '@/lib/procurement/status-sync';

const quotes = await getItemQuotes(roomFFEItemId);

// Returns:
[
  {
    quoteLineItemId: "uuid",
    supplierName: "Vendor A",
    unitPrice: 150,
    currency: "CAD",
    leadTime: "2 weeks",
    availability: "In Stock",
    isAccepted: false,
    isLatestVersion: true,
    quoteVersion: 1,
    priceDifference: 0,      // vs lowest
    percentDifference: 0,
    isLowestPrice: true
  },
  {
    quoteLineItemId: "uuid2",
    supplierName: "Vendor B",
    unitPrice: 165,
    currency: "CAD",
    priceDifference: 15,
    percentDifference: 10,
    isLowestPrice: false
  }
]
```

### Step 2: Accept a Quote

```typescript
import { acceptQuoteForItem } from '@/lib/procurement/status-sync';

const result = await acceptQuoteForItem(
  roomFFEItemId,
  supplierQuoteLineItemId,
  userId,
  markupPercent  // Optional: 25 for 25%
);

if (result.success) {
  // Quote accepted successfully
} else {
  console.error(result.error);
}
```

### What Happens on Acceptance

```typescript
// Inside acceptQuoteForItem:

// 1. Clear previous accepted quote
await tx.supplierQuoteLineItem.updateMany({
  where: { roomFFEItemId, isAccepted: true },
  data: { isAccepted: false }
});

// 2. Mark new quote as accepted
await tx.supplierQuoteLineItem.update({
  where: { id: supplierQuoteLineItemId },
  data: {
    isAccepted: true,
    acceptedAt: new Date(),
    acceptedById: userId,
    matchApproved: true,
    roomFFEItemId,  // Ensure direct link
  }
});

// 3. Update RoomFFEItem
await tx.roomFFEItem.update({
  where: { id: roomFFEItemId },
  data: {
    acceptedQuoteLineItemId: supplierQuoteLineItemId,
    tradePrice: quoteLineItem.unitPrice,
    supplierId: supplierRFQ.supplierId,
    supplierName: supplierRFQ.vendorName,
    specStatus: 'QUOTE_APPROVED'
  }
});

// 4. Log activity
await tx.itemActivity.create({
  data: {
    itemId: roomFFEItemId,
    type: 'QUOTE_ACCEPTED',
    title: 'Quote Accepted',
    description: `Quote accepted at $${unitPrice}`,
    actorId: userId,
    metadata: { supplierQuoteLineItemId, unitPrice, supplierName }
  }
});
```

---

## Quote Versioning

When the same supplier sends a new quote for the same item:

### Automatic Version Tracking

```typescript
import { handleNewQuoteVersion } from '@/lib/procurement/status-sync';

// Call this when processing incoming quote
await handleNewQuoteVersion(
  newQuoteLineItemId,
  roomFFEItemId,
  supplierId,      // Can be null for one-time vendors
  vendorName
);
```

### What Happens

```typescript
// Find existing quote from same supplier
const existingQuote = await prisma.supplierQuoteLineItem.findFirst({
  where: {
    roomFFEItemId,
    isLatestVersion: true,
    supplierQuote: { supplierRFQ: { supplierId } }
  }
});

if (existingQuote) {
  // Mark old as not latest
  await tx.supplierQuoteLineItem.update({
    where: { id: existingQuote.id },
    data: { isLatestVersion: false }
  });

  // Link new to old
  await tx.supplierQuoteLineItem.update({
    where: { id: newQuoteLineItemId },
    data: {
      previousVersionId: existingQuote.id,
      quoteVersion: existingQuote.quoteVersion + 1,
      isLatestVersion: true
    }
  });
}
```

### Version Chain

```
Quote v1 (2024-01-01) ← previousVersionId ← Quote v2 (2024-01-15) ← Quote v3 (2024-02-01)
isLatestVersion: false    isLatestVersion: false     isLatestVersion: true
```

---

## Match Verification

Before accepting a quote, verify the product matches the spec:

### Why Match Verification?

Suppliers may quote:
- Exact product requested ✓
- Equivalent product (different brand/model)
- Alternative product (different specs)
- Wrong product entirely

### Verification Flow

```typescript
// 1. Check if match needs verification
if (!quoteLineItem.matchApproved && !quoteLineItem.alternateProduct) {
  // Show verification UI
}

// 2. Approve match
await prisma.supplierQuoteLineItem.update({
  where: { id: quoteLineItemId },
  data: {
    matchApproved: true,
    matchApprovedAt: new Date(),
    matchApprovedById: userId
  }
});

// 3. Or mark as alternate
await prisma.supplierQuoteLineItem.update({
  where: { id: quoteLineItemId },
  data: {
    alternateProduct: true,
    matchApproved: true  // Still approved, but flagged as alternate
  }
});
```

---

## Quote Comparison UI

### Data Structure for Comparison

```typescript
interface QuoteComparison {
  itemId: string;
  itemName: string;
  requestedQty: number;

  quotes: Array<{
    quoteLineItemId: string;
    supplierName: string;

    // Pricing
    unitPrice: number;
    totalPrice: number;
    currency: string;

    // Comparison
    priceDifference: number;  // vs lowest
    percentDifference: number;
    isLowestPrice: boolean;

    // Availability
    leadTime: string;
    availability: string;

    // Status
    isAccepted: boolean;
    matchApproved: boolean;
    alternateProduct: boolean;

    // Version
    quoteVersion: number;
    isLatestVersion: boolean;
  }>;
}
```

### Display Table

```
| Supplier    | Price      | Lead Time | Status      | Actions      |
|-------------|------------|-----------|-------------|--------------|
| Vendor A ✓  | $150.00    | 2 weeks   | ✓ Accepted  | [Change]     |
| Vendor B    | $165.00    | 4 weeks   | Pending     | [Accept]     |
|             | (+10%)     |           |             |              |
| Vendor C    | $145.00    | 6 weeks   | Alternate   | [Accept]     |
| (Lowest)    |            |           |             |              |
```

---

## Changing Accepted Quote

When switching to a different quote:

```typescript
// Use acceptQuoteForItem - it handles the switch automatically
const result = await acceptQuoteForItem(
  roomFFEItemId,
  newQuoteLineItemId,  // Different quote
  userId
);

// This will:
// 1. Unaccept the old quote (isAccepted: false)
// 2. Accept the new quote
// 3. Update RoomFFEItem with new pricing
// 4. Log the change
```

---

## API Endpoints

### Get Quotes for Item

```
GET /api/projects/[id]/procurement/items/[itemId]/quotes

Response:
{
  itemId: "uuid",
  itemName: "Pendant Light",
  quotes: [
    {
      quoteLineItemId: "uuid",
      supplierName: "Vendor A",
      unitPrice: 150,
      isAccepted: true,
      ...
    }
  ]
}
```

### Accept Quote

```
POST /api/projects/[id]/procurement/supplier-quotes/accept

Body:
{
  roomFFEItemId: "uuid",
  supplierQuoteLineItemId: "uuid",
  markupPercent: 25
}

Response:
{ success: true }
```

### Approve Match

```
POST /api/projects/[id]/procurement/supplier-quotes/approve-match

Body:
{
  supplierQuoteLineItemId: "uuid",
  isAlternate: false
}
```

---

## Query Examples

### Get All Accepted Quotes for Project

```typescript
const acceptedQuotes = await prisma.supplierQuoteLineItem.findMany({
  where: {
    isAccepted: true,
    roomFFEItem: {
      section: {
        instance: {
          room: { projectId }
        }
      }
    }
  },
  include: {
    roomFFEItem: true,
    supplierQuote: {
      include: { supplierRFQ: true }
    }
  }
});
```

### Get Quote History for Item

```typescript
const quoteHistory = await prisma.supplierQuoteLineItem.findMany({
  where: { roomFFEItemId: itemId },
  orderBy: [
    { supplierQuote: { supplierRFQ: { vendorName: 'asc' } } },
    { quoteVersion: 'desc' }
  ]
});
```

### Find Items Without Accepted Quotes

```typescript
const needsQuoteAcceptance = await prisma.roomFFEItem.findMany({
  where: {
    specStatus: 'QUOTE_RECEIVED',
    acceptedQuoteLineItemId: null,
    allQuoteLineItems: { some: {} }  // Has quotes but none accepted
  }
});
```

---

## Common Mistakes

1. **Not setting direct roomFFEItemId link**
   ```typescript
   // BAD - Only linked through RFQ
   await prisma.supplierQuoteLineItem.create({
     data: { rfqLineItemId: rfqLineId }
   });

   // GOOD - Set direct link
   await prisma.supplierQuoteLineItem.create({
     data: {
       rfqLineItemId: rfqLineId,
       roomFFEItemId: itemId  // Direct link!
     }
   });
   ```

2. **Forgetting to handle version superseding**
   ```typescript
   // BAD - New quote without version handling
   await prisma.supplierQuoteLineItem.create({ ... });

   // GOOD
   const quote = await prisma.supplierQuoteLineItem.create({ ... });
   await handleNewQuoteVersion(quote.id, itemId, supplierId, vendorName);
   ```

3. **Not updating item when accepting quote**
   ```typescript
   // BAD - Only marking quote as accepted
   await prisma.supplierQuoteLineItem.update({
     data: { isAccepted: true }
   });

   // GOOD - Use the full acceptance function
   await acceptQuoteForItem(itemId, quoteId, userId);
   ```

---

*Last updated: January 2025*

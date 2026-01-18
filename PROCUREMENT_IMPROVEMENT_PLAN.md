# Procurement Flow Improvement Plan

## Problem Statement

Each item in All Spec needs a complete procurement flow with:
- Multiple quotes tracking (original vs alternatives)
- Clear "accepted quote" designation
- Status synchronization across the entire chain
- Component-level quote tracking

---

## Phase 1: Schema Changes

### 1.1 Add "Accepted Quote" Reference to RoomFFEItem

```prisma
model RoomFFEItem {
  // ... existing fields ...

  // NEW: Active quote tracking
  acceptedQuoteLineItemId    String?   // The SupplierQuoteLineItem that was accepted
  acceptedQuoteLineItem      SupplierQuoteLineItem? @relation("AcceptedQuote", fields: [acceptedQuoteLineItemId], references: [id])

  // NEW: All quotes for this item (for comparison)
  allQuoteLineItems          SupplierQuoteLineItem[] @relation("ItemQuotes")

  // NEW: Client quote tracking
  activeClientQuoteLineItemId String?
  activeClientQuoteLineItem   ClientQuoteLineItem? @relation("ActiveClientQuote", fields: [activeClientQuoteLineItemId], references: [id])

  // NEW: Order tracking
  activeOrderItemId          String?
  activeOrderItem            OrderItem? @relation("ActiveOrder", fields: [activeOrderItemId], references: [id])

  // NEW: Payment status (denormalized for quick access)
  paymentStatus              ItemPaymentStatus @default(NOT_INVOICED)
  paidAmount                 Decimal?
  paidAt                     DateTime?
}

enum ItemPaymentStatus {
  NOT_INVOICED      // No client quote sent
  INVOICED          // Client quote sent, awaiting payment
  DEPOSIT_PAID      // Partial payment received
  FULLY_PAID        // Full payment received
  REFUNDED          // Payment refunded
}
```

### 1.2 Add Direct Item Reference to SupplierQuoteLineItem

```prisma
model SupplierQuoteLineItem {
  // ... existing fields ...

  // NEW: Direct link to All Spec item (in addition to RFQ line item)
  roomFFEItemId              String?
  roomFFEItem                RoomFFEItem? @relation("ItemQuotes", fields: [roomFFEItemId], references: [id])

  // NEW: Is this the accepted quote for this item?
  isAccepted                 Boolean @default(false)
  acceptedAt                 DateTime?
  acceptedById               String?

  // NEW: Quote comparison fields
  quoteVersion               Int @default(1)  // For same supplier revisions
  isLatestVersion            Boolean @default(true)
  previousVersionId          String?
  previousVersion            SupplierQuoteLineItem? @relation("QuoteVersions", fields: [previousVersionId], references: [id])
  newerVersions              SupplierQuoteLineItem[] @relation("QuoteVersions")
}
```

### 1.3 Add Component Quote Tracking

```prisma
model ItemComponent {
  // ... existing fields ...

  // NEW: Quote tracking for components
  acceptedQuoteLineItemId    String?
  acceptedQuoteLineItem      SupplierQuoteLineItem? @relation("ComponentQuote", fields: [acceptedQuoteLineItemId], references: [id])

  quotedPrice                Decimal?  // Price from accepted quote
  quotedAt                   DateTime?
}

model SupplierQuoteLineItem {
  // ... existing fields ...

  // NEW: Component support
  componentId                String?
  component                  ItemComponent? @relation("ComponentQuote", fields: [componentId], references: [id])
  isComponentQuote           Boolean @default(false)
}
```

---

## Phase 2: Quote Acceptance Logic

### 2.1 Accept Quote Endpoint

Create/update endpoint: `POST /api/projects/[id]/procurement/supplier-quotes/accept`

```typescript
// When accepting a quote for an item:
async function acceptQuoteForItem(
  roomFFEItemId: string,
  supplierQuoteLineItemId: string,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    // 1. Mark previous accepted quote as not accepted
    await tx.supplierQuoteLineItem.updateMany({
      where: {
        roomFFEItemId,
        isAccepted: true
      },
      data: { isAccepted: false }
    });

    // 2. Mark new quote as accepted
    const quoteLineItem = await tx.supplierQuoteLineItem.update({
      where: { id: supplierQuoteLineItemId },
      data: {
        isAccepted: true,
        acceptedAt: new Date(),
        acceptedById: userId,
        matchApproved: true,
        matchApprovedAt: new Date(),
        matchApprovedById: userId
      },
      include: { supplierQuote: true }
    });

    // 3. Update RoomFFEItem with accepted quote reference
    await tx.roomFFEItem.update({
      where: { id: roomFFEItemId },
      data: {
        acceptedQuoteLineItemId: supplierQuoteLineItemId,
        tradePrice: quoteLineItem.unitPrice,
        supplierId: quoteLineItem.supplierQuote.supplierId,
        specStatus: 'QUOTE_APPROVED'  // Auto-update status
      }
    });

    // 4. Log activity
    await tx.itemActivity.create({
      data: {
        itemId: roomFFEItemId,
        type: 'QUOTE_ACCEPTED',
        title: 'Quote Accepted',
        description: `Quote from ${quoteLineItem.supplierQuote.supplierName} accepted at $${quoteLineItem.unitPrice}`,
        actorId: userId,
        actorType: 'user'
      }
    });
  });
}
```

### 2.2 Quote Comparison View

Add API endpoint: `GET /api/projects/[id]/ffe-specs/[itemId]/quotes`

Returns all quotes for an item with comparison data:

```typescript
interface ItemQuoteComparison {
  itemId: string;
  itemName: string;
  quantity: number;

  quotes: Array<{
    quoteLineItemId: string;
    supplierName: string;
    supplierQuoteId: string;
    quoteNumber: string;

    unitPrice: Decimal;
    totalPrice: Decimal;
    currency: string;

    leadTime: string;
    availability: string;

    submittedAt: DateTime;
    isAccepted: boolean;
    acceptedAt?: DateTime;

    // Comparison helpers
    priceDifference: Decimal;  // vs lowest quote
    percentDifference: number;
  }>;

  acceptedQuote?: {
    quoteLineItemId: string;
    supplierName: string;
    unitPrice: Decimal;
  };
}
```

---

## Phase 3: Status Synchronization Engine

### 3.1 Status Update Rules

Create a status synchronization service that automatically updates `specStatus` based on procurement events:

```typescript
// src/lib/procurement/status-sync.ts

const STATUS_RULES: Record<string, FFESpecStatus> = {
  // Trigger → New Status
  'rfq_sent': 'RFQ_SENT',
  'quote_received': 'QUOTE_RECEIVED',
  'quote_accepted': 'QUOTE_APPROVED',
  'added_to_client_quote': 'QUOTE_APPROVED',
  'client_quote_sent': 'BUDGET_SENT',
  'client_approved': 'BUDGET_APPROVED',
  'invoice_created': 'INVOICED_TO_CLIENT',
  'payment_received': 'CLIENT_PAID',
  'order_created': 'ORDERED',
  'order_shipped': 'SHIPPED',
  'order_delivered': 'RECEIVED',
  'installed': 'INSTALLED',
  'completed': 'CLOSED'
};

async function syncItemStatus(
  itemId: string,
  trigger: string,
  tx?: PrismaTransactionClient
) {
  const db = tx || prisma;

  const newStatus = STATUS_RULES[trigger];
  if (!newStatus) return;

  const item = await db.roomFFEItem.findUnique({
    where: { id: itemId },
    select: { specStatus: true }
  });

  // Only update if moving forward in workflow
  const statusOrder = Object.values(STATUS_RULES);
  const currentIndex = statusOrder.indexOf(item.specStatus);
  const newIndex = statusOrder.indexOf(newStatus);

  if (newIndex > currentIndex) {
    await db.roomFFEItem.update({
      where: { id: itemId },
      data: { specStatus: newStatus }
    });

    // Log status change
    await db.itemActivity.create({
      data: {
        itemId,
        type: 'STATUS_CHANGED',
        title: 'Status Updated',
        description: `Status changed to ${newStatus}`,
        actorType: 'system'
      }
    });
  }
}
```

### 3.2 Bulk Status Updates

When client pays an invoice, update all items in that invoice:

```typescript
async function onPaymentReceived(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      clientQuote: {
        include: {
          lineItems: {
            select: { roomFFEItemId: true }
          }
        }
      }
    }
  });

  // Determine payment type
  const isFullPayment = payment.amount >= payment.clientQuote.totalAmount;
  const newPaymentStatus = isFullPayment ? 'FULLY_PAID' : 'DEPOSIT_PAID';

  // Update all items
  await prisma.$transaction(async (tx) => {
    for (const lineItem of payment.clientQuote.lineItems) {
      if (lineItem.roomFFEItemId) {
        await tx.roomFFEItem.update({
          where: { id: lineItem.roomFFEItemId },
          data: {
            paymentStatus: newPaymentStatus,
            paidAmount: { increment: payment.amount },
            paidAt: payment.paidAt
          }
        });

        await syncItemStatus(lineItem.roomFFEItemId, 'payment_received', tx);
      }
    }
  });
}
```

---

## Phase 4: Item Procurement Summary View

### 4.1 Add Procurement Summary to Item Detail

Create a unified view showing the complete procurement journey for each item:

```typescript
interface ItemProcurementSummary {
  item: {
    id: string;
    name: string;
    sku: string;
    specStatus: FFESpecStatus;
    paymentStatus: ItemPaymentStatus;
  };

  // RFQ Stage
  rfq: {
    status: 'not_requested' | 'sent' | 'quoted';
    rfqId?: string;
    rfqNumber?: string;
    sentAt?: DateTime;
    quotesReceived: number;
  };

  // Quote Stage
  quote: {
    status: 'no_quotes' | 'pending_review' | 'accepted';
    acceptedQuote?: {
      id: string;
      supplierName: string;
      unitPrice: Decimal;
      acceptedAt: DateTime;
    };
    alternativeQuotes: Array<{
      id: string;
      supplierName: string;
      unitPrice: Decimal;
    }>;
  };

  // Budget/Client Quote Stage
  budget: {
    status: 'not_quoted' | 'draft' | 'sent' | 'approved' | 'rejected';
    clientQuoteId?: string;
    clientQuoteNumber?: string;
    clientPrice?: Decimal;
    sentAt?: DateTime;
    approvedAt?: DateTime;
  };

  // Invoice/Payment Stage
  invoice: {
    status: 'not_invoiced' | 'invoiced' | 'deposit_paid' | 'fully_paid';
    invoiceId?: string;
    totalAmount?: Decimal;
    paidAmount?: Decimal;
    paidAt?: DateTime;
  };

  // Order Stage
  order: {
    status: 'not_ordered' | 'pending_payment' | 'ordered' | 'shipped' | 'delivered' | 'installed';
    orderId?: string;
    orderNumber?: string;
    poNumber?: string;
    orderedAt?: DateTime;
    expectedDelivery?: DateTime;
    actualDelivery?: DateTime;
    trackingNumber?: string;
  };

  // Timeline
  activities: ItemActivity[];
}
```

### 4.2 API Endpoint

`GET /api/projects/[id]/ffe-specs/[itemId]/procurement-summary`

---

## Phase 5: UI Components

### 5.1 Item Procurement Status Bar

A horizontal status bar showing the item's journey:

```
[RFQ] → [Quote] → [Budget] → [Invoice] → [Order] → [Delivered]
  ✓        ✓         ●          ○          ○          ○

Legend:
✓ = Completed
● = Current stage
○ = Pending
```

### 5.2 Quote Comparison Modal

When an item has multiple quotes, show a comparison table:

| Supplier | Unit Price | Lead Time | Availability | Actions |
|----------|------------|-----------|--------------|---------|
| **Supplier A** ✓ | $150.00 | 2 weeks | In Stock | Accepted |
| Supplier B | $165.00 (+10%) | 4 weeks | Backorder | [Accept] |
| Supplier C | $145.00 (-3%) | 6 weeks | Special Order | [Accept] |

### 5.3 All Specs List View Enhancement

Add procurement columns to the All Specs table:

| Item | Spec Status | Quote | Budget | Payment | Order |
|------|-------------|-------|--------|---------|-------|
| Chair A | QUOTE_APPROVED | ✓ $150 | Sent | — | — |
| Table B | ORDERED | ✓ $500 | ✓ Paid | ✓ Full | PO-2024-001 |

---

## Phase 6: Handling Edge Cases

### 6.1 Quote Supersedes Previous Quote

When a new quote comes in from the same supplier:

```typescript
async function handleNewQuoteFromSameSupplier(
  roomFFEItemId: string,
  newQuoteLineItemId: string,
  supplierId: string
) {
  // Find existing quote from same supplier
  const existingQuote = await prisma.supplierQuoteLineItem.findFirst({
    where: {
      roomFFEItemId,
      supplierQuote: { supplierId },
      isLatestVersion: true
    }
  });

  if (existingQuote) {
    await prisma.$transaction([
      // Mark old as not latest
      prisma.supplierQuoteLineItem.update({
        where: { id: existingQuote.id },
        data: { isLatestVersion: false }
      }),
      // Link new to old as newer version
      prisma.supplierQuoteLineItem.update({
        where: { id: newQuoteLineItemId },
        data: {
          previousVersionId: existingQuote.id,
          quoteVersion: existingQuote.quoteVersion + 1,
          isLatestVersion: true
        }
      })
    ]);

    // If old quote was accepted, prompt user to review new quote
    if (existingQuote.isAccepted) {
      // Create notification/task for review
    }
  }
}
```

### 6.2 Component Has Different Supplier Than Main Item

Allow components to be ordered separately:

```typescript
// When creating order, check if components need separate orders
async function createOrdersForItem(
  roomFFEItemId: string,
  clientQuoteLineItems: ClientQuoteLineItem[]
) {
  // Group by supplier
  const bySupplier = groupBy(clientQuoteLineItems, item => {
    return item.supplierQuote?.supplierId || 'unknown';
  });

  // Create separate order per supplier
  for (const [supplierId, items] of Object.entries(bySupplier)) {
    await createOrder(supplierId, items);
  }
}
```

### 6.3 Partial Item Payment

Track payment at item level when client pays partial:

```typescript
// Allocate payment across items proportionally
async function allocatePayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      clientQuote: {
        include: { lineItems: true }
      }
    }
  });

  const totalQuoteAmount = payment.clientQuote.totalAmount;
  const paymentRatio = payment.amount / totalQuoteAmount;

  for (const lineItem of payment.clientQuote.lineItems) {
    const itemPayment = lineItem.clientTotalPrice * paymentRatio;

    await prisma.roomFFEItem.update({
      where: { id: lineItem.roomFFEItemId },
      data: {
        paidAmount: { increment: itemPayment }
      }
    });
  }
}
```

---

## Implementation Priority

### High Priority (Do First)
1. **Schema changes** - Add `acceptedQuoteLineItemId`, `paymentStatus`, direct `roomFFEItemId` link
2. **Quote acceptance logic** - Clear accept/reject flow with status sync
3. **Status sync service** - Automatic status updates across procurement chain

### Medium Priority
4. **Quote comparison view** - See all quotes for an item
5. **Procurement summary API** - Single endpoint for complete item procurement status
6. **UI status bar** - Visual representation of item journey

### Lower Priority
7. **Quote versioning** - Track quote revisions from same supplier
8. **Component-level tracking** - Separate supplier/order handling for components
9. **Partial payment allocation** - Item-level payment tracking

---

## Database Migration Steps

1. Add new fields to `RoomFFEItem`:
   - `acceptedQuoteLineItemId`
   - `paymentStatus`
   - `paidAmount`
   - `paidAt`

2. Add new fields to `SupplierQuoteLineItem`:
   - `roomFFEItemId` (direct link)
   - `isAccepted`
   - `acceptedAt`
   - `acceptedById`
   - `quoteVersion`
   - `isLatestVersion`
   - `previousVersionId`

3. Add new fields to `ItemComponent`:
   - `acceptedQuoteLineItemId`
   - `quotedPrice`
   - `quotedAt`

4. Backfill existing data:
   - For items with existing quotes, set `roomFFEItemId` on quote line items
   - For items with `tradePrice` set, find matching quote and mark as accepted

---

## Summary

This plan addresses the core issues:

1. **Multiple Quotes** → `isAccepted` flag + `acceptedQuoteLineItemId` reference
2. **Quote History** → `quoteVersion` + `previousVersionId` chain
3. **Status Sync** → Automated status engine triggered by procurement events
4. **Component Tracking** → Component-level quote acceptance
5. **Payment Tracking** → `paymentStatus` + `paidAmount` on item

The key insight is that `RoomFFEItem.specStatus` should be the **single source of truth** for where an item is in the procurement workflow, and all other systems should update it automatically when their status changes.

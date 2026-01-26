# Procurement Status Workflow

> **For AI Agencies**: This document explains the status synchronization system.

---

## Overview

Every spec item (`RoomFFEItem`) has a `specStatus` field that tracks its position in the procurement workflow. This status is **automatically updated** by the status sync service when procurement events occur.

**Key File**: `src/lib/procurement/status-sync.ts`

---

## Status Progression

```
DRAFT → SELECTED → RFQ_SENT → QUOTE_RECEIVED → QUOTE_APPROVED →
BUDGET_SENT → BUDGET_APPROVED → INVOICED_TO_CLIENT → CLIENT_PAID →
ORDERED → SHIPPED → RECEIVED → DELIVERED → INSTALLED → CLOSED
```

### Visual Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PROCUREMENT WORKFLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────┐    ┌────────┐    ┌────────┐    ┌───────────────┐         │
│  │DRAFT │ →  │SELECTED│ →  │RFQ_SENT│ →  │QUOTE_RECEIVED │         │
│  └──────┘    └────────┘    └────────┘    └───────────────┘         │
│                                                  ↓                   │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────────┐         │
│  │QUOTE_APPROVED│ ←  │               │    │              │         │
│  └──────────────┘    └───────────────┘    └──────────────┘         │
│         ↓                                                           │
│  ┌───────────┐    ┌────────────────┐    ┌──────────────────┐       │
│  │BUDGET_SENT│ →  │BUDGET_APPROVED │ →  │INVOICED_TO_CLIENT│       │
│  └───────────┘    └────────────────┘    └──────────────────┘       │
│                                                  ↓                   │
│  ┌───────────┐    ┌───────┐    ┌────────┐    ┌──────────┐          │
│  │CLIENT_PAID│ →  │ORDERED│ →  │SHIPPED │ →  │RECEIVED  │          │
│  └───────────┘    └───────┘    └────────┘    └──────────┘          │
│                                                  ↓                   │
│  ┌─────────┐    ┌─────────┐    ┌──────┐                            │
│  │DELIVERED│ →  │INSTALLED│ →  │CLOSED│                            │
│  └─────────┘    └─────────┘    └──────┘                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Status Definitions

| Status | Description | Triggered By |
|--------|-------------|--------------|
| `DRAFT` | Initial state, item created | Item creation |
| `SELECTED` | Item selected for quoting | User selection |
| `RFQ_SENT` | RFQ sent to suppliers | `rfq_sent` trigger |
| `QUOTE_RECEIVED` | At least one quote received | `quote_received` trigger |
| `QUOTE_APPROVED` | Quote accepted by designer | `quote_accepted` trigger |
| `BUDGET_SENT` | Client quote sent | `client_quote_sent` trigger |
| `BUDGET_APPROVED` | Client approved quote | `client_approved` trigger |
| `INVOICED_TO_CLIENT` | Invoice sent to client | `invoice_sent` trigger |
| `CLIENT_PAID` | Client payment received | `payment_received` trigger |
| `ORDERED` | PO created with supplier | `order_created` trigger |
| `SHIPPED` | Order shipped | `order_shipped` trigger |
| `RECEIVED` | Order received at destination | `order_received` trigger |
| `DELIVERED` | Delivered to project site | `order_delivered` trigger |
| `INSTALLED` | Item installed | `installed` trigger |
| `CLOSED` | Procurement complete | `completed` trigger |

---

## Manual Statuses (Not Auto-Updated)

These statuses are set manually and are **never overwritten** by the sync service:

| Status | Purpose |
|--------|---------|
| `HIDDEN` | Item hidden from active tracking |
| `CLIENT_TO_ORDER` | Client will order directly |
| `CONTRACTOR_TO_ORDER` | Contractor will order |
| `NEED_SAMPLE` | Waiting for sample |
| `ISSUE` | Problem with item |
| `ARCHIVED` | Item archived |

---

## Status Sync Service

### Core Function: `syncItemStatus`

```typescript
import { syncItemStatus } from '@/lib/procurement/status-sync';

// Sync a single item
const result = await syncItemStatus(
  itemId,       // RoomFFEItem ID
  'rfq_sent',   // Trigger event
  userId,       // Optional: user who triggered
  tx            // Optional: Prisma transaction
);

// Result:
{
  itemId: string,
  previousStatus: FFESpecStatus,
  newStatus: FFESpecStatus,
  changed: boolean,
  reason?: string  // If not changed, explains why
}
```

### Bulk Update: `syncItemsStatus`

```typescript
import { syncItemsStatus } from '@/lib/procurement/status-sync';

// Sync multiple items
const results = await syncItemsStatus(
  ['item-1', 'item-2', 'item-3'],
  'payment_received',
  userId
);
```

### Available Triggers

```typescript
const STATUS_TRIGGERS = {
  'rfq_sent': 'RFQ_SENT',
  'quote_received': 'QUOTE_RECEIVED',
  'quote_accepted': 'QUOTE_APPROVED',
  'added_to_client_quote': 'QUOTE_APPROVED',
  'client_quote_sent': 'BUDGET_SENT',
  'client_approved': 'BUDGET_APPROVED',
  'invoice_sent': 'INVOICED_TO_CLIENT',
  'payment_received': 'CLIENT_PAID',
  'order_created': 'ORDERED',
  'order_shipped': 'SHIPPED',
  'order_received': 'RECEIVED',
  'order_delivered': 'DELIVERED',
  'installed': 'INSTALLED',
  'completed': 'CLOSED',
};
```

---

## Key Rules

### Rule 1: Forward-Only Progression

Status can only move **forward** in the workflow. The sync service will refuse to move backward:

```typescript
// Item is at ORDERED
syncItemStatus(itemId, 'quote_received');

// Result: { changed: false, reason: "QUOTE_RECEIVED is not ahead of ORDERED" }
```

### Rule 2: Manual Statuses are Sticky

If an item has a manual status, it won't be auto-updated:

```typescript
// Item status is ISSUE
syncItemStatus(itemId, 'order_created');

// Result: { changed: false, reason: "Current status ISSUE is a manual status" }
```

### Rule 3: Activity Logging

Every status change creates an `ItemActivity` record:

```typescript
// Automatically created:
{
  itemId: itemId,
  type: 'STATUS_CHANGED',
  title: 'Status Updated',
  description: 'Status changed from ORDERED to SHIPPED (trigger: order_shipped)',
  actorId: userId,
  actorType: 'user' | 'system'
}
```

---

## Integration Examples

### When Sending RFQ

```typescript
// In RFQ send API route
await prisma.$transaction(async (tx) => {
  // 1. Create/update RFQ records
  await tx.supplierRFQ.update({
    where: { id: supplierRfqId },
    data: { sentAt: new Date(), status: 'SENT' }
  });

  // 2. Sync status for all items in RFQ
  const lineItems = await tx.rFQLineItem.findMany({
    where: { rfqId },
    select: { roomFFEItemId: true }
  });

  for (const li of lineItems) {
    if (li.roomFFEItemId) {
      await syncItemStatus(li.roomFFEItemId, 'rfq_sent', userId, tx);
    }
  }
});
```

### When Quote is Received

```typescript
// In supplier portal quote submission
await prisma.$transaction(async (tx) => {
  // 1. Create supplier quote
  const quote = await tx.supplierQuote.create({ ... });

  // 2. Sync status for quoted items
  for (const lineItem of quote.lineItems) {
    if (lineItem.roomFFEItemId) {
      await syncItemStatus(lineItem.roomFFEItemId, 'quote_received', null, tx);
    }
  }
});
```

### When Quote is Accepted

```typescript
// Use the dedicated function
import { acceptQuoteForItem } from '@/lib/procurement/status-sync';

const result = await acceptQuoteForItem(
  roomFFEItemId,
  supplierQuoteLineItemId,
  userId,
  markupPercent  // Optional
);

// This automatically:
// 1. Marks previous quote as not accepted
// 2. Marks new quote as accepted
// 3. Updates RoomFFEItem with quote info
// 4. Syncs status to QUOTE_APPROVED
// 5. Logs activity
```

### When Payment is Received

```typescript
// In payment webhook/handler
await prisma.$transaction(async (tx) => {
  // 1. Create payment record
  await tx.payment.create({ ... });

  // 2. Get all items in this invoice
  const lineItems = await tx.clientQuoteLineItem.findMany({
    where: { clientQuoteId: invoiceId },
    select: { roomFFEItemId: true }
  });

  // 3. Update payment status and sync procurement status
  for (const li of lineItems) {
    if (li.roomFFEItemId) {
      await updateItemPaymentStatus(
        li.roomFFEItemId,
        'FULLY_PAID',
        paymentAmount,
        tx
      );
      await syncItemStatus(li.roomFFEItemId, 'payment_received', null, tx);
    }
  }
});
```

---

## Checking Status

### Get Procurement Summary

```typescript
import { getItemProcurementSummary } from '@/lib/procurement/status-sync';

const summary = await getItemProcurementSummary(itemId);

// Returns:
{
  item: { id, name, specStatus, paymentStatus },
  rfq: { status, quotesReceived },
  quote: { status, acceptedQuote, alternativeQuotes },
  budget: { status, clientPrice, sentAt },
  invoice: { status, paidAmount, paidAt },
  order: { status, orderNumber, trackingNumber },
  activities: [...]
}
```

### Query by Status

```typescript
// Get all items ready for ordering
const readyToOrder = await prisma.roomFFEItem.findMany({
  where: {
    specStatus: 'CLIENT_PAID',
    orderItems: { none: {} }
  }
});

// Get items with issues
const issues = await prisma.roomFFEItem.findMany({
  where: {
    specStatus: { in: ['ISSUE', 'NEED_SAMPLE'] }
  }
});
```

---

## Debugging

### Why Didn't Status Change?

```typescript
const result = await syncItemStatus(itemId, trigger);

if (!result.changed) {
  console.log('Status not changed:', result.reason);
  // Possible reasons:
  // - "Unknown trigger: xyz"
  // - "Item not found"
  // - "Current status ISSUE is a manual status"
  // - "New status X is not ahead of current status Y"
}
```

### Check Status History

```typescript
const activities = await prisma.itemActivity.findMany({
  where: {
    itemId,
    type: 'STATUS_CHANGED'
  },
  orderBy: { createdAt: 'desc' }
});
```

---

## Common Mistakes

1. **Forgetting to call sync after procurement events**
   ```typescript
   // BAD - Quote created but status not synced
   await prisma.supplierQuote.create({ ... });

   // GOOD
   await prisma.supplierQuote.create({ ... });
   await syncItemStatus(itemId, 'quote_received');
   ```

2. **Trying to force status backward**
   ```typescript
   // BAD - This won't work
   await syncItemStatus(itemId, 'rfq_sent'); // Item already at ORDERED

   // GOOD - Use manual status override if needed
   await prisma.roomFFEItem.update({
     where: { id: itemId },
     data: { specStatus: 'ISSUE' }  // Manual status
   });
   ```

3. **Not using transactions**
   ```typescript
   // BAD - Race conditions possible
   await prisma.order.create({ ... });
   await syncItemStatus(itemId, 'order_created');

   // GOOD - Atomic operation
   await prisma.$transaction(async (tx) => {
     await tx.order.create({ ... });
     await syncItemStatus(itemId, 'order_created', userId, tx);
   });
   ```

---

*Last updated: January 2025*

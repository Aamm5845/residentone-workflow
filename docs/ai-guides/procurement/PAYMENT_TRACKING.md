# Payment Tracking Guide

> **For AI Agencies**: This document covers payment status tracking at item and invoice levels.

---

## Overview

Payment is tracked at two levels:
1. **Invoice Level**: `Payment` model tracks actual payments received
2. **Item Level**: `RoomFFEItem.paymentStatus` tracks per-item payment state

---

## Data Models

### Payment Model

```prisma
model Payment {
  id              String    @id
  orgId           String
  clientQuoteId   String    // Link to invoice

  // Amount
  amount          Decimal
  currency        String    @default("CAD")

  // Status
  status          PaymentStatus  // PENDING, COMPLETED, FAILED, REFUNDED, DISPUTED

  // Method
  method          PaymentMethod  // CREDIT_CARD, WIRE_TRANSFER, CHECK, CASH, ACH

  // External References
  stripePaymentId   String?  // Stripe payment intent
  stripeChargeId    String?  // Stripe charge
  nuveiTransactionId String? // Nuvei transaction
  achTransactionId   String? // ACH transaction
  checkNumber        String? // Check number
  wireReference      String? // Wire transfer reference

  // Timestamps
  paidAt          DateTime?
  confirmedAt     DateTime?
  confirmedById   String?

  // Reconciliation
  reconciled      Boolean   @default(false)
  reconciledAt    DateTime?
  reconciledById  String?
  reconciledNotes String?
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
  DISPUTED
}

enum PaymentMethod {
  CREDIT_CARD
  WIRE_TRANSFER
  CHECK
  CASH
  ACH
  BANK_TRANSFER
}
```

### Item Payment Status

```prisma
model RoomFFEItem {
  paymentStatus    ItemPaymentStatus  @default(NOT_INVOICED)
  paidAmount       Decimal?
  paidAt           DateTime?
}

enum ItemPaymentStatus {
  NOT_INVOICED    // No client quote sent
  INVOICED        // Client quote sent, awaiting payment
  DEPOSIT_PAID    // Partial payment received
  FULLY_PAID      // Full payment received
  REFUNDED        // Payment refunded
}
```

---

## Payment Workflow

### Step 1: Invoice Sent

```typescript
// When client quote is sent
await prisma.$transaction(async (tx) => {
  // Update client quote
  await tx.clientQuote.update({
    where: { id: clientQuoteId },
    data: { sentToClientAt: new Date(), status: 'SENT' }
  });

  // Update all items to INVOICED
  const lineItems = await tx.clientQuoteLineItem.findMany({
    where: { clientQuoteId },
    select: { roomFFEItemId: true }
  });

  for (const li of lineItems) {
    if (li.roomFFEItemId) {
      await updateItemPaymentStatus(li.roomFFEItemId, 'INVOICED', undefined, tx);
    }
  }

  // Sync procurement status
  await syncItemsStatus(
    lineItems.map(li => li.roomFFEItemId).filter(Boolean),
    'invoice_sent',
    userId,
    tx
  );
});
```

### Step 2: Payment Received

```typescript
// When payment is received (webhook or manual)
await prisma.$transaction(async (tx) => {
  // 1. Create payment record
  const payment = await tx.payment.create({
    data: {
      orgId,
      clientQuoteId,
      amount: paymentAmount,
      currency: 'CAD',
      method: 'CREDIT_CARD',
      status: 'COMPLETED',
      stripePaymentId: stripeIntent.id,
      paidAt: new Date()
    }
  });

  // 2. Get invoice total
  const clientQuote = await tx.clientQuote.findUnique({
    where: { id: clientQuoteId },
    select: { totalAmount: true }
  });

  // 3. Determine payment type
  const isFullPayment = paymentAmount >= Number(clientQuote.totalAmount);
  const newStatus = isFullPayment ? 'FULLY_PAID' : 'DEPOSIT_PAID';

  // 4. Update all items
  const lineItems = await tx.clientQuoteLineItem.findMany({
    where: { clientQuoteId },
    include: { roomFFEItem: true }
  });

  for (const li of lineItems) {
    if (li.roomFFEItemId) {
      // Allocate payment proportionally
      const itemPayment = allocatePayment(
        paymentAmount,
        Number(li.clientTotalPrice),
        Number(clientQuote.totalAmount)
      );

      await tx.roomFFEItem.update({
        where: { id: li.roomFFEItemId },
        data: {
          paymentStatus: newStatus,
          paidAmount: { increment: itemPayment },
          paidAt: new Date()
        }
      });
    }
  }

  // 5. Sync procurement status
  await syncItemsStatus(
    lineItems.map(li => li.roomFFEItemId).filter(Boolean),
    'payment_received',
    null,
    tx
  );
});
```

### Step 3: Full Payment (if deposit was paid first)

```typescript
// When remaining balance is paid
const existingPayments = await prisma.payment.aggregate({
  where: { clientQuoteId },
  _sum: { amount: true }
});

const totalPaid = Number(existingPayments._sum.amount) + newPaymentAmount;
const isNowFullyPaid = totalPaid >= Number(clientQuote.totalAmount);

if (isNowFullyPaid) {
  // Update all items to FULLY_PAID
  await prisma.roomFFEItem.updateMany({
    where: {
      clientQuoteLineItems: { some: { clientQuoteId } }
    },
    data: { paymentStatus: 'FULLY_PAID' }
  });
}
```

---

## Payment Allocation

When partial payment is received, allocate proportionally:

```typescript
function allocatePayment(
  totalPayment: number,
  itemTotal: number,
  invoiceTotal: number
): number {
  if (invoiceTotal === 0) return 0;
  return (itemTotal / invoiceTotal) * totalPayment;
}

// Example:
// Invoice total: $1000
// Payment received: $500 (50%)
// Item A total: $300 → allocated: $150
// Item B total: $700 → allocated: $350
```

---

## Payment Methods

### Credit Card (Stripe)

```typescript
const payment = await prisma.payment.create({
  data: {
    method: 'CREDIT_CARD',
    stripePaymentId: 'pi_xxx',
    stripeChargeId: 'ch_xxx',
    status: 'COMPLETED'
  }
});
```

### Wire Transfer

```typescript
const payment = await prisma.payment.create({
  data: {
    method: 'WIRE_TRANSFER',
    wireReference: 'REF-2024-001',
    status: 'PENDING',  // Mark completed when confirmed
    paidAt: new Date()
  }
});

// Later, when confirmed:
await prisma.payment.update({
  where: { id: paymentId },
  data: {
    status: 'COMPLETED',
    confirmedAt: new Date(),
    confirmedById: userId
  }
});
```

### Check

```typescript
const payment = await prisma.payment.create({
  data: {
    method: 'CHECK',
    checkNumber: '1234',
    status: 'PENDING',  // Until check clears
    paidAt: new Date()
  }
});
```

### Cash

```typescript
const payment = await prisma.payment.create({
  data: {
    method: 'CASH',
    status: 'COMPLETED',
    paidAt: new Date()
  }
});
```

---

## Payment Reconciliation

Mark payments as reconciled for accounting:

```typescript
await prisma.payment.update({
  where: { id: paymentId },
  data: {
    reconciled: true,
    reconciledAt: new Date(),
    reconciledById: userId,
    reconciledNotes: 'Matched with bank statement 2024-01-15'
  }
});
```

---

## API Endpoints

### Record Payment

```
POST /api/projects/[id]/procurement/client-invoices/[invoiceId]/payment

Body:
{
  amount: 500.00,
  method: "CREDIT_CARD",
  stripePaymentId: "pi_xxx"
}
```

### Get Payment History

```
GET /api/projects/[id]/procurement/client-invoices/[invoiceId]/payments

Response:
{
  payments: [
    {
      id: "uuid",
      amount: 500,
      method: "CREDIT_CARD",
      status: "COMPLETED",
      paidAt: "2024-01-15T10:00:00Z"
    }
  ],
  totalPaid: 500,
  remainingBalance: 500
}
```

### Send Payment Reminder

```
POST /api/projects/[id]/procurement/client-invoices/[invoiceId]/reminder

Body:
{
  message: "Friendly reminder about your outstanding balance"
}
```

---

## Tracking Item Payment Status

### Query by Payment Status

```typescript
// Get all unpaid items for a project
const unpaidItems = await prisma.roomFFEItem.findMany({
  where: {
    section: {
      instance: { room: { projectId } }
    },
    paymentStatus: { in: ['NOT_INVOICED', 'INVOICED'] }
  }
});

// Get items with deposits
const depositItems = await prisma.roomFFEItem.findMany({
  where: {
    paymentStatus: 'DEPOSIT_PAID'
  }
});

// Get fully paid items ready for ordering
const readyToOrder = await prisma.roomFFEItem.findMany({
  where: {
    paymentStatus: 'FULLY_PAID',
    specStatus: { not: 'ORDERED' }
  }
});
```

### Payment Summary for Project

```typescript
const summary = await prisma.roomFFEItem.groupBy({
  by: ['paymentStatus'],
  where: {
    section: { instance: { room: { projectId } } }
  },
  _count: true,
  _sum: { paidAmount: true }
});

// Returns:
// [
//   { paymentStatus: 'NOT_INVOICED', _count: 10, _sum: { paidAmount: 0 } },
//   { paymentStatus: 'INVOICED', _count: 5, _sum: { paidAmount: 0 } },
//   { paymentStatus: 'FULLY_PAID', _count: 15, _sum: { paidAmount: 5000 } },
// ]
```

---

## Handling Refunds

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Create refund record
  await tx.payment.create({
    data: {
      clientQuoteId,
      amount: -refundAmount,  // Negative amount
      method: 'CREDIT_CARD',
      status: 'REFUNDED',
      stripePaymentId: refundIntent.id
    }
  });

  // 2. Update item payment status
  const lineItems = await tx.clientQuoteLineItem.findMany({
    where: { clientQuoteId }
  });

  for (const li of lineItems) {
    if (li.roomFFEItemId) {
      await tx.roomFFEItem.update({
        where: { id: li.roomFFEItemId },
        data: {
          paymentStatus: 'REFUNDED',
          paidAmount: { decrement: allocatedRefund }
        }
      });
    }
  }
});
```

---

## Common Patterns

### Check if Invoice is Fully Paid

```typescript
async function isInvoiceFullyPaid(clientQuoteId: string): Promise<boolean> {
  const [quote, payments] = await Promise.all([
    prisma.clientQuote.findUnique({
      where: { id: clientQuoteId },
      select: { totalAmount: true }
    }),
    prisma.payment.aggregate({
      where: { clientQuoteId, status: 'COMPLETED' },
      _sum: { amount: true }
    })
  ]);

  const totalPaid = Number(payments._sum.amount) || 0;
  return totalPaid >= Number(quote.totalAmount);
}
```

### Get Outstanding Balance

```typescript
async function getOutstandingBalance(clientQuoteId: string): Promise<number> {
  const [quote, payments] = await Promise.all([
    prisma.clientQuote.findUnique({
      where: { id: clientQuoteId },
      select: { totalAmount: true }
    }),
    prisma.payment.aggregate({
      where: { clientQuoteId, status: 'COMPLETED' },
      _sum: { amount: true }
    })
  ]);

  const totalPaid = Number(payments._sum.amount) || 0;
  return Math.max(0, Number(quote.totalAmount) - totalPaid);
}
```

---

## Integration with Status Sync

Payment status automatically syncs with `specStatus`:

```typescript
// When payment is received
await syncItemStatus(itemId, 'payment_received');

// This moves specStatus from INVOICED_TO_CLIENT → CLIENT_PAID
// (if specStatus was at or before INVOICED_TO_CLIENT)
```

---

## Common Mistakes

1. **Not updating item payment status**
   ```typescript
   // BAD - Only creating payment record
   await prisma.payment.create({ ... });

   // GOOD - Also update items
   await prisma.payment.create({ ... });
   await updateItemPaymentStatus(itemId, 'FULLY_PAID', amount);
   ```

2. **Forgetting proportional allocation**
   ```typescript
   // BAD - Same amount for all items
   items.forEach(item => updatePaymentStatus(item.id, payment.amount));

   // GOOD - Proportional allocation
   items.forEach(item => {
     const allocated = allocatePayment(payment.amount, item.price, total);
     updatePaymentStatus(item.id, allocated);
   });
   ```

3. **Not handling partial payments**
   ```typescript
   // BAD - Assuming full payment
   data: { paymentStatus: 'FULLY_PAID' }

   // GOOD - Check if full or partial
   const isFullPayment = totalPaid >= invoiceTotal;
   data: { paymentStatus: isFullPayment ? 'FULLY_PAID' : 'DEPOSIT_PAID' }
   ```

---

*Last updated: January 2025*

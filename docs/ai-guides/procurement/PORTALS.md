# Supplier & Client Portals Guide

> **For AI Agencies**: This document covers the secure portal systems for external access.

---

## Overview

The system provides two types of external portals:
1. **Supplier Portal**: For suppliers to view RFQs and submit quotes
2. **Client Portal**: For clients to view quotes and make payments

Both use **token-based authentication** - no login required.

---

## Supplier Portal

### How It Works

1. Designer creates RFQ and selects suppliers
2. System generates unique access token per supplier
3. Supplier receives email with portal link
4. Supplier accesses portal using token
5. Supplier views RFQ details and submits quote
6. System logs all access for audit

### Data Model

```prisma
model SupplierRFQ {
  id              String    @id
  rfqId           String
  supplierId      String?

  // One-time vendor info (if not in phonebook)
  vendorName      String?
  vendorEmail     String
  vendorPhone     String?
  vendorCompany   String?

  // Portal Access
  accessToken     String    @unique  // Secure token for portal access
  sentAt          DateTime?
  viewedAt        DateTime?          // First view
  lastAccessedAt  DateTime?          // Most recent access
  accessCount     Int       @default(0)

  // Response
  status          SupplierRFQStatus  // PENDING, SUBMITTED, DECLINED

  quotes          SupplierQuote[]
  accessLogs      SupplierAccessLog[]
}

model SupplierAccessLog {
  id              String    @id
  supplierRFQId   String
  ipAddress       String?
  userAgent       String?
  action          String    // 'viewed', 'downloaded', 'submitted', etc.
  timestamp       DateTime  @default(now())
}
```

### Token Generation

```typescript
import { randomBytes } from 'crypto';

function generateSecureToken(): string {
  return randomBytes(32).toString('hex');  // 64 character hex string
}

// Create supplier RFQ with token
const supplierRfq = await prisma.supplierRFQ.create({
  data: {
    rfqId,
    supplierId,
    vendorEmail: 'supplier@example.com',
    accessToken: generateSecureToken()
  }
});

// Portal URL
const portalUrl = `${baseUrl}/supplier-portal/${supplierRfq.accessToken}`;
```

### Portal API Route

```typescript
// src/app/api/supplier-portal/[token]/route.ts

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  const { token } = params;

  // Find supplier RFQ by token
  const supplierRfq = await prisma.supplierRFQ.findUnique({
    where: { accessToken: token },
    include: {
      rfq: {
        include: { lineItems: true }
      }
    }
  });

  if (!supplierRfq) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  }

  // Log access
  await prisma.supplierAccessLog.create({
    data: {
      supplierRFQId: supplierRfq.id,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
      action: 'viewed'
    }
  });

  // Update access tracking
  await prisma.supplierRFQ.update({
    where: { id: supplierRfq.id },
    data: {
      viewedAt: supplierRfq.viewedAt || new Date(),
      lastAccessedAt: new Date(),
      accessCount: { increment: 1 }
    }
  });

  return NextResponse.json({ rfq: supplierRfq.rfq });
}
```

### Quote Submission

```typescript
// POST /api/supplier-portal/[token]/quote

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  const { token } = params;
  const body = await request.json();

  const supplierRfq = await prisma.supplierRFQ.findUnique({
    where: { accessToken: token }
  });

  if (!supplierRfq) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  }

  // Create quote with line items
  const quote = await prisma.$transaction(async (tx) => {
    const supplierQuote = await tx.supplierQuote.create({
      data: {
        supplierRFQId: supplierRfq.id,
        quoteNumber: generateQuoteNumber(),
        status: 'SUBMITTED',
        submittedAt: new Date(),
        totalAmount: body.totalAmount,
        currency: body.currency,
        validUntil: body.validUntil,
        lineItems: {
          create: body.lineItems.map(item => ({
            rfqLineItemId: item.rfqLineItemId,
            roomFFEItemId: item.roomFFEItemId,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            totalPrice: item.unitPrice * item.quantity,
            currency: body.currency,
            leadTime: item.leadTime,
            availability: item.availability
          }))
        }
      }
    });

    // Update supplier RFQ status
    await tx.supplierRFQ.update({
      where: { id: supplierRfq.id },
      data: { status: 'SUBMITTED' }
    });

    // Log submission
    await tx.supplierAccessLog.create({
      data: {
        supplierRFQId: supplierRfq.id,
        action: 'submitted',
        timestamp: new Date()
      }
    });

    return supplierQuote;
  });

  return NextResponse.json({ success: true, quoteId: quote.id });
}
```

---

## Client Portal

### How It Works

1. Designer creates client quote/invoice
2. System generates unique access token
3. Client receives email with portal link
4. Client views quote details
5. Client approves/rejects or makes payment
6. System tracks all interactions

### Data Model

```prisma
model ClientQuote {
  id              String    @id

  // ... quote details ...

  // Portal Access (token stored separately or derived)
  sentToClientAt  DateTime?
  emailOpenedAt   DateTime?

  // Client Response
  clientDecision  ClientDecision?  // APPROVED, REJECTED, REVISION_REQUESTED
  clientDecidedAt DateTime?
  clientMessage   String?

  payments        Payment[]
  emailLogs       ClientQuoteEmailLog[]
}

model ClientQuoteEmailLog {
  id              String    @id
  clientQuoteId   String
  to              String
  subject         String
  htmlContent     String?
  sentAt          DateTime
  openedAt        DateTime?
  clickedAt       DateTime?
  trackingPixelId String?   // For email open tracking
}
```

### Budget Quote (Simplified Approval)

```prisma
model BudgetQuote {
  id              String    @id
  projectId       String
  token           String    @unique  // Portal access token

  title           String
  description     String?
  estimatedTotal  Decimal
  markupPercent   Decimal?
  currency        String    @default("CAD")

  // Items included
  itemIds         String[]  // RoomFFEItem IDs
  supplierQuoteIds String[] // SupplierQuote IDs

  // Status
  status          BudgetQuoteStatus  // PENDING, APPROVED, QUESTION_ASKED, EXPIRED

  // Client Response
  clientApproved   Boolean?
  clientApprovedAt DateTime?
  clientQuestion   String?
  clientQuestionAt DateTime?

  // Tracking
  sentAt          DateTime?
  sentToEmail     String?
  emailOpenedAt   DateTime?
  viewedAt        DateTime?
  expiresAt       DateTime?
}
```

### Client Portal API

```typescript
// GET /api/client-portal/[token]

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  // Try budget quote first
  let quote = await prisma.budgetQuote.findUnique({
    where: { token: params.token }
  });

  if (quote) {
    // Update viewed timestamp
    if (!quote.viewedAt) {
      await prisma.budgetQuote.update({
        where: { id: quote.id },
        data: { viewedAt: new Date() }
      });
    }
    return NextResponse.json({ type: 'budget', quote });
  }

  // Try client quote (token may be in a different field or derived)
  // ... implementation varies

  return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
}
```

### Client Approval

```typescript
// POST /api/budget-quotes/public/[token]/respond

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  const { approved, question } = await request.json();

  const budgetQuote = await prisma.budgetQuote.findUnique({
    where: { token: params.token }
  });

  if (!budgetQuote) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  }

  if (approved) {
    await prisma.$transaction(async (tx) => {
      // Update budget quote
      await tx.budgetQuote.update({
        where: { id: budgetQuote.id },
        data: {
          status: 'APPROVED',
          clientApproved: true,
          clientApprovedAt: new Date()
        }
      });

      // Sync item statuses
      for (const itemId of budgetQuote.itemIds) {
        await syncItemStatus(itemId, 'client_approved', null, tx);
      }
    });
  } else if (question) {
    await prisma.budgetQuote.update({
      where: { id: budgetQuote.id },
      data: {
        status: 'QUESTION_ASKED',
        clientQuestion: question,
        clientQuestionAt: new Date()
      }
    });
  }

  return NextResponse.json({ success: true });
}
```

### Payment Portal

```typescript
// POST /api/client-portal/[token]/pay

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  const { paymentMethod, paymentIntentId } = await request.json();

  // Validate token and get client quote
  const clientQuote = await getClientQuoteByToken(params.token);

  if (!clientQuote) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  }

  // Verify Stripe payment
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status !== 'succeeded') {
    return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
  }

  // Record payment
  await recordPayment(clientQuote.id, {
    amount: paymentIntent.amount / 100,  // Stripe uses cents
    method: 'CREDIT_CARD',
    stripePaymentId: paymentIntentId,
    status: 'COMPLETED'
  });

  return NextResponse.json({ success: true });
}
```

---

## Email Tracking

### Open Tracking (Pixel)

```typescript
// Include tracking pixel in email HTML
const trackingPixelId = generateSecureToken();
const trackingPixelUrl = `${baseUrl}/api/email/track/${trackingPixelId}`;

const emailHtml = `
  <html>
    <body>
      <!-- Email content -->
      <img src="${trackingPixelUrl}" width="1" height="1" />
    </body>
  </html>
`;

// Save tracking ID
await prisma.clientQuoteEmailLog.create({
  data: {
    clientQuoteId,
    to: clientEmail,
    subject: 'Your Quote',
    trackingPixelId,
    sentAt: new Date()
  }
});
```

### Pixel Endpoint

```typescript
// GET /api/email/track/[trackingPixelId]

export async function GET(
  request: Request,
  { params }: { params: { trackingPixelId: string } }
) {
  // Update email log
  await prisma.clientQuoteEmailLog.updateMany({
    where: { trackingPixelId: params.trackingPixelId },
    data: { openedAt: new Date() }
  });

  // Return 1x1 transparent GIF
  const pixel = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );

  return new Response(pixel, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store'
    }
  });
}
```

---

## Security Considerations

### Token Security

```typescript
// DO: Use cryptographically secure tokens
import { randomBytes } from 'crypto';
const token = randomBytes(32).toString('hex');

// DON'T: Use predictable tokens
const badToken = `quote-${quoteId}`;  // Easily guessable!
```

### Token Expiration

```typescript
// Check if token is expired
const budgetQuote = await prisma.budgetQuote.findUnique({
  where: { token }
});

if (budgetQuote.expiresAt && budgetQuote.expiresAt < new Date()) {
  return NextResponse.json({ error: 'Token expired' }, { status: 410 });
}
```

### Rate Limiting

```typescript
// Implement rate limiting for portal endpoints
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000,  // 1 minute
  uniqueTokenPerInterval: 500
});

export async function GET(request: Request) {
  try {
    await limiter.check(10, request.ip);  // 10 requests per minute
  } catch {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // ... rest of handler
}
```

### Audit Logging

```typescript
// Always log portal access
await prisma.supplierAccessLog.create({
  data: {
    supplierRFQId,
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    action: 'viewed',
    timestamp: new Date()
  }
});
```

---

## Common Patterns

### Sending Portal Link Email

```typescript
async function sendSupplierPortalEmail(supplierRfqId: string) {
  const supplierRfq = await prisma.supplierRFQ.findUnique({
    where: { id: supplierRfqId },
    include: { rfq: true }
  });

  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/supplier-portal/${supplierRfq.accessToken}`;

  await sendEmail({
    to: supplierRfq.vendorEmail,
    subject: `Request for Quote: ${supplierRfq.rfq.title}`,
    html: `
      <p>You have received a request for quote.</p>
      <p><a href="${portalUrl}">Click here to view and respond</a></p>
      <p>This link is unique to you. Do not share it.</p>
    `
  });

  await prisma.supplierRFQ.update({
    where: { id: supplierRfqId },
    data: { sentAt: new Date() }
  });
}
```

### Checking Portal Status

```typescript
async function getPortalStatus(supplierRfqId: string) {
  const supplierRfq = await prisma.supplierRFQ.findUnique({
    where: { id: supplierRfqId },
    select: {
      sentAt: true,
      viewedAt: true,
      lastAccessedAt: true,
      accessCount: true,
      status: true
    }
  });

  return {
    sent: !!supplierRfq.sentAt,
    viewed: !!supplierRfq.viewedAt,
    viewCount: supplierRfq.accessCount,
    lastAccess: supplierRfq.lastAccessedAt,
    responded: supplierRfq.status === 'SUBMITTED'
  };
}
```

---

*Last updated: January 2025*

# Currency Handling Guide (USD/CAD)

> **For AI Agencies**: This document covers multi-currency handling in the procurement system.

---

## Overview

The system supports **CAD (Canadian Dollar)** and **USD (US Dollar)** currencies. Currency is tracked at multiple levels to handle international suppliers and proper invoicing.

---

## Currency Fields by Model

### RoomFFEItem (Spec Items)

```prisma
model RoomFFEItem {
  currency           String?  @default("CAD")  // Main item currency
  rrpCurrency        String?  @default("CAD")  // RRP (retail) currency
  tradePriceCurrency String?  @default("CAD")  // Trade price currency

  // Price fields (use corresponding currency)
  unitCost           Decimal?  // Uses: currency
  totalCost          Decimal?  // Uses: currency
  tradePrice         Decimal?  // Uses: tradePriceCurrency
  rrp                Decimal?  // Uses: rrpCurrency
}
```

**Why 3 currency fields?**
- A supplier may quote in USD (tradePriceCurrency = "USD")
- The retail price (RRP) may be listed in CAD (rrpCurrency = "CAD")
- The item's working currency may be CAD (currency = "CAD")

### Supplier

```prisma
model Supplier {
  currency  String  @default("CAD")  // Supplier's default currency
}
```

When creating RFQs or quotes, inherit the supplier's default currency.

### SupplierQuote & SupplierQuoteLineItem

```prisma
model SupplierQuote {
  currency      String  @default("CAD")
  totalAmount   Decimal?
  subtotal      Decimal?
  shippingCost  Decimal?
}

model SupplierQuoteLineItem {
  currency    String  @default("CAD")
  unitPrice   Decimal
  totalPrice  Decimal
}
```

### ClientQuote & ClientQuoteLineItem

```prisma
model ClientQuote {
  currency     String  @default("CAD")
  totalAmount  Decimal?
  subtotal     Decimal?
}

model ClientQuoteLineItem {
  currency          String?  @default("CAD")
  clientUnitPrice   Decimal  // What client pays
  clientTotalPrice  Decimal
  supplierUnitPrice Decimal? // What we pay (may be different currency!)
}
```

### Order

```prisma
model Order {
  currency     String  @default("CAD")
  totalAmount  Decimal?
}
```

### Payment

```prisma
model Payment {
  currency  String  @default("CAD")
  amount    Decimal
}
```

---

## Currency Conversion Rules

### Rule 1: No Auto-Conversion
The system does **NOT** automatically convert currencies. All conversions must be done manually by the user/designer.

### Rule 2: Store Original Currency
Always store amounts in their **original currency** with the currency code. Never silently convert.

### Rule 3: Display Currency Code
Always display the currency code alongside amounts:
```
Good: $150.00 USD
Bad:  $150.00
```

### Rule 4: Inherit from Supplier
When creating quotes/orders for a supplier, use their default currency:
```typescript
const supplier = await prisma.supplier.findUnique({
  where: { id: supplierId }
});

const quote = await prisma.supplierQuote.create({
  data: {
    currency: supplier.currency, // Inherit from supplier
    // ...
  }
});
```

---

## Common Scenarios

### Scenario 1: US Supplier, Canadian Client

```
Supplier quotes: $100.00 USD
↓
Designer accepts quote (stored as USD)
↓
Client quote created: $135.00 CAD (manual conversion + markup)
↓
Client pays: $135.00 CAD
↓
Order to supplier: $100.00 USD
```

**Data Storage:**
```typescript
// SupplierQuoteLineItem
{
  unitPrice: 100.00,
  currency: "USD"
}

// ClientQuoteLineItem
{
  supplierUnitPrice: 100.00,  // Original USD amount
  clientUnitPrice: 135.00,    // CAD amount for client
  currency: "CAD"
}

// RoomFFEItem
{
  tradePrice: 100.00,
  tradePriceCurrency: "USD",
  // Client-facing price would be calculated separately
}
```

### Scenario 2: Mixed Currency RFQ

When sending RFQ to suppliers with different currencies:

```typescript
// Each SupplierRFQ can have different currency based on supplier
const supplierRfqs = await Promise.all(
  suppliers.map(supplier =>
    prisma.supplierRFQ.create({
      data: {
        rfqId: rfq.id,
        supplierId: supplier.id,
        // Quote will come back in supplier's currency
      }
    })
  )
);
```

### Scenario 3: Comparing Quotes in Different Currencies

When comparing quotes, display original currencies - do NOT convert:

```typescript
// Quote comparison display
[
  { supplier: "US Vendor", unitPrice: 100, currency: "USD" },
  { supplier: "CA Vendor", unitPrice: 130, currency: "CAD" },
]

// Let the user decide which is better based on current exchange rate
```

---

## API Patterns

### Creating Items with Currency

```typescript
// POST /api/ffe/v2/rooms/[roomId]/items
{
  name: "Pendant Light",
  tradePrice: 250.00,
  tradePriceCurrency: "USD",
  rrp: 350.00,
  rrpCurrency: "CAD"
}
```

### Updating Currency

```typescript
// PUT /api/ffe/v2/rooms/[roomId]/items/[itemId]
{
  tradePriceCurrency: "CAD",
  tradePrice: 335.00  // Converted amount
}
```

### Client Quote with Mixed Currencies

```typescript
// When creating client quote, all line items should be in same currency
const clientQuote = await prisma.clientQuote.create({
  data: {
    currency: "CAD",  // Client quote currency
    lineItems: {
      create: items.map(item => ({
        roomFFEItemId: item.id,
        supplierUnitPrice: item.tradePrice,  // May be USD
        clientUnitPrice: convertedPrice,      // Converted to CAD
        currency: "CAD"
      }))
    }
  }
});
```

---

## UI Considerations

### Currency Selector
Always provide a dropdown for currency selection on price fields:
```tsx
<Select value={currency} onChange={setCurrency}>
  <Option value="CAD">CAD</Option>
  <Option value="USD">USD</Option>
</Select>
```

### Display Format
```typescript
function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

// Output: "CA$150.00" or "US$150.00"
```

### Warnings
Show warnings when currencies don't match:
```
⚠️ This supplier quotes in USD. Your client quote is in CAD.
   Make sure to verify the exchange rate before sending.
```

---

## Database Queries

### Get Items with Currency Info

```typescript
const items = await prisma.roomFFEItem.findMany({
  where: { sectionId },
  select: {
    id: true,
    name: true,
    tradePrice: true,
    tradePriceCurrency: true,
    rrp: true,
    rrpCurrency: true,
    currency: true,
    acceptedQuoteLineItem: {
      select: {
        unitPrice: true,
        currency: true,
      }
    }
  }
});
```

### Get Quotes Grouped by Currency

```typescript
const quotes = await prisma.supplierQuoteLineItem.findMany({
  where: { roomFFEItemId: itemId },
});

const byCurrency = quotes.reduce((acc, q) => {
  const curr = q.currency;
  if (!acc[curr]) acc[curr] = [];
  acc[curr].push(q);
  return acc;
}, {} as Record<string, typeof quotes>);
```

---

## Common Mistakes to Avoid

1. **Mixing currencies in calculations**
   ```typescript
   // BAD
   const total = usdPrice + cadPrice;

   // GOOD
   const total = usdPrice; // Keep separate until explicit conversion
   ```

2. **Forgetting to store currency**
   ```typescript
   // BAD
   await prisma.roomFFEItem.update({
     data: { tradePrice: 100 }  // What currency?!
   });

   // GOOD
   await prisma.roomFFEItem.update({
     data: {
       tradePrice: 100,
       tradePriceCurrency: "USD"
     }
   });
   ```

3. **Assuming default currency**
   ```typescript
   // BAD
   const price = item.tradePrice; // Assuming CAD

   // GOOD
   const price = item.tradePrice;
   const currency = item.tradePriceCurrency || "CAD";
   ```

4. **Silent conversion**
   ```typescript
   // BAD - Converting without user knowledge
   const cadPrice = usdPrice * 1.35;

   // GOOD - Explicit conversion with audit
   const cadPrice = usdPrice * exchangeRate;
   console.log(`Converted ${usdPrice} USD to ${cadPrice} CAD at rate ${exchangeRate}`);
   ```

---

## Future Considerations

- Exchange rate service integration
- Historical exchange rate tracking
- Multi-currency reporting
- Automatic conversion suggestions (with user confirmation)

---

*Last updated: January 2025*

# FFE Linked Items & Spec Options Guide

> **For AI Agencies**: This document covers item linking, spec options, and components.

---

## Overview

FFE items can be linked in several ways:

| Relationship | Purpose | Example |
|--------------|---------|---------|
| **FFE → Spec** | Link requirement to product | "Pendant Light" → "Tom Dixon Beat" |
| **Spec Options** | Multiple products for one requirement | Option A, B, C for client choice |
| **Parent → Children** | Item with components | Fixture + Driver + Bracket |
| **FFESpecLink** | Many-to-many linking | One product used in multiple rooms |

---

## 1. FFE Requirement → Spec Item Linking

### Concept

- **FFE Requirement**: What needs to be specified (abstract)
  - `isSpecItem: false`
  - Lives in FFE Workspace
  - Example: "1x Kitchen Pendant"

- **Spec Item**: The actual product (concrete)
  - `isSpecItem: true`
  - Appears in All Specs
  - Example: "Tom Dixon Beat Pendant - Black"

### Linking Methods

#### Method 1: Direct Field (Legacy)

```prisma
model RoomFFEItem {
  ffeRequirementId  String?  // Points to parent FFE item
  isSpecItem        Boolean  @default(false)
  isOption          Boolean  @default(false)
  optionNumber      Int?
}
```

```typescript
// Create spec item linked to FFE requirement
await prisma.roomFFEItem.create({
  data: {
    name: 'Tom Dixon Beat Pendant',
    isSpecItem: true,
    ffeRequirementId: 'ffe-requirement-uuid'
  }
});
```

#### Method 2: FFESpecLink (Modern)

```prisma
model FFESpecLink {
  id                String    @id
  specItemId        String
  ffeRequirementId  String
  roomId            String
  roomName          String?
  sectionName       String?
  createdAt         DateTime
  createdById       String

  @@unique([specItemId, ffeRequirementId])
}
```

Advantages:
- Many-to-many relationships
- One spec can link to multiple FFE items
- Track where spec is used across rooms

### API: Link Spec to FFE

```
POST /api/ffe/spec-links
```

```typescript
{
  specItemId: string,
  ffeRequirementId: string
}
```

### API: Unlink Spec from FFE

```
DELETE /api/ffe/spec-links
```

```typescript
{
  specItemId: string,
  ffeRequirementId: string
}
```

Or use item endpoint:
```
PATCH /api/ffe/v2/rooms/[roomId]/items/[itemId]/unlink-spec
```

### Query Linked Items

```typescript
// Get all FFE items linked to a spec
const links = await prisma.fFESpecLink.findMany({
  where: { specItemId: 'spec-uuid' }
});

// Or via item relations
const item = await prisma.roomFFEItem.findUnique({
  where: { id: specItemId },
  include: {
    ffeLinks: true,      // Modern: FFESpecLink records
    linkedSpecs: true    // Legacy: via ffeRequirementId
  }
});
```

---

## 2. Spec Options (Multiple Products per Requirement)

### Concept

When designer wants to present multiple product options to client:

```
FFE Requirement: "Kitchen Pendant Light"
├── Option A: Tom Dixon Beat - Black ($450)
├── Option B: Tom Dixon Beat - Brass ($550)
└── Option C: Flos IC Lights ($650)
```

### Creating Options

```typescript
// Option 1
await prisma.roomFFEItem.create({
  data: {
    name: 'Tom Dixon Beat - Black',
    ffeRequirementId: 'ffe-uuid',
    isSpecItem: true,
    isOption: true,
    optionNumber: 1
  }
});

// Option 2
await prisma.roomFFEItem.create({
  data: {
    name: 'Tom Dixon Beat - Brass',
    ffeRequirementId: 'ffe-uuid',
    isSpecItem: true,
    isOption: true,
    optionNumber: 2
  }
});
```

### Frontend Handling

```typescript
// ItemDetailPanel tracks selected option
const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);

// Get all options for a requirement
const options = item.linkedSpecs.filter(s => s.isOption);

// Display option selector
<OptionTabs
  options={options}
  selected={selectedOptionIndex}
  onChange={setSelectedOptionIndex}
/>
```

### Query Options

```typescript
// Get all options for an FFE requirement
const options = await prisma.roomFFEItem.findMany({
  where: {
    ffeRequirementId: 'ffe-uuid',
    isOption: true
  },
  orderBy: { optionNumber: 'asc' }
});
```

---

## 3. Parent-Child Relationships (Components)

### Concept

Items can have child items for complex products:

```
Parent: "Pendant Fixture" ($500)
├── Child: "LED Driver" ($45)
├── Child: "Mounting Bracket" ($30)
└── Child: "Junction Box" ($15)
Total: $590
```

### Data Structure

```typescript
// Parent item customFields
{
  hasChildren: true,
  linkedItems: ["LED Driver", "Mounting Bracket", "Junction Box"]
}

// Child item customFields
{
  isGroupedItem: true,      // Modern approach
  isLinkedItem: true,       // Legacy approach
  parentId: "parent-uuid",  // Preferred
  parentName: "Pendant Fixture"  // Fallback
}
```

### Component Model (Alternative)

```prisma
model ItemComponent {
  id          String    @id
  itemId      String
  item        RoomFFEItem

  name        String
  modelNumber String?
  image       String?
  price       Decimal?
  quantity    Int       @default(1)
  order       Int       @default(0)
  notes       String?

  // Quote tracking
  quotedPrice Decimal?
  quotedAt    DateTime?
  acceptedQuoteLineItemId String?
}
```

### Adding Components

**Method 1: Via Linked Items Endpoint**

```
PATCH /api/ffe/v2/rooms/[roomId]/items/[itemId]/linked-items
```

```typescript
// Add component
{
  action: "add",
  itemName: "LED Driver",
  itemPrice: 45.00
}

// Remove component
{
  action: "remove",
  childItemId: "child-uuid"
}
```

**Method 2: Via Components Endpoint**

```
POST /api/ffe/v2/rooms/[roomId]/items/[itemId]/components
```

```typescript
{
  name: "LED Driver",
  price: 45.00,
  quantity: 1,
  modelNumber: "DRV-123"
}
```

### Component Order

Children are ordered relative to parent:

```typescript
// Parent order: 1.0
// Children: 1.1, 1.2, 1.3

const childOrder = parentItem.order + 0.1 * (existingChildCount + 1);
```

### Visibility Rules

**Rule: Children follow parent visibility**

```typescript
// When hiding parent
await prisma.$transaction([
  prisma.roomFFEItem.update({
    where: { id: parentId },
    data: { visibility: 'HIDDEN' }
  }),
  prisma.roomFFEItem.updateMany({
    where: {
      customFields: { path: ['parentId'], equals: parentId }
    },
    data: { visibility: 'HIDDEN' }
  })
]);
```

**Rule: Cannot show child if parent hidden**

```typescript
if (parentItem.visibility === 'HIDDEN' && newVisibility === 'VISIBLE') {
  throw new Error('Cannot show child when parent is hidden');
}
```

### Parent Name Cascade

When parent name changes, update all children:

```typescript
if (data.name !== existingItem.name && existingItem.customFields?.hasChildren) {
  await prisma.roomFFEItem.updateMany({
    where: {
      customFields: { path: ['parentId'], equals: itemId }
    },
    data: {
      customFields: {
        ...childCustomFields,
        parentName: data.name
      }
    }
  });
}
```

---

## 4. DocCode Synchronization

### How It Works

When linking FFE requirement to spec item, docCodes stay in sync:

```typescript
// FFE Requirement has docCode "PL-001"
// When linked, spec item gets "PL-001"

// If spec docCode changes, FFE requirement updates
```

### Sync Logic

```typescript
// When linking
await prisma.roomFFEItem.update({
  where: { id: specItemId },
  data: { docCode: ffeRequirement.docCode }
});

// When unlinking
// Spec keeps its docCode (no reset)
```

---

## 5. Pricing with Components

### Price Calculation

```typescript
// From /src/lib/pricing.ts

// Components total (no markup applied to trade price)
function calculateComponentsTotal(components: Component[]): number {
  return components.reduce((sum, c) => sum + (c.price * c.quantity), 0);
}

// Components RRP (markup applied)
function calculateComponentsRRP(components: Component[], markupPercent: number): number {
  const total = calculateComponentsTotal(components);
  return total * (1 + markupPercent / 100);
}

// Item total (trade)
function calculateItemTradeTotal(item: Item, componentsTotal: number): number {
  return (item.tradePrice * item.quantity) + componentsTotal;
}

// Item total (RRP)
function calculateItemRRPTotal(item: Item, componentsTotal: number): number {
  const itemRRP = item.rrp * item.quantity;
  const componentsRRP = componentsTotal * (1 + item.markupPercent / 100);
  return itemRRP + componentsRRP;
}
```

### Display Pattern

```
Pendant Fixture                  $500.00
├── LED Driver (×1)               $45.00
├── Mounting Bracket (×1)         $30.00
└── Junction Box (×1)             $15.00
─────────────────────────────────────────
Trade Total:                     $590.00
Client Total (25% markup):       $737.50
```

---

## 6. Activity Logging

### Link/Unlink Events

```typescript
// When linking spec to FFE
await prisma.itemActivity.create({
  data: {
    itemId: ffeRequirementId,
    type: 'SPEC_LINKED',
    title: 'Product Linked',
    description: `${specItem.name} linked as specification`,
    actorId: userId,
    actorType: 'user',
    metadata: { specItemId, specItemName: specItem.name }
  }
});

// When unlinking
await prisma.itemActivity.create({
  data: {
    itemId: ffeRequirementId,
    type: 'SPEC_UNLINKED',
    title: 'Product Unlinked',
    description: `${specItem.name} removed as specification`,
    actorId: userId,
    actorType: 'user'
  }
});
```

### Component Events

```typescript
// When adding component
await prisma.fFEChangeLog.create({
  data: {
    entityType: 'item',
    entityId: parentId,
    action: 'linked_item_added',
    newValue: componentName,
    userId,
    metadata: { componentId, componentPrice }
  }
});
```

---

## Common Patterns

### Link Spec to Multiple FFE Requirements

```typescript
// Via Chrome extension multi-select
const ffeRequirementIds = ['req-1', 'req-2', 'req-3'];

for (const ffeId of ffeRequirementIds) {
  await prisma.fFESpecLink.create({
    data: {
      specItemId: 'spec-uuid',
      ffeRequirementId: ffeId,
      roomId: getRoomForFFE(ffeId),
      createdById: userId
    }
  });
}
```

### Create Option Set for Requirement

```typescript
const options = [
  { name: 'Option A - Budget', price: 200 },
  { name: 'Option B - Mid', price: 350 },
  { name: 'Option C - Premium', price: 500 }
];

for (let i = 0; i < options.length; i++) {
  await prisma.roomFFEItem.create({
    data: {
      name: options[i].name,
      tradePrice: options[i].price,
      ffeRequirementId: 'ffe-uuid',
      sectionId: 'section-uuid',
      isSpecItem: true,
      isOption: true,
      optionNumber: i + 1
    }
  });
}
```

### Add Components to Fixture

```typescript
const parentItem = await prisma.roomFFEItem.create({
  data: {
    name: 'Custom Chandelier',
    tradePrice: 2500,
    customFields: { hasChildren: true, linkedItems: [] }
  }
});

const components = [
  { name: 'LED Driver 60W', price: 85 },
  { name: 'Mounting Plate', price: 45 },
  { name: 'Canopy Cover', price: 35 }
];

for (const comp of components) {
  await fetch(`/api/ffe/v2/rooms/${roomId}/items/${parentItem.id}/linked-items`, {
    method: 'PATCH',
    body: JSON.stringify({
      action: 'add',
      itemName: comp.name,
      itemPrice: comp.price
    })
  });
}
```

### Find All Rooms Using a Spec

```typescript
const usageLinks = await prisma.fFESpecLink.findMany({
  where: { specItemId: 'spec-uuid' },
  select: {
    roomId: true,
    roomName: true,
    sectionName: true
  }
});

// Display: "Used in: Kitchen (Lighting), Living Room (Lighting), Bedroom (Lighting)"
```

---

## Data Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    ITEM RELATIONSHIPS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FFE Requirement (isSpecItem: false)                           │
│  ┌─────────────────────────────────────┐                       │
│  │ Kitchen Pendant Light               │                       │
│  │ docCode: LT-001                     │                       │
│  └─────────────────────────────────────┘                       │
│           │                                                    │
│           │ ffeRequirementId (legacy)                          │
│           │ FFESpecLink (modern)                               │
│           ▼                                                    │
│  Spec Items (isSpecItem: true)                                │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐  │
│  │ Option A        │ │ Option B        │ │ Option C        │  │
│  │ Tom Dixon Black │ │ Tom Dixon Brass │ │ Flos IC Lights  │  │
│  │ optionNumber: 1 │ │ optionNumber: 2 │ │ optionNumber: 3 │  │
│  │ docCode: LT-001 │ │ docCode: LT-001 │ │ docCode: LT-001 │  │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘  │
│                                                                 │
│                                                                 │
│  Parent Item (hasChildren: true)                               │
│  ┌─────────────────────────────────────┐                       │
│  │ Custom Chandelier           $2,500  │                       │
│  └─────────────────────────────────────┘                       │
│           │                                                    │
│           │ parentId in customFields                           │
│           ▼                                                    │
│  Child Items (isGroupedItem: true)                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ LED Driver   │ │ Mount Plate  │ │ Canopy Cover │           │
│  │ $85          │ │ $45          │ │ $35          │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                 │
│                    Total: $2,665                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Query Examples

### Get Item with All Relations

```typescript
const item = await prisma.roomFFEItem.findUnique({
  where: { id: itemId },
  include: {
    // Legacy spec links (via ffeRequirementId)
    linkedSpecs: true,

    // Modern spec links (via FFESpecLink)
    ffeLinks: {
      include: {
        specItem: true
      }
    },

    // Components
    components: {
      orderBy: { order: 'asc' }
    },

    // Activity
    activities: {
      orderBy: { createdAt: 'desc' },
      take: 10
    }
  }
});
```

### Find All Children of Parent

```typescript
const children = await prisma.roomFFEItem.findMany({
  where: {
    customFields: {
      path: ['parentId'],
      equals: parentId
    }
  },
  orderBy: { order: 'asc' }
});
```

---

*Last updated: January 2025*

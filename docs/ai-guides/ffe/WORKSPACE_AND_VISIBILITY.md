# FFE Workspace & Visibility System

> **For AI Agencies**: This document covers the workspace vs All Specs relationship and visibility controls.

---

## Overview

The FFE system has a two-tier structure:

| Tier | Purpose | Storage | View |
|------|---------|---------|------|
| **FFE Workspace** | Room-level requirements | Per room | Room detail page |
| **All Specs** | Project-wide products | Per project | Project specs page |

Items exist in both views but with different purposes:
- **FFE Requirement**: What needs to be specified (e.g., "1x Pendant Light")
- **Spec Item**: The actual product (e.g., "Tom Dixon Beat Pendant")

---

## Visibility System

### Two Visibility States

```prisma
enum ItemVisibility {
  VISIBLE   // Appears in FFE Workspace
  HIDDEN    // Background/not shown in workspace (default)
}
```

### Default Behavior
- New items default to `HIDDEN`
- Must explicitly add to workspace to make `VISIBLE`
- UI shows "In Workspace" vs "Not in Workspace"

### Why This Design?
- Keeps workspace clean and focused
- Items can be saved/worked on without cluttering view
- Clear distinction between "ready to show" and "work in progress"

---

## Visibility Endpoints

### Toggle Single Item

```
PATCH /api/ffe/v2/rooms/[roomId]/items/[itemId]/visibility
```

```typescript
// Request
{
  visibility: "VISIBLE" | "HIDDEN"
}

// Response
{
  success: true,
  item: {
    id: string,
    visibility: "VISIBLE" | "HIDDEN"
  }
}
```

### Bulk Visibility Update

```
PATCH /api/ffe/v2/rooms/[roomId]/items/bulk-visibility
```

```typescript
// Request
{
  itemIds: string[],
  visibility: "VISIBLE" | "HIDDEN"
}

// Or update entire section
{
  sectionId: string,
  visibility: "VISIBLE"
}
```

---

## Linked Item Visibility Rules

### Parent-Child Relationship
Items can have child items (components/grouped items):

```typescript
customFields: {
  // Parent item
  hasChildren: true,
  linkedItems: ["LED Driver", "Mounting Bracket"],

  // Child item
  isGroupedItem: true,
  parentId: "parent-item-uuid",
  parentName: "Pendant Fixture"
}
```

### Visibility Constraints

**Rule 1: Child Cannot Be Visible if Parent is Hidden**
```typescript
// If parent is HIDDEN, child visibility toggle will ERROR
if (parentItem.visibility === 'HIDDEN' && newVisibility === 'VISIBLE') {
  throw new Error('Cannot make child visible when parent is hidden');
}
```

**Rule 2: Parent Visibility Cascades to Children**
```typescript
// When toggling parent visibility, all children follow
await prisma.$transaction([
  // Update parent
  prisma.roomFFEItem.update({
    where: { id: parentId },
    data: { visibility: 'HIDDEN' }
  }),
  // Update all children
  prisma.roomFFEItem.updateMany({
    where: { customFields: { path: ['parentId'], equals: parentId } },
    data: { visibility: 'HIDDEN' }
  })
]);
```

### Implementation Location
- `src/app/api/ffe/v2/rooms/[roomId]/items/[itemId]/visibility/route.ts`

---

## Fetching Items by Visibility

### Include Hidden Items
```
GET /api/ffe/v2/rooms/[roomId]/items?includeHidden=true
```

### Only Visible Items
```
GET /api/ffe/v2/rooms/[roomId]/items?onlyVisible=true
```

### Default Behavior
Without parameters, returns ALL items regardless of visibility.

---

## Section Management

### Section Structure

```prisma
model RoomFFESection {
  id              String    @id
  instanceId      String    // Link to RoomFFEInstance
  name            String
  description     String?
  order           Int
  isExpanded      Boolean   @default(true)
  isCompleted     Boolean   @default(false)
  notes           String?
  presetId        String?   // Link to FFESectionPreset
  docCodePrefix   String?   // e.g., "PL", "EL"
}
```

### Section CRUD

**Create Section**
```
POST /api/ffe/v2/rooms/[roomId]/sections
```

```typescript
{
  name: string,
  description?: string,
  presetId?: string,      // Use existing preset
  docCodePrefix?: string, // Or custom prefix
  items?: Array<{         // Optional: create with items
    name: string,
    // ... item fields
  }>
}
```

**Update Section**
```
PATCH /api/ffe/v2/rooms/[roomId]/sections?sectionId=[sectionId]
```

```typescript
{
  name?: string,
  description?: string,
  order?: number,
  isExpanded?: boolean,
  isCompleted?: boolean
}
```

**Delete Section**
```
DELETE /api/ffe/v2/rooms/[roomId]/sections?sectionId=[sectionId]
```
- Items in section are preserved (orphaned or moved)
- Option to move items to another section

**Duplicate Section**
```
PATCH /api/ffe/v2/rooms/[roomId]/sections/duplicate
```

```typescript
{
  sectionId: string,
  newName?: string  // Default: "Copy of [original name]"
}
```

---

## Section Presets

### Preset Structure

```prisma
model FFESectionPreset {
  id              String    @id
  orgId           String
  name            String
  docCodePrefix   String    // 1-3 uppercase letters
  description     String?
  order           Int
  isActive        Boolean   @default(true)

  @@unique([orgId, name])
  @@unique([orgId, docCodePrefix])
}
```

### Default Presets (Auto-Seeded)

| Name | Prefix | Description |
|------|--------|-------------|
| Plumbing | PL | Faucets, fixtures, hardware |
| Electrical | EL | Outlets, switches, panels |
| Millwork | MW | Custom cabinetry, built-ins |
| Hardware | HW | Door hardware, pulls, knobs |
| Lighting | LT | Light fixtures, lamps |
| Flooring | FL | Flooring materials |
| Window Treatments | WT | Blinds, curtains, shades |
| Furniture | FN | Furniture pieces |
| Accessories | AC | Decor, accessories |
| Textiles | TX | Fabrics, rugs, linens |

### Preset Endpoints

**List Presets**
```
GET /api/ffe/section-presets
```
- Auto-seeds defaults if org has none

**Create Preset**
```
POST /api/ffe/section-presets
```

```typescript
{
  name: string,
  docCodePrefix: string,  // 1-3 uppercase letters
  description?: string
}
```

**Validation Rules**
- `docCodePrefix` must be 1-3 uppercase letters
- Both `name` and `docCodePrefix` must be unique per org

---

## DocCode System

### Auto-Generation
When creating items, docCodes are auto-generated:

```typescript
// Format: [SectionPrefix]-[Number]
// Example: PL-001, PL-002, LT-001

const existingCodes = await prisma.roomFFEItem.findMany({
  where: { sectionId },
  select: { docCode: true }
});

const maxNumber = existingCodes
  .map(item => parseInt(item.docCode.split('-')[1]))
  .reduce((max, num) => Math.max(max, num), 0);

const newDocCode = `${section.docCodePrefix}-${String(maxNumber + 1).padStart(3, '0')}`;
```

### DocCode Synchronization
When linking FFE items to specs, docCodes sync bidirectionally:

```typescript
// If FFE requirement has docCode "PL-001"
// Linked spec item gets same docCode "PL-001"

// If spec item docCode changes, FFE requirement updates
```

---

## Room FFE Instance

### Structure

```prisma
model RoomFFEInstance {
  id              String    @id
  roomId          String    @unique  // One instance per room
  templateId      String?
  name            String?
  status          InstanceStatus  // NOT_STARTED, IN_PROGRESS, COMPLETE
  progress        Decimal   // 0-100
  estimatedBudget Decimal?
  actualBudget    Decimal?
  targetCompletionDate DateTime?
  sections        RoomFFESection[]
}
```

### Progress Calculation
Progress is calculated from visible item states:

```typescript
const visibleItems = items.filter(i => i.visibility === 'VISIBLE');
const completedItems = visibleItems.filter(i =>
  i.state === 'COMPLETE' || i.state === 'NOT_NEEDED'
);

const progress = (completedItems.length / visibleItems.length) * 100;
```

### Status Transitions
```
NOT_STARTED → IN_PROGRESS → COMPLETE

// NOT_STARTED: No visible items have been worked on
// IN_PROGRESS: Some items confirmed/completed
// COMPLETE: All visible items completed or marked not needed
```

---

## Workspace vs All Specs View

### FFE Workspace View
- Accessed via room detail page
- Shows room-specific FFE requirements
- Organized by sections
- Focus on "what needs to be specified"

```
GET /api/ffe/v2/rooms/[roomId]
GET /api/ffe/v2/rooms/[roomId]/items?onlyVisible=true
```

### All Specs View
- Accessed via project specs page
- Shows all spec items across all rooms
- Focus on "what products are selected"
- Supports filtering, sorting, bulk actions

```
GET /api/projects/[id]/ffe-specs
GET /api/projects/[id]/ffe-specs?status=QUOTE_APPROVED
GET /api/projects/[id]/ffe-specs?room=[roomId]
```

### Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           PROJECT                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Room A    │  │   Room B    │  │   Room C    │            │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤            │
│  │ FFE Instance│  │ FFE Instance│  │ FFE Instance│            │
│  │ ┌─────────┐ │  │ ┌─────────┐ │  │ ┌─────────┐ │            │
│  │ │ Section │ │  │ │ Section │ │  │ │ Section │ │            │
│  │ │ ┌─────┐ │ │  │ │ ┌─────┐ │ │  │ │ ┌─────┐ │ │            │
│  │ │ │Item │ │ │  │ │ │Item │ │ │  │ │ │Item │ │ │            │
│  │ │ └──┬──┘ │ │  │ │ └──┬──┘ │ │  │ │ └──┬──┘ │ │            │
│  │ └────┼────┘ │  │ └────┼────┘ │  │ └────┼────┘ │            │
│  └──────┼──────┘  └──────┼──────┘  └──────┼──────┘            │
│         │                │                │                    │
│         └────────────────┼────────────────┘                    │
│                          │                                     │
│                          ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                      ALL SPECS                          │  │
│  │   (Aggregated view of all spec items from all rooms)    │  │
│  │                                                         │  │
│  │   • Filter by room, category, status                    │  │
│  │   • Bulk quote requests                                 │  │
│  │   • Export to PDF/CSV                                   │  │
│  │   • Share links                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Activity & Change Logging

### Change Log Model

```prisma
model FFEChangeLog {
  id          String    @id
  entityType  String    // "item", "section"
  entityId    String
  action      String    // "visibility_changed", "linked_item_added"
  fieldName   String?
  oldValue    String?
  newValue    String?
  userId      String
  orgId       String
  roomId      String?
  instanceId  String?
  metadata    Json?
  createdAt   DateTime
}
```

### Tracked Changes
- Visibility changes
- Linked item additions/removals
- Section modifications
- Status changes
- DocCode changes

---

## Common Patterns

### Add Section with Items to Workspace

```typescript
// 1. Create section
const section = await fetch(`/api/ffe/v2/rooms/${roomId}/sections`, {
  method: 'POST',
  body: JSON.stringify({
    name: 'Plumbing',
    presetId: 'plumbing-preset-id'
  })
});

// 2. Create items in section
const item = await fetch(`/api/ffe/v2/rooms/${roomId}/items`, {
  method: 'POST',
  body: JSON.stringify({
    name: 'Kitchen Faucet',
    sectionId: section.id
  })
});

// 3. Make items visible
await fetch(`/api/ffe/v2/rooms/${roomId}/items/${item.id}/visibility`, {
  method: 'PATCH',
  body: JSON.stringify({ visibility: 'VISIBLE' })
});
```

### Bulk Add Section to Workspace

```typescript
// Make all items in section visible
await fetch(`/api/ffe/v2/rooms/${roomId}/items/bulk-visibility`, {
  method: 'PATCH',
  body: JSON.stringify({
    sectionId: 'section-uuid',
    visibility: 'VISIBLE'
  })
});
```

### Check Workspace Status

```typescript
const instance = await fetch(`/api/ffe/v2/rooms/${roomId}`);

console.log({
  status: instance.status,      // NOT_STARTED | IN_PROGRESS | COMPLETE
  progress: instance.progress,   // 0-100
  visibleItems: instance.sections.flatMap(s =>
    s.items.filter(i => i.visibility === 'VISIBLE')
  ).length
});
```

---

*Last updated: January 2025*

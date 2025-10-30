# FFE System Enhancements Guide

## Overview
This document describes the three major enhancements made to the FFE (Furniture, Fixtures & Equipment) system for better template management and workspace organization.

## ✅ Feature 1: All Sections Have Preset Items

### What Changed
Previously, only a few sections came with preset items when creating a template. Now, **all sections** in the FFE Management system come with preset items automatically.

### How It Works
1. **FFE Section Library** (`FFESectionLibrary` model in database)
   - Contains default sections like Flooring, Lighting, Furniture, Plumbing, etc.
   - Each section is pre-configured with room type applicability
   - Located in: `prisma/seeds/ffe-system-seed.ts`

2. **Preset Items per Section**
   - When you create a template and choose sections, each section includes sample/default items
   - Examples:
     - **Flooring**: Floor Tile, Area Rug
     - **Lighting**: Vanity Lighting, General Lighting
     - **Plumbing**: Toilet, Vanity & Sink, Faucets, etc.
     - **Furniture**: Bed Frame, Nightstands, Dresser

3. **Database Structure**
   ```
   FFETemplate
     └── FFETemplateSection (e.g., "Flooring")
           └── FFETemplateItem[] (e.g., "Floor Tile", "Area Rug")
   ```

### Where to See It
- **FFE Management** → Create New Template → Select Sections
- Each section will show preset items that can be customized
- Seed file: `prisma/seeds/ffe-system-seed.ts`

---

## ✅ Feature 2: Linked Items Support

### What Changed
Items can now have "linked items" that are automatically added when the parent item is selected. This is perfect for items that require multiple components.

### Example Use Case: Wall Hung Toilet
When you add a "Wall Hung Toilet" item:
- **Parent Item**: Wall Hung Toilet
- **Linked Items** (automatically added):
  1. Flush Plate
  2. Carrier System

Total items in workspace: **3 separate trackable items** (1 parent + 2 linked)

### How It Works

#### 1. In FFE Management (Template Creation)
When creating/editing template items, add linked items in the `linkedItems` field:

```typescript
{
  name: "Wall Hung Toilet",
  description: "Modern wall-mounted toilet system",
  customFields: {
    linkedItems: ["Flush Plate", "Carrier System"]
  }
}
```

#### 2. In FFE Settings (Template Selection)
- Items with linked items show a **collapsible arrow** icon
- Click the arrow to expand and see linked items
- Badge shows "+2 linked" (or number of linked items)
- When expanded, linked items display in an indented, colored section

**Visual Representation:**
```
▶ Wall Hung Toilet  [+2 linked]
```

When expanded:
```
▼ Wall Hung Toilet  [+2 linked]
  └─ 📦 Flush Plate [Auto-linked]
  └─ 📦 Carrier System [Auto-linked]
  💡 These 2 items will be automatically added when "Wall Hung Toilet" is selected
```

#### 3. In FFE Workspace
When the parent item is imported:
- **Parent item** is added to the workspace
- **Each linked item** is automatically added as a separate item
- All items are independently trackable (can be marked pending, confirmed, or not needed)
- Linked items show a badge: `Linked Item`

#### 4. Database Implementation
The `import-template` API route handles linked items automatically:

```typescript
// From: src/app/api/ffe/v2/rooms/[roomId]/import-template/route.ts
// Lines 172-196

if (templateItem.customFields?.linkedItems && Array.isArray(...)) {
  for (const linkedItemName of templateItem.customFields.linkedItems) {
    // Create linked item with:
    - visibility: 'HIDDEN' (until parent is added)
    - customFields: { isLinkedItem: true, parentName: "..." }
    - Separate tracking in workspace
  }
}
```

### New Components

#### `LinkedItemDisplay` Component
Location: `src/components/ffe/v2/FFESettingsMenuEnhanced.tsx`

Features:
- Collapsible/expandable linked items
- Visual indicators (chevron icons)
- Color-coded linked items (blue background)
- Clear labeling with badges

Usage:
```tsx
import { LinkedItemDisplay } from './FFESettingsMenuEnhanced'

<LinkedItemDisplay
  item={item}
  isSelected={selectedItems.has(item.id)}
  onToggle={() => toggleItemSelection(item.id)}
/>
```

---

## ✅ Feature 3: Pending Items Sorted on Top

### What Changed
The FFE Workspace now intelligently sorts items with **pending status on top** under a special "Pending & Undecided" section.

### Priority Order
1. **🟡 Pending & Undecided** - Top priority (amber/orange section)
2. **🔵 In Progress** - Items being worked on
3. **🟢 Confirmed** - Completed items
4. **⚪ Not Needed** - Hidden or excluded items

### Visual Design

#### Pending & Undecided Section (Top)
```
┌─────────────────────────────────────────────┐
│ ⚠️  Pending & Undecided  [5 items]         │
├─────────────────────────────────────────────┤
│ 🕐 Floor Tile                               │
│    [Start Working] [Not Needed]             │
│                                             │
│ 🕐 Vanity Lighting                          │
│    [Start Working] [Not Needed]             │
└─────────────────────────────────────────────┘
```

#### Stats Summary (Always Visible)
```
┌──────────────────────────────────────────────┐
│  5          3          12         2          │
│  Pending    Selected   Confirmed  Not Needed │
└──────────────────────────────────────────────┘
```

### Implementation

#### Utility Functions
Location: `src/lib/ffe/workspace-utils.ts`

**`sortWorkspaceItems(items)`**
- Sorts items by state priority (PENDING first)
- Within same state, maintains original order

**`groupItemsByState(items)`**
- Groups items into: pending, selected, confirmed, notNeeded
- Makes rendering sections easier

**`getStateCounts(items)`**
- Calculates counts for each state
- Used for stats display

Usage:
```typescript
import { sortWorkspaceItems, groupItemsByState } from '@/lib/ffe/workspace-utils'

// Sort with pending on top
const sorted = sortWorkspaceItems(allItems)

// Group for display
const grouped = groupItemsByState(sorted)

// Render:
grouped.pending.map(item => <PendingItem {...item} />)
grouped.selected.map(item => <SelectedItem {...item} />)
grouped.confirmed.map(item => <ConfirmedItem {...item} />)
```

#### Enhanced Workspace Component
Location: `src/components/ffe/v2/FFEWorkspaceEnhanced.tsx`

Features:
- Auto-sorted pending section on top
- Visual separation with colors:
  - Pending: Amber/Orange
  - Selected: Blue
  - Confirmed: Green
- Item counts per section
- State change buttons

---

## Database Schema Support

### All features work with the existing database schema:

```prisma
// FFE Template with sections and items
model FFETemplate {
  id          String
  orgId       String
  sections    FFETemplateSection[]
  // ... other fields
}

model FFETemplateSection {
  id         String
  templateId String
  name       String
  items      FFETemplateItem[]
  // ... other fields
}

model FFETemplateItem {
  id           String
  sectionId    String
  name         String
  customFields Json?  // ← Contains linkedItems array
  // ... other fields
}

// Room instance with items
model RoomFFEItem {
  id           String
  sectionId    String
  name         String
  state        FFEItemState  // PENDING, SELECTED, CONFIRMED, NOT_NEEDED
  visibility   FFEItemVisibility
  customFields Json?  // ← Contains isLinkedItem, parentName
  order        Int
  // ... other fields
}
```

### No Database Modifications Required
- All features use existing `customFields` JSON column
- No schema migrations needed
- Backward compatible with existing data

---

## How to Use

### 1. Creating Templates with Linked Items

In FFE Management:
```typescript
// When creating a template item
const item = {
  name: "Wall Hung Toilet",
  description: "Complete wall-mount system",
  defaultState: "PENDING",
  isRequired: true,
  linkedItems: ["Flush Plate", "Carrier System"]  // ← Linked items
}
```

### 2. Viewing Templates in FFE Settings

```tsx
// Component automatically uses LinkedItemDisplay
// Shows collapsible linked items
<FFESettingsMenu
  roomId={roomId}
  onTemplateImported={() => refetchWorkspace()}
  availableTemplates={templates}
/>
```

### 3. Using Enhanced Workspace

```tsx
// Use the enhanced workspace with auto-sorting
import { FFEWorkspaceEnhanced } from '@/components/ffe/v2/FFEWorkspaceEnhanced'

<FFEWorkspaceEnhanced
  roomId={roomId}
  sections={sections}
  onItemUpdate={(itemId, updates) => {
    // Handle item state changes
  }}
/>
```

---

## Testing Checklist

### ✅ Feature 1: Preset Items
- [ ] Create a new template
- [ ] Select any section (e.g., "Flooring")
- [ ] Verify section comes with preset items
- [ ] Check all sections have preset items

### ✅ Feature 2: Linked Items
- [ ] Create item with `linkedItems: ["Item A", "Item B"]`
- [ ] Open FFE Settings → Import Template
- [ ] Click expand arrow on item with linked items
- [ ] Verify linked items display collapsed/expanded
- [ ] Import the item
- [ ] Check workspace shows 3 items (1 parent + 2 linked)

### ✅ Feature 3: Pending Items Sorting
- [ ] Open FFE Workspace with mixed item states
- [ ] Verify "Pending & Undecided" section is at the top
- [ ] Verify items are sorted: Pending → Selected → Confirmed
- [ ] Change item from Pending to Selected
- [ ] Verify it moves to "In Progress" section

---

## Files Modified/Created

### New Files
1. `src/components/ffe/v2/FFESettingsMenuEnhanced.tsx` - Linked item display component
2. `src/lib/ffe/workspace-utils.ts` - Sorting and grouping utilities  
3. `src/components/ffe/v2/FFEWorkspaceEnhanced.tsx` - Enhanced workspace with sorting

### Modified Files
1. `src/components/ffe/v2/FFESettingsMenu.tsx` - Integrated LinkedItemDisplay

### Database Files
- `prisma/seeds/ffe-system-seed.ts` - Contains preset items for all sections
- `src/app/api/ffe/v2/rooms/[roomId]/import-template/route.ts` - Handles linked items import

---

## API Endpoints

### Import Template with Linked Items
```http
POST /api/ffe/v2/rooms/[roomId]/import-template
Content-Type: application/json

{
  "templateId": "...",
  "selectedItemIds": ["item1", "item2"]
}

Response:
- Creates parent items
- Automatically creates linked items
- All items have separate IDs for tracking
```

### Get Room FFE Data
```http
GET /api/ffe/v2/rooms/[roomId]?onlyVisible=true

Response:
{
  "success": true,
  "data": {
    "sections": [
      {
        "name": "Plumbing",
        "items": [
          { "id": "1", "name": "Wall Hung Toilet", "state": "PENDING" },
          { "id": "2", "name": "Flush Plate", "state": "PENDING", "customFields": { "isLinkedItem": true } },
          { "id": "3", "name": "Carrier System", "state": "PENDING", "customFields": { "isLinkedItem": true } }
        ]
      }
    ]
  }
}
```

---

## Benefits

### For Users
1. **Faster Template Creation** - All sections come with preset items
2. **Better Item Management** - Linked items automatically tracked
3. **Improved Workflow** - Pending items always visible and prioritized
4. **Visual Clarity** - Color-coded sections and states

### For Developers
1. **Reusable Components** - LinkedItemDisplay, workspace utils
2. **Clean Separation** - Sorting logic in utility functions
3. **Type Safety** - TypeScript interfaces for all items
4. **Extensible** - Easy to add more linked item types

---

## Troubleshooting

### Linked Items Not Showing
- Check `customFields.linkedItems` is an array
- Verify API route processes linked items (import-template/route.ts)
- Check item visibility is set correctly

### Pending Items Not on Top
- Verify items have correct state: 'PENDING', 'SELECTED', 'CONFIRMED'
- Check sortWorkspaceItems is being called
- Ensure FFEWorkspaceEnhanced component is used

### Preset Items Missing
- Run seed: `npx prisma db seed`
- Check FFESectionLibrary has data
- Verify orgId in template creation

---

## Future Enhancements

### Possible Additions
1. **Bulk Operations** - Select multiple linked items at once
2. **Dependencies** - Item A requires Item B to be confirmed first
3. **Conditional Items** - Show linked items only if parent is certain state
4. **Custom Linked Item Groups** - User-defined linked item sets
5. **Progress Tracking** - % completion per section with linked items

---

## Support

For questions or issues:
1. Check this documentation
2. Review code comments in the files
3. Check database schema in `prisma/schema.prisma`
4. Examine API routes for linked items processing

## Summary

All three features are now implemented and working with your existing database:

1. ✅ **All sections have preset items** - Defined in seed file and section library
2. ✅ **Linked items support** - Collapsible view in settings, auto-create in workspace  
3. ✅ **Pending items sorted on top** - "Pending & Undecided" section always first

No database deletions or destructive changes were made. All features are backward compatible.

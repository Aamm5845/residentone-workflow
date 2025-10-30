# FFE API Routes Documentation

**Last Updated:** 2025-10-30

This document maps out the FFE (Furniture, Fixtures, and Equipment) API routes to help understand which endpoints are used where and prevent confusion during development.

---

## ⚠️ Important Notes

- **Multiple versions exist**: We have both `/api/ffe/...` and `/api/ffe/v2/...` routes
- **Different behaviors**: Some routes cascade-delete items, others preserve them
- **Frontend inconsistency**: Different components may call different endpoints for similar operations

---

## Section Management

### DELETE Section (with item preservation)
**Route:** `/api/ffe/v2/rooms/[roomId]/sections?sectionId=xxx&deleteItems=true/false`
- **Used by:** `FFESettingsDepartment.tsx`
- **Behavior:** 
  - If `deleteItems=true`: Deletes section AND all items
  - If `deleteItems=false` (default): Moves items to another section or creates "Uncategorized"
  - Can specify `targetSectionId` to choose where items are moved
- **Status:** ✅ ACTIVE - Currently being used

### DELETE Section (cascade delete)
**Route:** `/api/ffe/sections/[sectionId]`
- **Used by:** `ffe-settings-page-client.tsx` (after recent fix)
- **Behavior:** Always cascade-deletes items (Prisma `onDelete: Cascade`)
- **Status:** ✅ ACTIVE - Currently being used

### POST Section
**Route:** `/api/ffe/v2/rooms/[roomId]/sections`
- **Used by:** `FFESettingsDepartment.tsx`
- **Behavior:** Creates new section, optionally with items
- **Status:** ✅ ACTIVE

---

## Item Management

### PATCH Item Visibility
**Route:** `/api/ffe/v2/rooms/[roomId]/items/[itemId]/visibility`
- **Used by:** `FFESettingsDepartment.tsx`
- **Behavior:** Toggles item between VISIBLE/HIDDEN (workspace visibility)
- **Status:** ✅ ACTIVE

### POST/PUT/DELETE Item
**Route:** `/api/ffe/v2/rooms/[roomId]/items/[itemId]`
- **Used by:** `FFESettingsDepartment.tsx`, `ffe-settings-page-client.tsx`
- **Behavior:** CRUD operations for items
- **Status:** ✅ ACTIVE

### POST Duplicate Item
**Route:** `/api/ffe/v2/rooms/[roomId]/items/[itemId]/duplicate`
- **Used by:** `FFESettingsDepartment.tsx`
- **Behavior:** Creates a copy of an item
- **Status:** ✅ ACTIVE

### POST Quantity Include
**Route:** `/api/ffe/v2/rooms/[roomId]/items/[itemId]/quantity-include`
- **Used by:** `FFESettingsDepartment.tsx`
- **Behavior:** Creates multiple copies of an item with specified quantity
- **Features:**
  - If quantity = 1: Simply makes the item visible
  - If quantity > 1: Shows a dialog to name each item individually
  - Custom names are passed as a delimited string (format: `Name 1|||Name 2|||Name 3`)
- **Status:** ✅ ACTIVE

---

## Instance Management

### GET Instance
**Route:** `/api/ffe/instances?roomId=xxx`
- **Used by:** `ffe-settings-page-client.tsx`
- **Behavior:** Fetches room FFE instance with all sections and items
- **Status:** ✅ ACTIVE

### GET Room Data (v2)
**Route:** `/api/ffe/v2/rooms/[roomId]?includeHidden=true/false`
- **Used by:** `FFESettingsDepartment.tsx`
- **Behavior:** Fetches room FFE data, can include/exclude hidden items
- **Status:** ✅ ACTIVE

---

## Template Management

### GET Templates
**Route:** `/api/ffe/v2/templates?orgId=xxx`
- **Used by:** Both settings components
- **Behavior:** Lists all FFE templates for an organization
- **Status:** ✅ ACTIVE

### POST Import Template
**Route:** `/api/ffe/v2/rooms/[roomId]/import-template`
- **Used by:** Both settings components
- **Behavior:** Imports a template into a room
- **Status:** ✅ ACTIVE

---

## Frontend Components Using FFE APIs

### 1. `FFESettingsDepartment.tsx`
**Primary API Pattern:** `/api/ffe/v2/rooms/[roomId]/...`
- ✅ Uses v2 section endpoint with `deleteItems=true` parameter
- ✅ Uses v2 item endpoints
- ✅ Includes item visibility management

### 2. `ffe-settings-page-client.tsx`
**Mixed API Pattern:**
- Uses `/api/ffe/instances` for data fetching
- Uses `/api/ffe/sections/[sectionId]` for section deletion (cascade delete)
- Uses `/api/ffe/v2/rooms/[roomId]/items` for item operations

---

## Database Schema Notes

### Cascade Deletion
The Prisma schema has `onDelete: Cascade` set for:
```prisma
model RoomFFEItem {
  section  RoomFFESection @relation(..., onDelete: Cascade)
}
```
This means if you delete a section using Prisma's `.delete()` without custom logic, all items are automatically deleted.

### Item Visibility
- `VISIBLE`: Item shows in workspace
- `HIDDEN`: Item exists but not shown in workspace (default for new items)
- Label in UI: "Not in Workspace" instead of "Hidden"

---

## Recommendations for Future Development

1. **When modifying section deletion:**
   - Check which route the frontend component is calling
   - Understand if items should be preserved or deleted
   - Update user-facing messages accordingly

2. **When adding new FFE features:**
   - Prefer using `/api/ffe/v2/...` routes (more flexible)
   - Document which components use the new endpoints
   - Consider whether existing routes could be reused

3. **Before consolidating routes:**
   - Create comprehensive tests
   - Ensure all frontend components are migrated
   - Keep old routes as deprecated but functional during transition

---

## Quick Reference: Which Route for What?

| Action | Recommended Route | Notes |
|--------|------------------|-------|
| Delete section + items | `/api/ffe/v2/rooms/[roomId]/sections?deleteItems=true` | Explicit control |
| Delete section, preserve items | `/api/ffe/v2/rooms/[roomId]/sections?deleteItems=false` | Moves to another section |
| Simple cascade delete | `/api/ffe/sections/[sectionId]` | Uses DB cascade |
| Create section | `/api/ffe/v2/rooms/[roomId]/sections` | Can include initial items |
| Toggle item visibility | `/api/ffe/v2/rooms/[roomId]/items/[itemId]/visibility` | Workspace visibility |
| Duplicate item | `/api/ffe/v2/rooms/[roomId]/items/[itemId]/duplicate` | Creates copy |
| Get room data | `/api/ffe/v2/rooms/[roomId]` or `/api/ffe/instances` | Both work, v2 preferred |

---

## Changelog

- **2025-10-30**: Initial documentation created
- **2025-10-30**: Updated `FFESettingsDepartment.tsx` to use `deleteItems=true` parameter
- **2025-10-30**: Changed "Hidden" label to "Not in Workspace" in UI
- **2025-10-30**: Added quantity naming feature - users can now name each item when adding multiple quantities
- **2025-10-30**: Added warning dialog when deleting items that are visible in workspace
- **2025-10-30**: Simplified template import dialog text

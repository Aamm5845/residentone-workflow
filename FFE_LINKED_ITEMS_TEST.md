# FFE Linked Items Feature - Testing Guide

## Overview
This feature allows you to create parent-child relationships in FFE templates. When you add a parent item to the workspace, all its linked children are automatically added as separate, independent items.

## Example Use Case
**Parent Item:** Wall mount toilet  
**Linked Items:**
- Flush plate
- Carrier system

When you add "Wall mount toilet" to workspace → All 3 items appear as separate items in the workspace.

## How to Test

### Step 1: Create a Template with Linked Items

1. Go to **FFE Management** → **Templates**
2. Create or edit a template
3. Add a section (e.g., "Bathroom Fixtures")
4. Add a parent item:
   - Name: "Wall mount toilet"
   - Description: "Complete wall-mounted toilet system"
5. In the item editor, add linked items:
   - Click "Add Linked Item"
   - Enter "Flush plate"
   - Click "Add Linked Item" again
   - Enter "Carrier system"
6. Save the template

### Step 2: Import Template to a Room

1. Navigate to a project room (e.g., Bathroom)
2. Open **FFE Settings**
3. Click **Import Template**
4. Select the template you just created
5. Import it

### Step 3: Verify in FFE Settings

1. In FFE Settings, find the "Bathroom Fixtures" section
2. You should see "Wall mount toilet" with:
   - A **chevron icon** (>) indicating it has children
   - A badge showing "2 linked"
3. Click the chevron to expand
4. You should see the 2 linked items nested underneath:
   - Flush plate (marked as "Linked item")
   - Carrier system (marked as "Linked item")
5. All items should be marked as "Not Included" (hidden)

### Step 4: Add Parent Item to Workspace

1. Click the **Add** button (green +) on "Wall mount toilet"
2. The parent item should:
   - Change to green background
   - Show green checkmark
   - Display "Remove" button
3. **All linked children should automatically change too**:
   - Both "Flush plate" and "Carrier system" should turn green
   - All marked as "Included"

### Step 5: Verify in Workspace

1. Navigate to **FFE Workspace**
2. You should see **3 separate items**:
   - Wall mount toilet
   - Flush plate
   - Carrier system
3. Each item should be:
   - Independent (no parent-child relationship in workspace)
   - Manageable individually (can change state, add notes, etc.)
   - Count as separate items in progress tracking

### Step 6: Test Removal

1. Go back to **FFE Settings**
2. Click **Remove** button on the parent item "Wall mount toilet"
3. Verify:
   - Parent turns back to white/gray background
   - All linked children also turn back to hidden
   - All 3 items should disappear from workspace

## Expected Behavior Summary

### In FFE Settings:
- ✅ Parent items display with expand/collapse chevron
- ✅ "X linked" badge shows number of children
- ✅ Expand to see nested child items
- ✅ Children show as "Linked item" with link icon
- ✅ Info message explains behavior
- ✅ Adding parent automatically adds all children
- ✅ Removing parent automatically removes all children

### In FFE Workspace:
- ✅ Parent and children appear as **separate, independent items**
- ✅ No visual parent-child relationship (all are standard items)
- ✅ Each item can be managed individually
- ✅ Each counts toward item totals
- ✅ Linked items are marked as "Custom" or have "Linked Item" badge

## Database Structure

### Template Storage
```json
{
  "name": "Wall mount toilet",
  "customFields": {
    "linkedItems": ["Flush plate", "Carrier system"]
  }
}
```

### After Import (Room Instance)
Parent Item:
```json
{
  "id": "parent-123",
  "name": "Wall mount toilet",
  "customFields": {
    "hasChildren": true,
    "linkedItems": ["Flush plate", "Carrier system"]
  }
}
```

Child Items:
```json
{
  "id": "child-456",
  "name": "Flush plate",
  "customFields": {
    "isLinkedItem": true,
    "parentName": "Wall mount toilet"
  }
}
```

## API Endpoints

### Visibility Update (PATCH)
`/api/ffe/v2/rooms/[roomId]/items/[itemId]/visibility`

When updating parent item visibility:
1. Detects `customFields.hasChildren === true`
2. Finds all children where `customFields.isLinkedItem === true` and `customFields.parentName === parentName`
3. Updates parent and all children in a transaction

## Troubleshooting

### Issue: Children don't update when parent is added
- Check that parent has `customFields.hasChildren === true`
- Verify children have `customFields.isLinkedItem === true`
- Check `parentName` matches exactly

### Issue: Children show in settings but not as nested
- Verify `linkedChildren` prop is passed to FFEItemCard
- Check that children have proper `customFields` structure
- Ensure `customFields?.isLinkedItem` filter is working

### Issue: Children appear twice in settings
- Check filter: `.filter(item => !(item.customFields?.isLinkedItem))`
- This should prevent children from rendering at top level

## Technical Implementation

### Files Modified:
1. **`visibility/route.ts`** - API handles parent-child updates
2. **`FFEItemCard.tsx`** - Displays parent with expand/collapse, shows nested children
3. **`FFESettingsDepartment.tsx`** - Filters and passes linked children data
4. **`import-template/route.ts`** - Creates linked items during template import

### Key Features:
- 🎯 Expand/collapse UI for parent items
- 🔗 Visual badges showing linked relationships
- ⚡ Automatic visibility sync (parent ↔ children)
- 📊 Proper item counting and statistics
- 🎨 Color-coded feedback (green = included)

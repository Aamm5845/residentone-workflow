# FFE Management Workflow Test Plan

This document outlines the test cases to verify that all the implemented changes work correctly.

## Changes Implemented

1. **API Routes Updated to Use Database**
   - Modified `src/app/api/ffe/room-libraries/route.ts` to use FFELibraryItem Prisma model
   - Updated `src/app/api/ffe/room-libraries/[id]/route.ts` to save/load from database
   - API now persists data to `FFELibraryItem` table instead of returning mock data

2. **Bathroom Template Cleared**
   - Removed all preset items from `src/lib/ffe/bathroom-template.ts`
   - All categories now start empty: Flooring, Wall, Ceiling, etc.

3. **Two-Stage Special Logic UI**
   - Stage 1: Enter custom logic options (like "Porcelain", "Mosaic", "Custom")
   - Stage 2: Define sub-items/tasks to create for each option
   - Intuitive navigation between stages with clear progress indicators

4. **Fixed Library Update Functionality**
   - Updates are saved to database immediately
   - UI refreshes to show changes after save operations
   - Proper state management for selected library updates

## Test Cases to Verify

### 1. Database Persistence Test
- [ ] Add a new item to bathroom library
- [ ] Refresh the page
- [ ] Verify the item still appears (confirming database persistence)

### 2. Special Logic Two-Stage Interface Test
- [ ] Create a new item with special logic enabled
- [ ] Stage 1: Enter options like "Porcelain, Mosaic, Custom"
- [ ] Navigate to Stage 2
- [ ] For each option, define sub-items to create
- [ ] Save the item
- [ ] Verify special logic is properly saved and displayed

### 3. Empty Template Verification
- [ ] Navigate to bathroom library
- [ ] Confirm all categories are empty initially
- [ ] Add items manually through the UI
- [ ] Verify items appear correctly

### 4. Update Functionality Test
- [ ] Edit an existing item
- [ ] Modify its properties (name, options, special logic)
- [ ] Save changes
- [ ] Verify changes appear immediately in the UI
- [ ] Refresh page and confirm changes persist

### 5. Category Management Test
- [ ] Add a new category
- [ ] Add items to the new category
- [ ] Delete the category (should fail if it has items)
- [ ] Remove all items from category, then delete category
- [ ] Verify operations work correctly

## Expected Behavior

1. **Data Persistence**: All changes should be saved to the database and persist across page reloads
2. **UI Updates**: Changes should be reflected immediately in the UI without requiring manual refresh
3. **Special Logic**: Two-stage interface should be intuitive and allow flexible configuration
4. **Error Handling**: Proper error messages for invalid operations
5. **Performance**: Operations should complete quickly without UI freezing

## Database Schema Verification

The changes utilize the existing `FFELibraryItem` model with fields:
- `orgId`: Organization identifier
- `itemId`: Unique item identifier
- `name`: Item name
- `category`: Category name
- `roomTypes`: Array of applicable room types
- `isRequired`: Boolean for required items
- `standardConfig`: JSON for standard options
- `subItems`: JSON for special logic configuration
- Created/updated by and timestamp fields

## Notes

- All changes maintain backward compatibility
- Existing data structures are preserved
- UI is responsive and user-friendly
- Error handling is comprehensive
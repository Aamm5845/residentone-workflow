# FFE Workspace Deep Analysis

## Date: 2025-10-29

## Summary
Comprehensive audit of FFE workspace structure, identifying inconsistencies, routing issues, and architectural problems.

---

## 1. ROUTING STRUCTURE ✅ (Clean)

### Page Routes
- `/ffe/[roomId]/workspace/page.tsx` - Workspace view
- `/ffe/[roomId]/settings/page.tsx` - Settings view

Both routes use `FFEDepartmentRouter` component with different `initialMode` props.

### API Routes
**V2 API (Current/Active)**:
- `/api/ffe/v2/rooms/[roomId]/route.ts` - Main FFE instance endpoint
- `/api/ffe/v2/rooms/[roomId]/items/route.ts` - Item management
- `/api/ffe/v2/rooms/[roomId]/sections/route.ts` - Section management
- `/api/ffe/v2/templates/` - Template management

**Legacy APIs (Should be evaluated for removal)**:
- `/api/ffe/room/[roomId]/` - Old room API
- `/api/ffe/instances/` - Old instance API
- `/api/ffe/items/` - Old items API

### Status: ✅ Clean, but legacy APIs need cleanup

---

## 2. DATABASE SCHEMA ✅ (Consistent)

### Core Models (V2 - Current Active Schema)
```prisma
- FFETemplate (id, orgId, name, status, sections)
- FFETemplateSection (id, templateId, name, order, items)
- FFETemplateItem (id, sectionId, name, defaultState, order)
- RoomFFEInstance (id, roomId, templateId, status, progress, sections)
- RoomFFESection (id, instanceId, name, order, items)
- RoomFFEItem (id, sectionId, name, state, visibility, order)
```

### Legacy Models (Old Schema - Partially Used)
```prisma
- FFEItem (old, uses FFEStatus enum)
- FFEItemStatus (old state tracking)
- FFELibraryItem (library management)
- FFEBathroomState (specific bathroom logic)
```

### Enums
```prisma
- FFEItemState: PENDING | UNDECIDED | CONFIRMED | SKIPPED
- FFEItemVisibility: VISIBLE | HIDDEN
- FFEInstanceStatus: NOT_STARTED | IN_PROGRESS | COMPLETED
- FFETemplateStatus: DRAFT | ACTIVE | ARCHIVED
```

### Status: ✅ V2 schema is clean and well-structured

---

## 3. COMPONENT ARCHITECTURE ⚠️ (Issues Found)

### Active Components (V2)
```
components/ffe/
├── FFEDepartmentRouter.tsx          ← Main router component
├── FFESettingsDepartment.tsx        ← Settings mode
├── v2/
│   ├── FFEPhaseWorkspace.tsx        ← Workspace mode (PROBLEM HERE)
│   ├── FFESectionAccordion.tsx      ← Section display
│   ├── FFEItemCard.tsx              ← Item cards
│   ├── NotesDrawer.tsx              ← Notes sidebar
│   ├── TemplateSelector.tsx         ← Template import
│   └── LoadingState.tsx             ← Loading UI
```

### Legacy/Unused Components (Should be reviewed)
```
components/ffe/
├── BathroomFFEWorkspace.tsx         ← Old bathroom-specific
├── EnhancedBathroomFFE.tsx          ← Enhanced old version
├── EnhancedFFERoomView.tsx          ← Old room view
├── FFEWorkspaceDepartment.tsx       ← Old workspace
├── UnifiedFFEWorkspace.tsx          ← Old unified view
├── interactive-ffe-phase.tsx        ← Old interactive
└── common/FFEItemCard.tsx           ← Duplicate item card
```

### Status: ⚠️ Multiple duplicate/legacy components causing confusion

---

## 4. CRITICAL ISSUES FOUND 🔴

### Issue #1: Header Display Problem
**Location**: `FFEPhaseWorkspace.tsx`
**Problem**: 
- Component was designed to show its own header when `showHeader={true}`
- We removed the header code in recent fixes
- FFEDepartmentRouter already provides a header (lines 184-230)
- This creates a conflict where no header appears

**Current State**:
```tsx
// FFEDepartmentRouter.tsx (line 251)
showHeader={true}  // ← Passes true but component has no header code

// FFEPhaseWorkspace.tsx
// Header code was removed, so nothing renders
```

**Solution**: 
- FFEPhaseWorkspace should never show its own header
- FFEDepartmentRouter already provides all necessary navigation
- Remove `showHeader` prop entirely from FFEPhaseWorkspace

---

### Issue #2: Duplicate Component Versions
**Problem**: Multiple versions of similar components exist:
- `FFEItemCard.tsx` (common)
- `FFEItemCard.tsx` (v2)
- `FFEWorkspaceDepartment.tsx` vs `FFEPhaseWorkspace.tsx`

**Impact**: Confusion about which component to use/modify

**Solution**: Remove or archive legacy components

---

### Issue #3: Legacy API Routes Active
**Problem**: Old API routes still exist and may conflict:
- `/api/ffe/room/[roomId]/` (old)
- `/api/ffe/v2/rooms/[roomId]/` (new)

**Impact**: Confusion about which API to call, potential bugs

**Solution**: Deprecate and remove old routes after verifying no usage

---

### Issue #4: Inconsistent State Management
**Problem**: Two state patterns coexist:
1. Old: `FFEItemStatus` model with `state` field
2. New: `RoomFFEItem` model with `state` and `visibility` fields

**Impact**: Potential data inconsistency

**Solution**: Ensure all code uses V2 models exclusively

---

## 5. RECOMMENDED FIXES

### Priority 1: Fix Header Display 🔴
```tsx
// 1. Update FFEPhaseWorkspace.tsx
// Remove showHeader prop from interface
// Component should ONLY render content, no header

// 2. Update FFEDepartmentRouter.tsx (line 251)
<FFEPhaseWorkspace
  roomId={roomId}
  roomType=""
  orgId={orgId || ''}
  projectId={projectId || ''}
  onProgressUpdate={handleWorkspaceProgressUpdate}
  // Remove: showHeader={true}
  // Remove: filterUndecided={false}
  roomName={roomName}
  projectName={projectName}
/>
```

### Priority 2: Clean Up Components 🟡
```bash
# Move to archive folder
/components/ffe/archive/
├── BathroomFFEWorkspace.tsx
├── EnhancedBathroomFFE.tsx
├── EnhancedFFERoomView.tsx
├── FFEWorkspaceDepartment.tsx
├── UnifiedFFEWorkspace.tsx
└── interactive-ffe-phase.tsx
```

### Priority 3: Remove Legacy APIs 🟡
```bash
# Mark for deprecation (add deprecation notice)
/api/ffe/room/
/api/ffe/instances/
/api/ffe/items/ (old)
```

### Priority 4: Database Cleanup 🟢
```sql
-- No immediate action needed
-- V2 schema is clean
-- Keep old models for now (may have legacy data)
-- Add migration plan if needed to convert old data
```

---

## 6. ARCHITECTURE DECISION RECORD

### Current Architecture (V2)
```
Pages → FFEDepartmentRouter → Mode-specific Component
                          ├── FFESettingsDepartment (Settings)
                          └── FFEPhaseWorkspace (Workspace)
                                    ↓
                              V2 API Routes
                                    ↓
                              Prisma (V2 Schema)
```

### Recommended Architecture (Same, Simplified)
```
Pages → FFEDepartmentRouter (Provides ALL navigation/headers)
            ├── FFESettingsDepartment (Settings mode - content only)
            └── FFEPhaseWorkspace (Workspace mode - content only)
                      ↓
                 V2 API Routes (Remove legacy)
                      ↓
                 Prisma V2 Schema
```

**Key Principle**: 
- Router handles ALL navigation, headers, mode switching
- Child components handle ONLY their content
- No duplicate headers or navigation elements

---

## 7. VERIFICATION CHECKLIST

After implementing fixes, verify:

- [ ] Header appears correctly in both workspace and settings modes
- [ ] Navigation between modes works (buttons/links)
- [ ] Progress indicator shows in workspace mode
- [ ] Items load and display correctly
- [ ] State changes (Pending → Undecided → Completed) work
- [ ] Visibility toggle (Use/Remove) works in settings
- [ ] Notes sidebar functions correctly
- [ ] Template import works
- [ ] No console errors
- [ ] Database queries use V2 schema exclusively

---

## 8. NEXT STEPS

1. **Immediate** (fix header):
   - Remove header rendering from FFEPhaseWorkspace
   - Remove `showHeader` prop
   - Test both workspace and settings modes

2. **Short-term** (clean up):
   - Move legacy components to archive folder
   - Add deprecation notices to old APIs
   - Document which components/APIs are active

3. **Long-term** (if needed):
   - Remove archived components after 1-2 releases
   - Remove legacy API routes
   - Consider data migration for old FFE models

---

## FILES TO MODIFY (Priority Order)

1. `src/components/ffe/v2/FFEPhaseWorkspace.tsx` - Remove header, fix structure
2. `src/components/ffe/FFEDepartmentRouter.tsx` - Remove showHeader prop usage
3. Create `src/components/ffe/archive/` folder
4. Move legacy components to archive
5. Add API deprecation notices

---

## CONCLUSION

**Root Cause**: Recent header removal created a gap where FFEDepartmentRouter passes `showHeader={true}` but FFEPhaseWorkspace no longer has header code. Additionally, FFE pages didn't match the standard stage header layout used by other phases.

**Solution**: 
1. Clean separation of concerns - router handles ALL UI chrome, content components handle ONLY content.
2. Standardize FFE pages to use DashboardLayout and standard phase header format
3. Remove redundant headers from FFEDepartmentRouter when embedded

**Status**: ✅ FIXED - Implemented and deployed. FFE now matches other phases exactly.

---

## FIXES APPLIED (2025-10-29)

### Fix #1: Removed Props from FFEPhaseWorkspace
- Removed `showHeader` prop (no longer needed)
- Removed `filterUndecided` prop (not used)
- Component now renders content only

### Fix #2: Standardized Page Layout
Both `/ffe/[roomId]/workspace/page.tsx` and `/ffe/[roomId]/settings/page.tsx` now:
- Use `DashboardLayout` wrapper (like other phases)
- Include standard header with:
  - Back arrow button → returns to project
  - Title: "FFE Phase" or "FFE Settings"
  - Breadcrumb: Room • Project • Client
- Embed FFEDepartmentRouter for content only

### Fix #3: Cleaned FFEDepartmentRouter
- When `showModeToggle={false}`, no header is rendered
- Router only manages switching between workspace/settings modes
- All chrome (headers, navigation) handled by parent pages

### Result:
✅ FFE workspace header now matches other phases exactly
✅ Consistent navigation experience across all phases
✅ Clean component hierarchy
✅ Build succeeds with no errors

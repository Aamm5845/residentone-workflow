# Design Concept Workspace Versions

## Issue Summary
There are **TWO** different workspace components for the Design Concept phase, which can cause confusion.

## The Two Versions

### 1. **DesignConceptWorkspace.tsx** (Original/Simple Version)
- **Location:** `src/components/design/DesignConceptWorkspace.tsx`
- **Style:** Clean, professional interface with expandable sections
- **Features:**
  - Standard section layout
  - Basic file upload
  - Simple comments
  - Activity timeline
  - Chat sidebar

### 2. **BedroomDesignWorkspace.tsx** (Enhanced/Pinterest-style Version) ✅ CURRENTLY ACTIVE
- **Location:** `src/components/design/BedroomDesignWorkspace.tsx`
- **Style:** Modern, Pinterest-inspired reference board interface
- **Features:**
  - Rich visual image gallery with grid layout
  - Image notes and annotations
  - Enhanced threaded comments with @mentions
  - Custom section creation
  - Status workflows (Draft → In Review → Finalized)
  - Design notifications
  - More interactive UI elements

## Current Configuration

The system currently uses **BedroomDesignWorkspace** as shown in:
```typescript
// src/components/stages/design-concept-stage.tsx (line 37)
<BedroomDesignWorkspace
  stageId={stage.id}
  roomId={room?.id || stage.roomId}
  projectId={project?.id || stage.projectId || room?.projectId}
  className="shadow-xl"
/>
```

## Issues Fixed

### Issue #1: Backend Call Confusion ✅
- **Problem:** Two different components calling similar API endpoints
- **Resolution:** Documented which version is active and why
- **Recommendation:** Keep BedroomDesignWorkspace as it has more features

### Issue #2: Section Count Mismatch ✅ FIXED
- **Problem:** Top bar showed dynamic count from DB (could be 0-3), but UI always renders 4 default sections
- **Root Cause:** Backend counted actual DB sections, frontend hardcoded 4 default sections
- **Fix:** Modified section count display to always show: `4 default sections + custom sections`
- **Location:** `BedroomDesignWorkspace.tsx` line 862-865

### Issue #3: Add Section Error ✅ FIXED
- **Problem:** API response format mismatch when creating new section
- **Root Cause:** POST endpoint returned raw `designSection` but frontend expected `{ success: true, section: designSection }`
- **Fix:** Updated API response format in `/api/stages/[id]/sections/route.ts` line 355-358

## Default Sections

The 4 default sections that are always rendered:
1. **GENERAL** - Overall design concept, mood, and styling direction
2. **WALL_COVERING** - Wall treatments, paint colors, wallpaper, and finishes
3. **CEILING** - Ceiling design, treatments, lighting integration, and details
4. **FLOOR** - Flooring materials, patterns, transitions, and area rugs

## Custom Sections

Users can add unlimited custom sections beyond the 4 defaults (e.g., "Lighting", "Furniture", "Accessories").

## Recommendation

**Keep using BedroomDesignWorkspace** as the active version because:
1. ✅ More modern, user-friendly interface
2. ✅ Pinterest-style reference boards
3. ✅ Better image management
4. ✅ Enhanced collaboration features
5. ✅ Status workflow management
6. ✅ @mention support in comments

If you want to switch back to the simpler version, edit `design-concept-stage.tsx` and uncomment lines 48-55.

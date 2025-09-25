# 🚫 Phase "Not Applicable" Feature

## Overview

The Phase "Not Applicable" feature allows team members to mark certain workflow phases as not needed for specific rooms, improving project accuracy and progress calculations.

## Why This Feature?

In interior design projects, not every room requires all 5 phases:
- **Powder rooms** might not need FFE (furniture)
- **Closets** might not need 3D rendering
- **Hallways** might only need basic design concepts
- **Storage rooms** might skip client approval

## How It Works

### ✅ **New Status: NOT_APPLICABLE**
- Added to the database schema as a new `StageStatus` enum value
- Phases marked as "Not Applicable" are excluded from:
  - Progress calculations
  - Workflow dependencies
  - Team assignments

### 🎯 **Smart Progress Calculations**
- **Before**: Progress = Completed Phases / 5 Total Phases (always)
- **After**: Progress = Completed Phases / Applicable Phases Only

**Example**:
- Room with 5 phases: 3 completed, 2 not applicable = **100% complete** ✅
- Room with 5 phases: 3 completed, 2 pending = **60% complete** ⏳

### 🎨 **Visual Design**
- **NOT_APPLICABLE phases** show with:
  - Slate gray colors (`bg-slate-100`, `text-slate-700`)
  - "➖" icon instead of phase icons
  - Reduced opacity (75%) to appear "dimmed"
  - Clear "Not Applicable" label

### 🔧 **User Interface**

#### **Phase Cards**
- **Pending phases**: Show "Start Phase" + "Mark Not Applicable" buttons
- **Completed phases**: Show "Reopen" + "Mark Not Applicable" buttons  
- **Not applicable phases**: Show explanation + "Mark Applicable" button

#### **Room Overview**
- Mini phase indicators show NOT_APPLICABLE phases in slate gray
- Stage summary shows: "X completed, Y active, Z pending, W n/a"

#### **Project Dashboard**
- Room cards calculate progress excluding NOT_APPLICABLE phases
- Phase indicators show appropriate colors for each status

## API Endpoints

### Individual Phase Management
```typescript
PATCH /api/stages/{stageId}
{
  "action": "mark_not_applicable"  // or "mark_applicable"
}
```

### Bulk Phase Management
```typescript
PATCH /api/rooms/{roomId}/phases/bulk
{
  "phaseUpdates": [
    { "stageType": "FFE", "status": "NOT_APPLICABLE" },
    { "stageType": "THREE_D", "status": "NOT_APPLICABLE" }
  ]
}
```

## Database Changes

### Schema Update
```prisma
enum StageStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  ON_HOLD
  NEEDS_ATTENTION
  PENDING_APPROVAL
  REVISION_REQUESTED
  NOT_APPLICABLE  // ← NEW
}
```

### Migration Applied
- Database schema updated with `NOT_APPLICABLE` status
- Existing phases remain unchanged (backward compatible)

## Team Benefits

### 🎯 **Accurate Project Tracking**
- Progress percentages reflect actual work scope
- No false "incomplete" rooms due to irrelevant phases

### ⚡ **Streamlined Workflow**
- Team members focus only on applicable phases
- Reduced clutter in phase boards and dashboards

### 📊 **Better Reporting** 
- Project completion metrics are more meaningful
- Client reporting shows realistic progress

### 🏠 **Room-Specific Flexibility**
- Each room can have its own relevant phase set
- Perfect for different room types and project scopes

## Usage Examples

### Powder Room
```
✅ Design Concept: COMPLETED
➖ 3D Rendering: NOT_APPLICABLE
✅ Client Approval: COMPLETED  
✅ Drawings: COMPLETED
➖ FFE: NOT_APPLICABLE

Progress: 100% (3/3 applicable phases)
```

### Master Bedroom  
```
✅ Design Concept: COMPLETED
✅ 3D Rendering: COMPLETED
✅ Client Approval: COMPLETED
✅ Drawings: COMPLETED
⏳ FFE: IN_PROGRESS

Progress: 80% (4/5 applicable phases)
```

### Closet
```
✅ Design Concept: COMPLETED
➖ 3D Rendering: NOT_APPLICABLE
➖ Client Approval: NOT_APPLICABLE
✅ Drawings: COMPLETED
✅ FFE: COMPLETED

Progress: 100% (3/3 applicable phases)
```

## Technical Implementation

### Constants Updated
- Added `NOT_APPLICABLE` to `PHASE_STATUS` enum
- Added slate color classes for visual consistency
- Updated status mapping functions

### Components Updated
- `PhaseCard`: Handles NOT_APPLICABLE display and actions
- `RoomPhaseBoard`: Supports status change to/from NOT_APPLICABLE
- Project pages: Exclude NOT_APPLICABLE from progress calculations

### Activity Logging
- New activity types: `STAGE_MARKED_NOT_APPLICABLE`, `STAGE_MARKED_APPLICABLE`
- Full audit trail of phase status changes
- IP tracking for security

This feature significantly improves project management accuracy for interior design workflows! 🎉
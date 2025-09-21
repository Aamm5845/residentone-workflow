# Design Concept Workspace Integration

## How to integrate the DesignConceptWorkspace into existing room pages

The `DesignConceptWorkspace` component is designed to replace the existing design stage functionality with a more comprehensive and professional interface.

### Integration Steps:

1. **Replace existing design stage components** in room detail pages
2. **Update stage type mapping** to handle DESIGN_CONCEPT stages
3. **Add workspace routing** for direct access to design concept phases

### Example Integration in Room Detail Page:

```tsx
// In src/app/rooms/[roomId]/page.tsx or similar
import { DesignConceptWorkspace } from '@/components/design/DesignConceptWorkspace'

export default function RoomDetailPage({ params }: { params: { roomId: string } }) {
  const { roomId } = params
  
  // Fetch room data to get stage information
  const { data: room } = useSWR(`/api/rooms/${roomId}`, fetcher)
  
  // Find the DESIGN_CONCEPT stage
  const designConceptStage = room?.stages?.find(stage => stage.type === 'DESIGN_CONCEPT')
  
  if (designConceptStage && designConceptStage.status !== 'NOT_STARTED') {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <DesignConceptWorkspace
          roomId={roomId}
          projectId={room.projectId}
          stageId={designConceptStage.id}
          className="mb-8"
        />
        
        {/* Other room content below */}
      </div>
    )
  }
  
  // Fallback to existing room interface if design concept hasn't started
  return <ExistingRoomInterface room={room} />
}
```

### URL Structure:

- Direct workspace access: `/rooms/{roomId}/design-concept`
- Embedded in room page: `/rooms/{roomId}` (when DESIGN_CONCEPT stage is active)
- Project-level view: `/projects/{projectId}/rooms/{roomId}/design-concept`

### Component Props:

```tsx
interface DesignConceptWorkspaceProps {
  roomId: string      // Required: Room identifier
  projectId: string   // Required: Project identifier  
  stageId: string     // Required: DESIGN_CONCEPT stage identifier
  className?: string  // Optional: Additional CSS classes
}
```

### Features Included:

✅ **Professional Header** with project context and progress tracking
✅ **Four Design Sections**: General, Wall Covering, Ceiling, Floor
✅ **Real-time Updates** via SWR with automatic refresh
✅ **Phase Completion** with automatic notifications
✅ **Activity Timeline** showing all workspace interactions
✅ **Responsive Design** optimized for desktop and tablet
✅ **Error Handling** with retry mechanisms
✅ **Loading States** with proper feedback

### API Endpoints Used:

- `GET /api/stages/{stageId}/sections` - Main workspace data
- `GET /api/design/complete?stageId={stageId}` - Completion status
- `POST /api/design/complete` - Mark phase complete
- `GET /api/stages/{stageId}/activity` - Activity timeline

### Next Steps:

1. **Complete Section Implementation** - Add upload zones, notes, checklists, and tagging
2. **Add Authentication Integration** - Connect with existing auth system
3. **Performance Optimization** - Add lazy loading and caching
4. **Mobile Responsiveness** - Optimize for mobile devices
5. **Testing & QA** - Add comprehensive test coverage

### Migration from Existing Design Stage:

The new workspace is designed to be a drop-in replacement for the existing `design-stage.tsx` component. The migration involves:

1. **Update routing** to use the new workspace component
2. **Map existing data** from old section types to new ones:
   - `WALLS` → `WALL_COVERING`
   - `FURNITURE` → `GENERAL`  
   - `LIGHTING` → `CEILING`
   - `GENERAL` → `GENERAL` (no change)
3. **Run migration script** to update existing data (already created)
4. **Update any hardcoded references** to old section types

The component maintains backward compatibility and handles missing sections gracefully.
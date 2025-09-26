# Enhanced FFE System with Dynamic Standard/Custom Support

This system provides a comprehensive solution for managing Furniture, Fixtures & Equipment (FFE) with dynamic standard/custom item behavior that persists across projects.

## Key Features

### 🎯 Dynamic Item Types
- **Base Items**: Simple checkbox items (confirmed/not needed)
- **Standard vs Custom**: Items where users choose between pre-defined options or custom configuration
- **Custom Only**: Items that always expand to show detailed sub-options
- **Conditional**: Items that appear based on other selections

### 🔄 Persistent General Settings
- Settings automatically save to organization-level templates
- New projects inherit previous configurations
- Reduces setup time for similar rooms

### 📋 Hierarchical Sub-Items
- Custom items expand to show relevant sub-options
- Conditional visibility (e.g., fabric options only show when fabric material is selected)
- Required vs optional sub-items
- Multiple input types: selections, colors, checkboxes, text inputs

## Usage Examples

### Bedroom Example

```typescript
// The bed item in a bedroom
{
  id: 'bed',
  name: 'Bed',
  itemType: 'standard_or_custom',
  hasStandardOption: true,
  hasCustomOption: true,
  
  standardConfig: {
    description: 'Select from our standard bed collection',
    options: ['Platform Bed - King', 'Platform Bed - Queen', ...]
  },
  
  customConfig: {
    description: 'Design a custom bed',
    subItems: [
      {
        id: 'material',
        name: 'Material',
        type: 'selection',
        options: ['Fabric', 'Wood', 'Metal', 'Leather'],
        isRequired: true
      },
      // Fabric options only show when Fabric is selected
      {
        id: 'fabric_type',
        name: 'Fabric Type',
        type: 'selection',
        options: ['Linen', 'Velvet', 'Cotton', ...],
        dependsOn: ['material'],
        isRequired: true
      }
    ]
  }
}
```

### Bathroom Vanity Example

```typescript
// Standard vanity = single dropdown selection
// Custom vanity = cabinet style + color + counter + handles + sinks
{
  id: 'vanity',
  itemType: 'standard_or_custom',
  standardConfig: {
    options: ['24" Single Sink', '36" Single Sink', '48" Single Sink', ...]
  },
  customConfig: {
    subItems: [
      { id: 'cabinet', name: 'Cabinet Style', type: 'selection', ... },
      { id: 'color', name: 'Cabinet Color', type: 'color', ... },
      { id: 'counter', name: 'Counter Material', type: 'selection', ... },
      { id: 'handles', name: 'Handles', type: 'selection', ... }
    ]
  }
}
```

### Toilet Example

```typescript
// Standard = floor-mounted toilet (simple selection)
// Custom = wall-mounted system (carrier + flush plate + toilet + seat)
{
  id: 'toilet',
  itemType: 'standard_or_custom',
  standardConfig: {
    description: 'Standard floor-mounted toilet',
    options: ['Standard Two-Piece', 'One-Piece', 'Comfort Height']
  },
  customConfig: {
    description: 'Wall-mounted toilet system',
    subItems: [
      { id: 'carrier', name: 'Carrier System', ... },
      { id: 'flush_plate', name: 'Flush Plate', ... },
      { id: 'toilet_model', name: 'Toilet Model', ... },
      { id: 'seat', name: 'Toilet Seat', ... }
    ]
  }
}
```

## Integration Steps

### 1. Database Migration

Run the Prisma migration to add the enhanced FFE models:

```bash
npx prisma db push
```

### 2. Import Components

```tsx
import EnhancedFFERoomView from '@/components/ffe/EnhancedFFERoomView'

// In your room management component
<EnhancedFFERoomView 
  roomId={room.id}
  roomType={room.type} // e.g., 'bedroom', 'bathroom'
  orgId={organization.id}
/>
```

### 3. API Endpoints

The system includes these API endpoints:

- `GET/POST /api/ffe/room-status` - Manage item statuses for a room
- `GET/POST/PUT /api/ffe/general-settings` - Manage organization-level templates

### 4. Room Types Supported

Currently configured templates:
- `bedroom` / `master_bedroom` / `guest_bedroom`
- `bathroom` / `master_bathroom` / `powder_room`

Add more room types by extending the `FFE_ROOM_TEMPLATES` in `room-templates.ts`.

## User Workflow

### First Time Setup
1. User opens FFE phase for a new bedroom
2. Sees items like "Bed", "Nightstands", "Closets"
3. Clicks on "Bed" to expand
4. Chooses "Custom" option
5. Selects "Fabric" as material
6. Sub-options appear: Fabric Type, Color, Size, Headboard Style
7. Completes all required fields
8. Marks item as "Confirmed"
9. Settings automatically save to general settings

### Subsequent Projects
1. User opens FFE phase for another bedroom
2. System automatically applies previous settings
3. Bed item already shows "Custom" selected with Fabric material
4. User can modify or confirm existing choices
5. Reduces setup time significantly

## Technical Implementation

### Data Flow

1. **Template Loading**: Room type maps to template configuration
2. **Status Loading**: Current item states loaded from database
3. **General Settings**: Organization defaults applied to new rooms
4. **User Interaction**: Changes trigger API calls to update status
5. **Persistence**: Settings saved to both room status and general settings

### State Management

```typescript
interface FFEItemStatus {
  itemId: string
  state: 'pending' | 'confirmed' | 'not_needed'
  selectionType?: 'standard' | 'custom'
  customOptions?: Record<string, any>
  standardProduct?: Record<string, any>
  notes?: string
}
```

### Conditional Logic

Sub-items use `dependsOn` arrays and helper functions to determine visibility:

```typescript
export function getVisibleSubItems(item: FFEItemTemplate, selectedMaterial?: string): FFESubItem[] {
  return item.customConfig.subItems.filter(subItem => {
    if (!subItem.dependsOn) return true
    
    // Show fabric options only when fabric material is selected
    if (subItem.dependsOn.includes('material')) {
      return (
        (subItem.id === 'fabric_type' && selectedMaterial === 'Fabric') ||
        (subItem.id === 'wood_type' && selectedMaterial === 'Wood') ||
        // ... etc
      )
    }
    
    return true
  })
}
```

## Benefits

✅ **Reduces Repetitive Work**: Settings persist across similar projects  
✅ **Dynamic Interface**: Only shows relevant options based on selections  
✅ **Scalable**: Easy to add new room types and item configurations  
✅ **Audit Trail**: All changes are logged for accountability  
✅ **Flexible**: Supports various input types and validation rules  
✅ **User-Friendly**: Progressive disclosure keeps interface clean  

## Next Steps

- Add more room type templates (kitchen, living room, etc.)
- Implement item dependencies across different items
- Add cost estimation and supplier integration
- Build reporting and analytics features
- Create bulk operations for multiple rooms
# Drawings Workspace

The Drawings Workspace is a comprehensive file management system for technical drawings in the StudioFlow project management application.

## Features

### Core Functionality
- **File Upload**: Supports PDF, JPG, PNG, WebP, and DWG files (max 10MB each)
- **Checklist Management**: Default categories (Lighting, Elevation, Millwork, Floor Plans)
- **Progress Tracking**: Visual progress bar showing completion percentage
- **Activity Logging**: Comprehensive audit trail of all actions
- **File Preview**: In-app preview for images and documents
- **Description Management**: Editable descriptions for each file
- **Drag & Drop**: Intuitive file upload via drag and drop

### Workflow Integration
- **Stage Validation**: Ensures all checklist items are completed with at least one file
- **Automatic Notifications**: Alerts next team member when stage is completed
- **Permission Management**: Role-based access control
- **Mobile Responsive**: Optimized for all device sizes

## Database Schema

### New Models

#### DrawingChecklistItem
```prisma
model DrawingChecklistItem {
  id          String              @id @default(cuid())
  stageId     String
  type        DrawingChecklistType // LIGHTING, ELEVATION, MILLWORK, FLOORPLAN, CUSTOM
  name        String              // Display name
  description String?             // Optional description
  completed   Boolean             @default(false)
  order       Int                 @default(0)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  completedAt DateTime?
  
  stage       Stage               @relation(fields: [stageId], references: [id])
  assets      Asset[]             // Files linked to this checklist item
}
```

#### Asset Extensions
- Added `drawingChecklistItemId` field to link assets to checklist items
- Enhanced with drawing-specific metadata handling

## API Endpoints

### GET /api/drawings?stageId={stageId}
Returns workspace data including checklist items, assets, and activity logs.

**Response:**
```json
{
  "success": true,
  "stage": { /* stage data */ },
  "checklistItems": [ /* checklist items with assets */ ],
  "activity": [ /* activity logs */ ]
}
```

### POST /api/drawings/{stageId}/upload
Uploads files to a specific checklist item.

**Request:** FormData with files and checklistItemId
**Response:** Array of uploaded assets

### PATCH /api/drawings/{stageId}/checklist
Toggle checklist item completion status.

**Request:**
```json
{
  "checklistItemId": "string",
  "completed": boolean
}
```

### POST /api/drawings/{stageId}/complete
Completes the drawings stage and triggers workflow progression.

**Validation:**
- All checklist items must be marked complete
- Each checklist item must have at least one file uploaded

## Component Architecture

### Main Component: DrawingsWorkspace
- **Location**: `src/components/stages/drawings-stage.tsx`
- **Hook**: `useDrawingsWorkspace` for state management
- **Types**: TypeScript interfaces in `src/types/drawings.ts`

### Key Features
- **Responsive Design**: Mobile-first approach with breakpoint-based layouts
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support
- **Error Handling**: Comprehensive error states and user feedback
- **Optimistic Updates**: Real-time UI updates with SWR caching

## Setup Instructions

### 1. Database Migration
```bash
# Run the migration to create the new tables
npx prisma migrate dev --name add_drawings_workspace
```

### 2. Environment Variables
Ensure you have the required environment variables for file storage:
```env
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

### 3. File Storage
The system uses Vercel Blob storage for file uploads. Files are organized in folders:
```
drawings/
├── {stageId}/
│   ├── {timestamp}-{filename}
│   └── ...
```

## Usage Guide

### For Team Members (Drafters)

1. **Access the Workspace**: Navigate to a DRAWINGS stage in any project
2. **Upload Files**: 
   - Drag and drop files onto the upload zones
   - Or click "Add Files" button to browse
3. **Organize by Category**:
   - Upload files to appropriate categories (Lighting, Elevation, etc.)
   - Add descriptions to provide context
4. **Mark as Complete**: 
   - Check off categories as they're finished
   - Ensure each category has required files
5. **Complete Workspace**: Click "Complete Workspace" when all categories are done

### For Administrators

1. **Monitor Progress**: View progress bars and activity logs
2. **Manage Permissions**: Ensure proper role assignments
3. **Review Completion**: Validate that all requirements are met before stage completion

## Error Handling

### Common Errors
- **File Too Large**: Max 10MB per file
- **Unsupported Format**: Only PDF, JPG, PNG, WebP, DWG allowed
- **Missing Files**: Each checklist item needs at least one file
- **Network Issues**: Automatic retry with user feedback

### User Feedback
- **Toast Notifications**: Success/error messages for all actions
- **Progress Indicators**: Visual feedback during uploads
- **Validation Messages**: Clear error descriptions

## Performance Considerations

- **SWR Caching**: Efficient data fetching with 30-second refresh intervals
- **Optimistic Updates**: Immediate UI feedback before server confirmation  
- **Lazy Loading**: File previews loaded on demand
- **Debounced Actions**: Prevents duplicate API calls

## Testing

### Manual Testing Checklist
- [ ] File upload (all supported formats)
- [ ] Drag and drop functionality
- [ ] Checklist item toggling
- [ ] Progress calculation
- [ ] Stage completion validation
- [ ] Mobile responsiveness
- [ ] Accessibility features
- [ ] Error handling scenarios

### Automated Tests
- Unit tests for `useDrawingsWorkspace` hook
- Integration tests for API endpoints
- E2E tests for complete workflows

## Future Enhancements

### Planned Features
- **Version Control**: File versioning with history
- **Batch Operations**: Multi-file actions
- **Advanced Previews**: CAD file rendering for DWG files
- **Collaborative Annotations**: Comments and markup tools
- **Export Options**: ZIP download of all files
- **Custom Categories**: User-defined checklist items

### Performance Optimizations
- **Image Optimization**: Automatic compression and resizing
- **CDN Integration**: Faster file delivery
- **Progressive Loading**: Incremental content loading
- **Offline Support**: Local caching for offline work
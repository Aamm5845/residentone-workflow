# Floorplan Approval System

The Floorplan Approval System is a project-level feature that enables interior design firms to manage floorplan reviews and client approvals independently from room-specific workflows.

## Overview

Unlike the room-based client approval process that handles 3D renderings, the floorplan approval system operates at the project level and manages PDF floorplans and CAD files that apply to the entire project.

## Key Features

- **Project-Level Management**: Operates independently of room workflows
- **Multi-Format Support**: Handles PDF floorplans and CAD files (DWG, DXF)
- **Version Control**: Track multiple versions with status management
- **Client Communication**: Email notifications and approval tracking
- **Activity Logging**: Complete audit trail of all actions
- **File Selection**: Choose which assets to include in client emails

## Database Schema

The system uses four main database models:

### FloorplanApprovalVersion
- Main entity for each floorplan approval version
- Belongs to Project (not Stage/Room)
- Tracks status, client decisions, and email history
- Supports version numbering and notes

### FloorplanApprovalAsset  
- Links floorplan files to approval versions
- Controls which assets are included in emails
- Tracks file metadata

### FloorplanApprovalActivity
- Activity log for audit trail
- Records all user actions and system events
- Links to users for accountability

### FloorplanApprovalEmailLog
- Email tracking and analytics
- Records send times, delivery status
- Supports test emails and resends

## Workflow States

### Version Status Flow
1. **DRAFT** - Initial state, version created but not ready
2. **READY_FOR_CLIENT** - Version marked ready for client review
3. **SENT_TO_CLIENT** - Email sent to client with floorplans
4. **CLIENT_REVIEWING** - Client has opened the email
5. **CLIENT_APPROVED** - Client approved the floorplans
6. **REVISION_REQUESTED** - Client requested changes

### Client Decision States
- **PENDING** - No decision made yet
- **APPROVED** - Client approved floorplans
- **REVISION_REQUESTED** - Client wants changes

## API Endpoints

### Project-Level CRUD
- `GET /api/projects/[id]/floorplan-approvals` - List versions and assets
- `POST /api/projects/[id]/floorplan-approvals` - Create new version
- `PATCH /api/projects/[id]/floorplan-approvals` - Update version status/metadata

### File Upload
- `POST /api/projects/[id]/floorplan-assets` - Upload PDF/CAD files
  - Accepts multipart form-data
  - Validates file types (PDF, DWG, DXF)
  - Size limits: 50MB for CAD files
  - Base64 database storage for serverless compatibility

### Email Management
- `POST /api/floorplan-approvals/[versionId]/send-email` - Send to client
  - Supports test email functionality
  - Asset selection for email inclusion
  - Email logging and tracking
- `GET /api/floorplan-approvals/[versionId]/preview` - Email preview
- `GET /api/floorplan-approvals/[versionId]/analytics` - Email analytics

## User Interface

### FloorplanApprovalWorkspace Component
The main UI component provides:

#### Assets Tab
- File upload with drag-and-drop support
- Version management and creation
- Asset selection for email inclusion
- File type icons and metadata display
- Notes and version annotations

#### Email Preview Tab  
- Live email preview with iframe
- Test email functionality
- Subject line and recipient display
- Asset inclusion preview

#### Activity Log Tab
- Chronological activity timeline
- User attribution and timestamps
- Action type categorization
- System and user event tracking

### Project Integration
- Feature flag: `project.hasFloorplanApproval`
- Project page navigation card
- Route: `/projects/[id]/floorplan-approval`
- Integrated with existing project layout

## Feature Flag System

The floorplan approval feature is controlled by a project-level boolean flag:

```prisma
model Project {
  // ... other fields
  hasFloorplanApproval Boolean @default(false)
  // ... other fields
}
```

This allows selective enabling for specific projects without affecting all projects in the system.

## Email Integration

### Template System
- Reuses existing Meisner template system
- Project and client context injection
- Asset attachment support
- Professional styling consistent with other emails

### Tracking & Analytics
- Email open tracking with pixel beacons
- Delivery status monitoring
- Click tracking for embedded links
- Download analytics for attachments

### Client Interaction
- Secure approval links with token authentication
- Mobile-responsive approval interface
- Comment system for revision requests
- Status updates back to the system

## File Management

### Supported Formats
- **PDF**: Floorplan drawings, layouts
- **DWG**: AutoCAD native format
- **DXF**: AutoCAD exchange format

### Storage Strategy
- Database storage using base64 encoding
- Optimized for serverless deployment
- File size validation and compression
- Metadata extraction and indexing

### Upload Process
1. Client-side file validation
2. Multipart form submission
3. Server-side type/size validation  
4. Base64 encoding and storage
5. Asset record creation
6. UI refresh and confirmation

## Security Considerations

### Access Control
- Project-level permission checking
- User authentication required
- Feature flag validation
- File type whitelist enforcement

### Client Access
- Secure token-based approval URLs
- Time-limited access tokens
- IP-based access logging
- Encrypted file transmission

### Data Protection
- No sensitive data in client-facing URLs
- Audit logging for compliance
- Secure file storage practices
- GDPR-compliant data handling

## Integration Points

### Phase Notification System
While floorplan approvals operate independently, they integrate with the existing phase notification system for:
- Email infrastructure reuse
- Consistent notification patterns
- User preference management
- Template system integration

### Project Workflow
- Independent of room-based phases
- Can run parallel to room workflows
- Project completion can include floorplan approval
- Status reporting in project dashboards

## User Roles & Permissions

### Project Managers
- Create and manage floorplan versions
- Upload and organize files
- Send emails to clients
- Record client decisions
- Manage revision requests

### Clients
- View floorplan files
- Provide approval decisions
- Add comments and feedback
- Request specific changes
- Track approval history

### Team Members
- View floorplan status
- Access activity logs
- Receive notifications
- Collaborate on revisions

## Best Practices

### Version Management
1. Use descriptive version names
2. Add comprehensive notes
3. Archive outdated versions
4. Track major vs. minor changes
5. Maintain version history

### Client Communication
1. Select appropriate assets for emails
2. Provide context in version notes
3. Set clear expectations for response time
4. Follow up on pending approvals
5. Document revision requests thoroughly

### File Organization
1. Use consistent naming conventions
2. Optimize file sizes before upload
3. Include version numbers in filenames
4. Separate different drawing types
5. Maintain file quality standards

## Troubleshooting

### Common Issues
1. **File Upload Failures**
   - Check file size limits
   - Verify file format compatibility
   - Ensure stable internet connection

2. **Email Delivery Problems**
   - Verify client email addresses
   - Check spam folder instructions
   - Monitor delivery analytics

3. **Client Access Issues**
   - Validate approval link tokens
   - Check link expiration dates
   - Verify client device compatibility

### Error Handling
- Comprehensive error messages
- Automatic retry mechanisms
- Fallback options for failures
- User-friendly error reporting

## Future Enhancements

### Planned Features
- Real-time collaboration tools
- Advanced file preview capabilities
- Integration with CAD software
- Automated approval workflows
- Advanced reporting and analytics

### Scalability Considerations
- File storage optimization
- Performance monitoring
- Load balancing strategies  
- Database indexing improvements

## API Response Examples

### Get Floorplan Approvals
```json
{
  "versions": [
    {
      "id": "fp_version_123",
      "version": "v1.2",
      "status": "SENT_TO_CLIENT",
      "sentToClientAt": "2024-01-15T10:30:00Z",
      "emailOpenedAt": "2024-01-15T14:20:00Z",
      "notes": "Updated kitchen layout per client feedback",
      "assets": [
        {
          "id": "fp_asset_456", 
          "asset": {
            "id": "asset_789",
            "title": "First Floor Plan.pdf",
            "type": "FLOORPLAN_PDF",
            "size": 2048576
          },
          "includeInEmail": true
        }
      ],
      "activityLogs": [...]
    }
  ],
  "currentVersion": {...}
}
```

### Send Email Response
```json
{
  "success": true,
  "version": {
    "id": "fp_version_123",
    "status": "SENT_TO_CLIENT", 
    "sentToClientAt": "2024-01-15T10:30:00Z"
  },
  "emailId": "email_log_789"
}
```

This comprehensive system provides a robust foundation for managing floorplan approvals while maintaining consistency with existing workflow patterns.
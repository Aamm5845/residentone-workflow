# FFE System User Guide

## Overview

The new FFE (Furniture, Fixtures, Equipment) system provides a comprehensive template-based approach to managing project specifications. This guide covers all aspects of using the system, from template management to completing FFE phases for individual rooms.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Template Management](#template-management)
3. [FFE Workflow](#ffe-workflow)
4. [User Roles and Permissions](#user-roles-and-permissions)
5. [Advanced Features](#advanced-features)
6. [Troubleshooting](#troubleshooting)

---

## Getting Started

### System Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection
- Valid user account with appropriate permissions

### Accessing the FFE System

1. **Log in** to your ResidentOne account
2. **Navigate** to a project
3. **Select** a room to begin FFE work
4. **Choose** the FFE phase from the project timeline

### Key Concepts

- **Templates**: Pre-configured collections of FFE sections and items for specific room types
- **Sections**: Organizational categories (e.g., Flooring, Lighting, Plumbing)
- **Items**: Individual FFE components within sections
- **Room Instances**: Active FFE work sessions for specific rooms
- **States**: Item completion status (Pending → Selected → Confirmed → Completed)

---

## Template Management

### Overview

Templates define the structure and default items for FFE phases. They ensure consistency across projects and rooms while allowing customization.

### Accessing Template Management

**Admin and Designer users** can access template management through:
1. **Settings** → **FFE Templates**
2. **Templates** tab in the admin dashboard

### Creating a New Template

1. **Click** "New Template" button
2. **Fill in** basic information:
   - **Name**: Descriptive template name
   - **Room Type**: Select from available room types
   - **Description**: Optional detailed description
   - **Active Status**: Whether template is available for use

3. **Add Sections**:
   - Click "Add Section" 
   - Choose from the section library
   - Sections will be added in order

4. **Configure Items**:
   - Click the "+" button within a section
   - Fill in item details:
     - **Name**: Item description
     - **Default State**: Starting completion state
     - **Required**: Whether item must be addressed
     - **Estimated Cost**: Optional budget information
     - **Notes**: Additional information

5. **Save Template**

### Managing Existing Templates

#### Viewing Templates
- **Grid View**: Visual cards showing template overview
- **List View**: Detailed table with all template information
- **Filters**: Search by name, room type, or status

#### Editing Templates
1. **Click** the edit button (pencil icon)
2. **Modify** any template properties
3. **Add, remove, or reorder** sections and items
4. **Save** changes

#### Copying Templates
1. **Click** the copy button
2. **Enter** new template name
3. **Edit** the copied template as needed
4. **Save** the new template

#### Bulk Operations
- **Select** multiple templates using checkboxes
- **Apply** bulk actions:
  - Activate/Deactivate
  - Delete (Admin only)

### Template Best Practices

- **Use descriptive names** that clearly identify the template purpose
- **Organize sections logically** (structural elements first, finishes last)
- **Include all commonly needed items** for the room type
- **Set appropriate default states** based on typical workflow
- **Mark critical items as required**
- **Provide clear descriptions** for complex items

---

## FFE Workflow

The FFE system is organized into two distinct departments:

### FFE Departments

#### Settings Department
- **Purpose**: Configure sections, items, templates, and control workspace visibility
- **Access**: Admin and Designer roles only
- **Key Features**:
  - Add/edit sections and items
  - Import FFE templates
  - Control item visibility with "Use"/"Remove" buttons
  - Items are never deleted, only hidden from workspace

#### Workspace Department
- **Purpose**: Execute FFE tasks and track progress on visible items
- **Access**: All workflow users (Admin, Designer, FFE Specialist)
- **Key Features**:
  - Work only with items marked as visible in Settings
  - Track progress: Pending → Undecided → Completed
  - Add persistent notes
  - View completion statistics

### Starting an FFE Phase

1. **Navigate** to a room in your project
2. **Click** on the FFE phase in the timeline
3. **Choose your department**:
   - **Settings**: Configure the FFE structure (Admin/Designer only)
   - **Workspace**: Execute FFE tasks (all authorized users)
4. **Begin** working through the FFE items

### Understanding the Workspace

#### Main Areas
- **Header**: Room name, progress indicator, action buttons
- **Sections**: Collapsible groups of related FFE items
- **Notes Drawer**: Consolidated view of all item notes
- **Progress Bar**: Visual indication of completion percentage

#### Section Management
- **Expand/Collapse**: Click section headers to show/hide items
- **Progress Indicators**: Each section shows completion status
- **Item Count**: Total and completed items displayed per section

### Working with Items

#### Item States
Items progress through these states in the Workspace:
- **Pending**: Starting state, not yet addressed (yellow)
- **Undecided**: Under consideration, requires decision (gray)
- **Completed**: Fully resolved and documented (green)

*Note: Items default to "Pending" state when created. State changes are only available in the Workspace department.*

#### Changing Item States
1. **Click** on an item's state chip
2. **Select** the new state from the dropdown
3. Changes are **automatically saved**

#### Adding Notes
1. **Click** the note icon next to an item
2. **Type** your note in the text field
3. **Save** the note
4. **View all notes** in the Notes Drawer

#### Adding Custom Items
1. **Click** "Add Item" in any section
2. **Fill in** item details
3. **Save** the new item
4. **Item appears** in the section immediately

### Managing Sections

#### Adding New Sections
1. **Click** "Add Section" at the bottom of the workspace
2. **Choose** from the section library
3. **Section appears** with default items (if any)

#### Importing Items from Library
1. **Click** "Import from Library" within a section
2. **Browse** available items
3. **Select** items to add
4. **Items appear** in the current section

### Notes and Documentation

#### Notes Drawer
- **Access**: Click "Notes" button in the header
- **Organization**: Notes grouped by section
- **Filtering**: Show only items with notes
- **Export**: Copy all notes for external use

#### Item-Level Notes
- **Rich text** formatting supported
- **Timestamped** automatically
- **User attribution** for team projects
- **Photo attachments** (coming soon)

### Progress Tracking

#### Completion Calculation
Progress is calculated as:
```
(Completed Items + Not Applicable Items) / Total Items × 100%
```

#### Progress Indicators
- **Room Level**: Overall FFE completion percentage
- **Section Level**: Completion within each section
- **Visual Cues**: Color-coded progress bars and state chips

---

## User Roles and Permissions

### Role Definitions

#### Admin
- **Full access** to all FFE features
- **Manage** all templates
- **Delete** templates and data
- **Access** system administration tools
- **Run** data migrations and cleanup

#### Designer  
- **Create and edit** templates
- **Cannot delete** templates
- **Full FFE workflow** access
- **Manage** room instances
- **Export** and report on data

#### FFE Specialist
- **View** templates (cannot edit)
- **Full FFE workflow** access
- **Complete** FFE phases
- **Add notes** and custom items
- **Generate** completion reports

#### Viewer
- **Read-only** access to templates
- **View** FFE progress and notes
- **Cannot make changes** to templates or instances
- **Export** data for review

### Permission Matrix

| Action | Admin | Designer | FFE | Viewer |
|--------|-------|----------|-----|---------|
| **Templates** |||||
| View Templates | ✅ | ✅ | ✅ | ✅ |
| Create Templates | ✅ | ✅ | ❌ | ❌ |
| Edit Templates | ✅ | ✅ | ❌ | ❌ |
| Delete Templates | ✅ | ❌ | ❌ | ❌ |
| Copy Templates | ✅ | ✅ | ❌ | ❌ |
| **Settings Department** |||||
| Access Settings | ✅ | ✅ | ❌ | ❌ |
| Add/Edit Sections | ✅ | ✅ | ❌ | ❌ |
| Add/Edit Items | ✅ | ✅ | ❌ | ❌ |
| Control Visibility | ✅ | ✅ | ❌ | ❌ |
| Import Templates | ✅ | ✅ | ❌ | ❌ |
| **Workspace Department** |||||
| Access Workspace | ✅ | ✅ | ✅ | ❌ |
| Change Item States | ✅ | ✅ | ✅ | ❌ |
| Add/Edit Notes | ✅ | ✅ | ✅ | ❌ |
| View Progress | ✅ | ✅ | ✅ | ✅ |
| **System** |||||
| System Admin | ✅ | ❌ | ❌ | ❌ |

---

## Advanced Features

### Feature Flags

The system uses feature flags to control access to new functionality:
- **Template Management**: Access to template creation/editing
- **Advanced Editor**: Drag-and-drop section ordering
- **Bulk Operations**: Multi-select template actions
- **Data Migration**: Tools for importing legacy data

Contact your administrator to enable advanced features for your organization.

### Integration with External Systems

#### Cost Estimation
- **Link items** to pricing databases
- **Automatic cost calculation** for room budgets
- **Export estimates** to project management tools

#### Vendor Coordination
- **Share FFE specifications** with suppliers
- **Track delivery schedules** and installation dates
- **Coordinate with construction timeline**

#### Documentation Export
- **PDF generation** of complete FFE specifications
- **Excel export** for budget tracking
- **Integration** with project documentation systems

### Collaboration Features

#### Team Workflow
- **Multiple users** can work on the same room simultaneously
- **Real-time updates** show changes immediately
- **Conflict resolution** for simultaneous edits
- **Activity history** tracks all changes

#### Communication
- **@mention** team members in notes
- **Email notifications** for important updates
- **Integration** with project chat systems

---

## Troubleshooting

### Common Issues

#### Template Selector Not Appearing
**Problem**: When starting FFE phase, no template selector shows
**Solutions**:
1. Check that FFE v2 is enabled for your organization
2. Verify you have appropriate permissions
3. Ensure templates exist for the room type
4. Contact administrator if issue persists

#### Items Not Saving
**Problem**: Changes to item states or notes don't persist
**Solutions**:
1. Check internet connection
2. Refresh the page and try again
3. Verify you have edit permissions
4. Clear browser cache and cookies
5. Try a different browser

#### Templates Missing Items
**Problem**: Template appears empty or incomplete
**Solutions**:
1. Check template configuration in admin panel
2. Verify sections were properly added
3. Confirm items were saved in each section
4. Re-import template from backup if available

#### Performance Issues
**Problem**: System runs slowly or times out
**Solutions**:
1. Check internet connection speed
2. Close other browser tabs/applications
3. Clear browser cache
4. Use a supported browser version
5. Contact support for server-side issues

### Error Messages

#### "Template not found"
- Template may have been deleted
- Check template exists and is active
- Verify organization access permissions

#### "Invalid room type"
- Room type doesn't match available templates
- Check room configuration
- Contact administrator to create appropriate template

#### "Permission denied"
- User doesn't have required role permissions
- Contact administrator for role upgrade
- Check feature flags are enabled

### Getting Help

#### Self-Service Resources
1. **Search** this documentation
2. **Check** system status page
3. **Review** recent updates and announcements
4. **Browse** community forums

#### Contacting Support
1. **Email**: support@residentone.com
2. **Phone**: 1-800-RESIDENT  
3. **Chat**: Available during business hours
4. **Emergency**: 24/7 critical issue hotline

#### Information to Include
When contacting support, provide:
- **User role** and organization
- **Browser** and version information  
- **Room/project** where issue occurs
- **Steps** to reproduce the problem
- **Screenshots** or error messages
- **Timeline** when issue started

---

## Keyboard Shortcuts

| Action | Shortcut | Description |
|--------|----------|-------------|
| Save | `Ctrl + S` | Save current changes |
| Search | `Ctrl + F` | Search templates or items |
| New Template | `Ctrl + N` | Create new template |
| Notes Drawer | `Ctrl + D` | Toggle notes panel |
| Help | `F1` | Open help documentation |
| Refresh | `F5` | Reload current page |

---

## Frequently Asked Questions

### General Questions

**Q: Can I use the new system alongside the old FFE system?**
A: Yes, during the transition period both systems are available. Your administrator controls which system is used for new projects.

**Q: Will my existing FFE data be migrated automatically?**
A: Migration requires administrator action. Contact your admin to schedule data migration for your organization.

**Q: Can I customize the available room types?**
A: Room types are system-defined but can be extended by administrators. Submit requests for new room types through your admin.

### Template Questions

**Q: How many templates can I create?**
A: There's no hard limit, but we recommend focusing on commonly used room types and configurations.

**Q: Can I share templates between organizations?**
A: Templates are organization-specific. Contact support if you need to share templates across organizations.

**Q: What happens to room instances when I edit a template?**
A: Existing room instances are not affected by template changes. Only new instances use the updated template.

### Workflow Questions

**Q: Can I go back to previous item states?**
A: Yes, item states can be changed in any direction. The system tracks all state changes for audit purposes.

**Q: What happens if I accidentally delete a custom item?**
A: Deleted items can be restored from the change history. Contact your administrator for data recovery assistance.

**Q: Can I export my FFE data to other systems?**
A: Yes, the system supports various export formats. Check the export options in the main menu.

---

*This guide covers the current version of the FFE system. Features and interfaces may change with updates. Check for the latest version of this documentation regularly.*

**Last Updated**: [Current Date]
**Version**: 2.0
**Author**: ResidentOne Development Team
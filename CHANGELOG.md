# Changelog

All notable changes to the ResidentOne Workflow system will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **FFE Two-Department System**: Complete redesign of FFE workflow into Settings and Workspace departments
  - **Settings Department**: Configuration interface for Admin/Designer roles to manage sections, items, templates, and visibility
  - **Workspace Department**: Execution interface for all authorized users to work with visible items and track progress
  - **Item Visibility Control**: "Use"/"Remove" buttons in Settings control which items appear in Workspace (items never deleted, only hidden)
  - **Unified Department Router**: Single component with role-based access control and seamless department switching
- **New API Endpoints**:
  - `PATCH /api/ffe/v2/rooms/:roomId/items/:itemId/visibility` - Update item visibility
  - Query parameter support: `?onlyVisible=true` for Workspace, `?includeHidden=true` for Settings
  - `PATCH /api/ffe/v2/rooms/:roomId/bulk-visibility` - Bulk visibility updates
- **Database Schema Enhancements**:
  - Added `visibility` enum field (`VISIBLE`/`HIDDEN`) to `RoomFFEItem` model
  - Performance indexes: `(roomId, visibility)` for fast workspace queries
  - Audit trail support for visibility changes
- **Enhanced Item States**: Simplified to `PENDING` (default), `UNDECIDED`, `COMPLETED` workflow
- **Notes Persistence**: Robust notes system that maintains data across state changes
- **Progress Tracking**: Real-time completion statistics and visual progress indicators
- **Data Migration Tool**: Script to set default visibility for existing FFE items

### Changed
- **FFE Item Default State**: New items now default to `PENDING` instead of previous states
- **Component Architecture**: Split monolithic FFE component into specialized department components
  - `FFESettingsDepartment.tsx` - Settings management interface
  - `FFEWorkspaceDepartment.tsx` - Task execution interface  
  - `FFEItemCard.tsx` - Shared item component with mode-specific behavior
- **User Experience**: Clearer separation of configuration vs. execution tasks
- **Access Control**: Role-based department access (Settings: Admin/Designer only, Workspace: all authorized users)

### Fixed
- **Notes Data Loss**: Resolved issue where notes could be lost during item state transitions
- **Performance**: Optimized queries for large FFE datasets with visibility filtering
- **UI Consistency**: Standardized action buttons and state indicators across departments

### Security
- **Enhanced Authorization**: Granular permission checks for department access and operations
- **Audit Trail**: Comprehensive logging of visibility changes and item modifications

### Migration Notes
- **Existing Data**: Run `node scripts/migrate-ffe-visibility.js` to set default visibility for existing items
- **Backward Compatibility**: All existing FFE items will remain visible in Workspace after migration
- **User Training**: Update team on new two-department workflow (see updated User Guide)

### API Breaking Changes
- **Item State Enum**: Removed `SELECTED`, `CONFIRMED`, `NOT_NEEDED` states in favor of simplified workflow
- **Response Schema**: FFE API responses now include `visibility` field for all items
- **Query Behavior**: Default item queries now filter by visibility unless explicitly requested

---

## [2.1.0] - 2024-01-15

### Added
- Enhanced FFE template management system
- Bulk operations for template management
- Advanced template editor with drag-and-drop
- Export/import functionality for templates

### Fixed
- Template loading performance issues
- Memory leaks in large template datasets
- State synchronization bugs in collaborative editing

---

## [2.0.0] - 2024-01-01

### Added
- Complete FFE system rewrite with template-based approach
- Multi-user collaborative editing
- Real-time synchronization
- Comprehensive audit logging
- Advanced search and filtering

### Changed
- Migrated from legacy FFE system to modern template architecture
- Improved user interface with better accessibility
- Enhanced mobile responsiveness

### Removed
- Deprecated legacy FFE endpoints
- Old template format support

---

## [1.8.5] - 2023-12-15

### Fixed
- Critical security vulnerabilities in authentication system
- Data corruption issues in concurrent edits
- Performance degradation under high load

---

*For older versions, see the legacy changelog in `/docs/legacy-changelog.md`*
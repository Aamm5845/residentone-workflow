# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

ResidentOne Workflow is a production-ready interior design project management system built with Next.js 15, React 19, TypeScript, and PostgreSQL. It manages the complete interior design workflow from concept to completion with role-based access control.

## Common Development Commands

### Setup & Development
```powershell
# Install dependencies
npm install

# Generate Prisma client and start development
npm run dev

# Database operations
npx prisma generate        # Generate Prisma client
npx prisma db push        # Push schema changes to database
npx prisma db seed        # Seed database with team accounts
npm run db:studio         # Open Prisma Studio database browser
```

### Build & Deployment
```powershell
# Production build (includes Prisma generation)
npm run build

# Build with database schema push
npm run build:db

# Full build with database setup
npm run build:full

# Start production server
npm start
```

### Database Management
```powershell
# Reset and reseed database (destructive)
npx prisma db push --force-reset
npx prisma db seed

# Create and apply migrations
npm run db:migrate

# Push schema without migrations (development)
npm run db:push:prod
```

### Backup System
```powershell
# Create database backup
npm run backup

# Create simple backup
npm run backup:simple

# Restore from backup
npm run backup:restore

# List available backups (Windows)
npm run backup:list

# Schedule automated daily backups (Windows PowerShell)
npm run backup:schedule
```

### Testing & Quality
```powershell
# Lint code
npm run lint

# Safe development (backup before starting)
npm run dev:safe
```

## Architecture Overview

### Role-Based Workflow System
The application implements a sophisticated role-based workflow where each team member has specific responsibilities:

- **OWNER/ADMIN**: Full system access, user management, backups
- **DESIGNER**: Creates design concepts with rich text sections (Walls, Furniture, Lighting, General)
- **RENDERER**: Accesses design notes, uploads 3D renderings, triggers client approvals
- **DRAFTER**: Manages technical drawings and construction documentation
- **FFE**: Handles furniture, fixtures, and equipment sourcing with budget tracking
- **VIEWER**: Read-only access to assigned projects

### Multi-Stage Workflow Engine
Each room progresses through defined workflow stages:

1. **DESIGN_CONCEPT**: Rich text sections with file uploads, comments, and checklists
2. **THREE_D**: 3D rendering with client approval workflow via secure tokens
3. **CLIENT_APPROVAL**: Public approval pages with revision request capabilities
4. **DRAWINGS**: Technical drawing management with upload and versioning
5. **FFE**: Product sourcing, budget tracking, and supplier management

### Database Architecture
- **Multi-tenant**: Organization-based data isolation
- **Activity Logging**: Comprehensive audit trail with user attribution
- **File Management**: Vercel Blob integration with local fallback
- **Session Management**: NextAuth.js with JWT sessions and role-based permissions

### Key Technical Patterns

#### Attribution System
All database operations use attribution helpers from `src/lib/attribution.ts`:
- `withCreateAttribution()` - Adds createdById, updatedById
- `withUpdateAttribution()` - Adds updatedById, updatedAt  
- `withCompletionAttribution()` - Adds completedById, completedAt
- `logActivity()` - Creates activity log entries

#### API Route Structure
API routes follow RESTful patterns with consistent error handling:
- Authentication via `getSession()` from `@/auth`
- Permission validation using role-based checks
- Activity logging for all state changes
- Proper HTTP status codes and error messages

#### Component Architecture
- **Pages**: App Router with TypeScript in `src/app/`
- **Components**: Modular components in `src/components/` organized by feature
- **UI Components**: Reusable base components using Radix UI and Tailwind
- **Real-time Updates**: SWR for data fetching with auto-refresh

### Environment Configuration
Critical environment variables for development:

```env
# Database (Required)
DATABASE_URL="postgresql://username:password@localhost:5432/residentone_db?schema=public"

# Authentication (Required)  
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secure-secret-key-32-chars-minimum"

# File Storage (Recommended)
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_your-token-here"

# Email (Optional)
SMTP_HOST="smtp.gmail.com"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
```

### Data Flow Patterns

#### Stage Completion Flow
When stages are completed, the system:
1. Updates stage status with attribution
2. Logs activity for audit trail
3. Creates notifications for next team member
4. Auto-assigns next stage if applicable
5. Triggers client approval emails (for 3D stage)

#### Client Approval System
- Generates secure tokens via `nanoid(32)`
- Public approval pages accessible without authentication
- Email notifications with branded templates
- Activity logging for all approval actions
- Token expiration and deactivation management

#### File Upload System
Dual-mode file handling:
1. **Primary**: Vercel Blob storage for scalability
2. **Fallback**: Local file storage for development
3. **Organization**: Automatic folder structure by project/room/stage
4. **Security**: File type validation and size limits

### Key Directories

- `src/app/api/` - Next.js API routes with role-based authentication
- `src/components/` - Feature-organized React components
- `src/lib/` - Utilities, database client, and shared functions
- `prisma/` - Database schema, migrations, and seed data
- `scripts/` - Backup, restore, and maintenance utilities

### Development Notes

#### Database Operations
- Always use attribution helpers for data modifications
- Log activities for audit compliance
- Handle soft deletes by setting `orgId` to null
- Use transactions for multi-step operations

#### Authentication & Permissions
- Validate sessions using `isValidAuthSession()` 
- Check role permissions before sensitive operations
- Use `getSession()` consistently across API routes
- Implement proper error handling for unauthorized access

#### Testing Accounts
After running `npm run db:seed`:
- **admin@example.com** / password (Admin access)
- **aaron@example.com** / password (Designer)  
- **vitor@example.com** / password (Renderer)
- **sammy@example.com** / password (Drafter)
- **shaya@example.com** / password (FFE Specialist)

#### Backup & Recovery
- Safe backups exclude passwords and sensitive data
- Complete backups contain all data including authentication tokens
- Store complete backups securely, never commit to version control
- Test restore procedures regularly in development

This architecture ensures scalable, secure, and maintainable interior design workflow management with comprehensive audit trails and role-based collaboration.
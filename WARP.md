# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

StudioFlow by Meisner Interiors is a comprehensive interior design workflow management system that implements the firm's real workflow: Design → 3D → Client Approval → (parallel) Drawings + FFE. This is a Next.js 15 application with a complex multi-stage workflow engine designed for interior design teams.

## Essential Commands

### Development
```powershell
# Start development server
npm run dev

# Database operations
npx prisma db push                    # Apply schema changes to database
npx prisma db seed                    # Populate with demo data
npx prisma studio                     # Open database GUI (localhost:5555)
npx prisma generate                   # Generate Prisma client after schema changes

# Database management shortcuts
npm run db:push                       # Alias for prisma db push
npm run db:studio                     # Alias for prisma studio  
npm run db:generate                   # Alias for prisma generate
npm run db:seed                       # Alias for db seeding
```

### Production & Deployment
```powershell
# Build for production
npm run build                         # Runs prisma generate + next build

# Start production server
npm start

# Deploy to Vercel
vercel --prod                         # Deploy with production environment

# Database migration for production
npx prisma migrate deploy             # Apply migrations in production
```

### Testing & Quality
```powershell
# Linting
npm run lint                          # Next.js ESLint check

# Database testing
node test-db.js                       # Test database connections
node test-supabase.js                 # Test Supabase specific connections  
```

## Architecture Overview

### Application Structure
This is a Next.js 15 App Router application with the following key architecture:

```
src/
├── app/                              # Next.js App Router pages & API routes
│   ├── api/                          # Server-side API endpoints
│   ├── dashboard/                    # Main dashboard views
│   ├── projects/                     # Project management pages
│   ├── auth/                         # Authentication pages  
│   └── approval/                     # Public client approval system
├── components/                       # React components organized by feature
│   ├── layout/                       # Layout and navigation components
│   ├── projects/                     # Project-specific UI components
│   ├── stages/                       # Workflow stage components
│   └── ui/                           # Base UI components (Button, Modal, etc.)
├── lib/                              # Core utilities and configuration
│   ├── auth.ts                       # NextAuth.js configuration
│   ├── prisma.ts                     # Database client setup
│   └── cloud-storage.ts             # Dropbox/file storage integration
└── types/                            # TypeScript type definitions
```

### Database Schema & Workflow Engine

The system is built around a sophisticated multi-tenant workflow engine with these core entities:

**Organization & Users**
- Multi-tenant architecture with role-based access control
- Roles: OWNER, ADMIN, DESIGNER, RENDERER, DRAFTER, FFE, VIEWER
- Each role has specific permissions and dashboard views

**Project Workflow Hierarchy**
```
Organization → Projects → Rooms → Stages → (Design Sections | FFE Items)
```

**Five-Stage Workflow Process**
1. **DESIGN** (Aaron's role) - Rich text sections: Walls, Furniture, Lighting, General
2. **THREE_D** (Vitor's role) - 3D rendering and visualization  
3. **CLIENT_APPROVAL** - Branded approval system with public pages
4. **DRAWINGS** (Sammy's role) - Technical drawings and documentation
5. **FFE** (Shaya's role) - Furniture, Fixtures, Equipment management

### Authentication System
- NextAuth.js with JWT strategy for session management
- Credential-based authentication with bcrypt password hashing
- Fallback authentication system for development/demo purposes
- Organization-scoped user access with role inheritance

## Environment Configuration

### Required Environment Variables
Copy `.env.example` to `.env.local` and configure:

```env
# Database (required)
DATABASE_URL="file:./dev.db"                                    # SQLite for dev
# DATABASE_URL="postgresql://user:pass@host:5432/db"            # PostgreSQL for production

# Authentication (required)  
NEXTAUTH_URL="http://localhost:3000"                            # Your app URL
NEXTAUTH_SECRET="your-32-character-secret-key-here"             # JWT signing secret

# Cloud Storage (optional)
DROPBOX_ACCESS_TOKEN="your-dropbox-access-token"
DROPBOX_APP_KEY="your-dropbox-app-key" 
DROPBOX_APP_SECRET="your-dropbox-app-secret"

# Email Notifications (optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com" 
SMTP_PASSWORD="your-app-password"

# Application Branding
APP_NAME="StudioFlow by Meisner Interiors"
COMPANY_NAME="Your Interior Design Studio"
APP_URL="http://localhost:3000"
```

### Database Setup
The application supports both SQLite (development) and PostgreSQL (production):

**Development (SQLite)**
```powershell
# Use default DATABASE_URL in .env.local
npm install
npx prisma db push
npx prisma db seed
```

**Production (PostgreSQL)**
```powershell  
# Set DATABASE_URL to PostgreSQL connection string
npx prisma db push                    # Apply schema
npx prisma db seed                    # Optional: add demo data
```

## Domain-Specific Development Patterns

### Interior Design Workflow States
The system implements a state machine for room workflow progression:

**Room Status Flow**
`NOT_STARTED → IN_DESIGN → IN_3D → WITH_CLIENT → IN_PRODUCTION → COMPLETE`

**Stage Status Flow** 
`NOT_STARTED → IN_PROGRESS → COMPLETE → REVISION_REQUESTED (loop)`

### Multi-Role Dashboard System
Each user role sees different navigation and features:
- **Designers**: Project creation, design stage interface, room management
- **Renderers**: Access to design notes, 3D upload workflow, client approval triggers
- **Drafters**: Drawing upload system, technical file management
- **FFE Specialists**: Room-specific checklists, supplier links, progress tracking
- **Clients**: Public approval pages (no login required)

### File Storage Integration
The system supports multiple cloud storage providers:
- **Dropbox** (Primary): Enterprise-grade with automatic organization
- **AWS S3** (Alternative): With optional CloudFront CDN
- **File Organization**: `/interior-design/{projectId}/rooms/{roomId}/sections/{sectionId}/`

### Component Architecture Patterns

**Role-Based Component Rendering**
```typescript
// Components automatically adapt to user role
function StageComponent({ user, stage }) {
  if (user.role === 'DESIGNER') return <DesignStageEditor />
  if (user.role === 'RENDERER') return <RenderUploader />
  if (user.role === 'DRAFTER') return <DrawingUploader />
  return <StageViewer />
}
```

**Workflow State Management**
```typescript
// Stage status updates trigger cascading room status changes
async function updateStageStatus(stageId: string, status: StageStatus) {
  // Update stage
  await prisma.stage.update({ where: { id: stageId }, data: { status }})
  
  // Recalculate room overall status based on all stage statuses
  await recalculateRoomStatus(stage.roomId)
  
  // Send notifications to relevant team members
  await notifyWorkflowUpdate(stage)
}
```

## Development Workflow

### Initial Setup
```powershell
# 1. Clone and install
cd C:\Users\ADMIN\Desktop\residentone-workflow
npm install

# 2. Environment setup
cp .env.example .env.local
# Edit .env.local with your configuration

# 3. Database initialization
npx prisma generate
npx prisma db push
npx prisma db seed

# 4. Start development
npm run dev
# Open http://localhost:3000
```

### Demo Credentials (Post-Seed)
- **Admin**: admin@example.com / password
- **Aaron (Designer)**: aaron@example.com / password  
- **Vitor (Renderer)**: vitor@example.com / password
- **Sammy (Drafter)**: sammy@example.com / password
- **Shaya (FFE)**: shaya@example.com / password

### Working with the Database Schema
```powershell
# After modifying prisma/schema.prisma
npx prisma generate                   # Update Prisma client
npx prisma db push                    # Apply changes to database
npx prisma studio                     # Inspect data visually

# Reset database completely (development only)
npx prisma db push --force-reset
npx prisma db seed
```

## Key Architectural Decisions

### Next.js 15 with App Router
- Uses new App Router architecture with React 19
- Server and client components for optimal performance
- API routes for backend functionality

### Prisma ORM with Complex Relationships  
- Multi-tenant data isolation via Organization model
- Workflow state management through Stage and Room models
- Rich relationship mapping for comments, assets, and approvals

### Role-Based Access Control
- JWT-based authentication with role claims
- Component-level permission checking
- Route-level middleware for API protection

### TypeScript Configuration
- Strict type checking enabled
- Path aliases configured for clean imports (`@/components`, `@/lib`)
- Custom type definitions for NextAuth.js integration

## Deployment & Production

### Vercel Deployment (Recommended)
```powershell
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod

# Configure environment variables in Vercel dashboard
# Required: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
```

### Database Requirements
- **Development**: SQLite (included)
- **Production**: PostgreSQL (Supabase, Railway, AWS RDS)
- **Migration**: Use `npx prisma migrate deploy` in production

### Performance Considerations
- TypeScript and ESLint errors are ignored in build (for faster deployment)
- Image optimization configured for remote patterns
- Server actions enabled for form handling
- API route timeouts configured (30s max on Vercel)

## Troubleshooting

### Database Connection Issues
```powershell
# Test database connectivity
node test-db.js

# Check Prisma client generation
npx prisma generate
npx prisma db push
```

### Authentication Problems
- Verify `NEXTAUTH_SECRET` is at least 32 characters
- Ensure `NEXTAUTH_URL` matches your deployment domain  
- Check fallback authentication in `src/auth.ts` for demo purposes

### Build Failures
- Ensure all environment variables are set in deployment platform
- Verify PostgreSQL connection string format for production
- Check that Prisma client is generated before build (`npm run build` includes this)

### Role Permission Issues
- Users are assigned roles during seeding or manual creation
- Check user role in database: `npx prisma studio`
- Verify role-based component rendering logic in components

## File Storage Setup

### Dropbox Configuration (Recommended)
```env
DROPBOX_ACCESS_TOKEN="your-access-token"
DROPBOX_APP_KEY="your-app-key"
DROPBOX_APP_SECRET="your-app-secret"
```

Files are automatically organized in Dropbox:
- `/interior-design/{projectId}/rooms/{roomId}/sections/{sectionId}/`
- Supports images, PDFs, drawings, and other design documents
- Integration handles upload, retrieval, and permission management
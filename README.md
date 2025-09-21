# ResidentOne Workflow

**Professional Interior Design Project Management System**

A production-ready, fully interactive web application built for interior design studios to manage projects, collaborate with teams, and streamline client workflows.

## 🎉 **Now 100% Interactive & Production-Ready!**

All static content and demo data have been removed. Every component is now fully functional with real-time data, API integration, and interactive workflows.

## 🚀 Live Demo

**Production**: [https://residentone-workflow-5go27pngw-aarons-projects-644a474e.vercel.app](https://residentone-workflow-5go27pngw-aarons-projects-644a474e.vercel.app)

## 🏢 Features

### ✅ Interactive Dashboard
- **Real-time Stats**: Live project counts, budget tracking, and completion metrics
- **Dynamic Task Management**: User-specific tasks with priorities and due dates
- **Auto-refresh Data**: Dashboard updates every 15-30 seconds with latest information
- **Toast Notifications**: Success/error feedback for all user actions

### ✅ Functional File Management
- **Working Upload System**: Full file upload with progress bars and error handling
- **Vercel Blob Integration**: Scalable cloud storage with organized folder structure
- **Local Fallback**: Seamless fallback to local storage if Vercel Blob is unavailable
- **File Validation**: Size limits, type checking, and security validation

### ✅ Interactive FFE Management
- **Dynamic Item Creation**: Add, edit, and manage FF&E items with real-time updates
- **Category Organization**: Automatically organized by Furniture, Lighting, Textiles, etc.
- **Budget Tracking**: Live budget calculations and approval percentages
- **Supplier Integration**: Direct links to supplier pages and lead time tracking

### ✅ Production Database
- **PostgreSQL Ready**: Migrated from SQLite to production-grade PostgreSQL
- **Clean Seed Data**: Only essential team accounts and room presets
- **No Demo Content**: All hardcoded demo projects and fake data removed

### ✅ Core Workflow Engine
- **Design Stage**: Rich text notes with sections for Walls/Furniture/Lighting/General
- **3D Rendering**: Upload and manage renderings with client approval workflow
- **Technical Drawings**: Upload and track construction drawings and specifications
- **FFE Management**: Complete furniture, fixtures, and equipment sourcing system

### ✅ Modern UI/UX
- **Skeleton Loading**: Professional loading states for all data fetching
- **Error Boundaries**: Graceful error handling with retry options
- **Toast Notifications**: Real-time feedback for all user actions
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile

## 🚀 Quick Start

### Prerequisites
- Node.js 18.x or later
- npm or yarn
- Git

### Installation

1. **Clone and setup**
   ```bash
   # Note: Files are already created in C:\Users\ADMIN\Desktop\residentone-workflow
   cd C:\Users\ADMIN\Desktop\residentone-workflow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the database**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Push the schema to create the database
   npx prisma db push
   
   # Seed with baseline data (team accounts + room presets)
   npx prisma db seed
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Open http://localhost:3000
   - Sign in with demo credentials (see below)

## 🔐 System Accounts

After seeding the database, you can use these team member accounts:

- **Admin**: admin@example.com / password
- **Aaron (Designer)**: aaron@example.com / password  
- **Vitor (Renderer)**: vitor@example.com / password
- **Sammy (Drafter)**: sammy@example.com / password
- **Shaya (FFE)**: shaya@example.com / password

*Note: These are the only seeded accounts. All project data is created dynamically through the interface.*

## 📊 Database Management

```bash
# View database in Prisma Studio
npm run db:studio

# Reset database and reseed
npx prisma db push --force-reset
npx prisma db seed

# Generate Prisma client after schema changes
npm run db:generate
```

## 🏢 System Architecture

### User Roles & Permissions
- **OWNER/ADMIN**: Full system access, user management
- **DESIGNER**: Create/edit design stages, manage projects
- **RENDERER**: Access design notes, upload renders, trigger approvals
- **DRAFTER**: Upload drawings, manage technical documentation
- **FFE**: Manage furniture/fixtures/equipment checklists
- **VIEWER**: Read-only access to assigned projects

### Workflow States
- **Room Status**: NOT_STARTED → IN_DESIGN → IN_3D → WITH_CLIENT → IN_PRODUCTION → COMPLETE
- **Stage Status**: NOT_STARTED → IN_PROGRESS → COMPLETE/PENDING_APPROVAL → REVISION_REQUESTED
- **Approval Status**: PENDING → APPROVED/REVISION_REQUESTED → EXPIRED

### Data Models
- **Organization**: Multi-tenant structure
- **Projects**: Client projects with rooms and stages
- **Rooms**: Individual spaces with workflow stages
- **Stages**: Design → 3D → Client Approval → Drawings + FFE
- **Assets**: Files, images, links with Vercel Blob integration
- **Comments**: Collaboration with mentions and attachments

## 🔧 Configuration

### Environment Variables
Copy `.env.example` to `.env.local` and configure:

```env
# Database (PostgreSQL for production)
DATABASE_URL="postgresql://username:password@localhost:5432/residentone_db?schema=public"
SHADOW_DATABASE_URL="postgresql://username:password@localhost:5432/residentone_shadow?schema=public"

# Environment
NODE_ENV="development"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secure-secret-key-change-in-production-minimum-32-characters"
SESSION_SECRET="your-session-secret-key-for-additional-security"

# Vercel Blob Storage (Recommended)
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_your-token-here"

# Email Notifications (Optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"

# Application
APP_NAME="ResidentOne"
APP_URL="http://localhost:3000"
COMPANY_NAME="Your Interior Design Studio"
```

## 📱 User Interface

### Key Pages
- `/dashboard` - Main overview with project stats
- `/projects` - Project list and management
- `/projects/[id]` - Individual project dashboard  
- `/projects/[id]/rooms/[roomId]` - Room workflow stages
- `/approval/[token]` - Public client approval page

### Role-specific Views
Each user sees navigation and features relevant to their role:
- Designers see design tools and project setup
- Renderers see 3D workflow and approval triggers
- Drafters see drawing upload and management
- FFE specialists see product checklists and sourcing

## 🔄 Workflow Details

### 1. Project Creation
- Select client (or create new)
- Choose project type (Residential/Commercial/Hospitality)
- Add rooms using preset checkboxes
- Automatically creates all workflow stages

### 2. Design Stage (Aaron)
- Four sections: Walls, Furniture, Lighting, General
- Rich text editor for notes and specifications
- Image and file uploads
- External link references
- Mark as "Finished" to hand off to 3D

### 3. 3D Rendering (Vitor) 
- Access all design notes and references
- Upload rendered images
- Send to client with branded email
- Handle revision requests

### 4. Client Approval
- Branded email with project/room preview
- Public approval page (no login required)
- Approve or request revisions with comments
- Automated email notifications

### 5. Production (Parallel)
- **Drawings (Sammy)**: Upload technical drawings, track status
- **FFE (Shaya)**: Manage room-specific checklists, supplier links, progress tracking

## 🚀 Development

### Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Lucide Icons
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (Supabase) with connection pooling
- **Authentication**: NextAuth.js with JWT sessions
- **Deployment**: Vercel with automatic deployments
- **File Storage**: Dropbox API integration (optional)
- **Email**: Nodemailer with SMTP (optional)

### Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API endpoints
│   ├── dashboard/         # Dashboard pages  
│   ├── projects/          # Project management
│   ├── auth/              # Authentication
│   └── approval/          # Public approval pages
├── components/            # Reusable components
│   ├── ui/                # Base UI components
│   └── layout/            # Layout components
├── lib/                   # Utilities and configuration
│   ├── prisma.ts          # Database client
│   ├── utils.ts           # Helper functions
│   └── auth.ts            # Authentication config
prisma/
├── schema.prisma          # Database schema
└── seed.ts                # Demo data seeding
```

## 📋 Next Steps

## ✅ Production-Ready Features Implemented

- ✅ **Interactive Dashboard** with real-time data and task management
- ✅ **PostgreSQL Database** with clean, production-ready schema
- ✅ **Functional File Uploads** with Dropbox integration and local fallback
- ✅ **Dynamic FFE Management** with budget tracking and supplier integration
- ✅ **Role-based Authentication** with secure team member accounts
- ✅ **Modern UI/UX** with loading states, error handling, and toast notifications
- ✅ **API-driven Architecture** with RESTful endpoints for all functionality
- ✅ **Production Environment** configuration with PostgreSQL and cloud storage

## 🛠️ Next Phase Features

**Advanced Workflow Management:**
- Real-time collaboration with Socket.IO
- Client approval portal with email notifications
- Advanced reporting and analytics dashboards
- Automated testing pipeline
- Production deployment with Docker

## 🤝 Support

For questions or support:
1. Check the demo data and existing workflows
2. Review the database schema in `prisma/schema.prisma`  
3. Examine the seeded data in `prisma/seed.ts`
4. Test the authentication flow with provided credentials

## 📄 License

This project is proprietary software built specifically for interior design workflow management.

---

**Built with ❤️ for Meisner Interiors and interior design professionals**

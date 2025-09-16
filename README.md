# StudioFlow by Meisner Interiors - Interior Design Workflow Management

A comprehensive project workflow management system designed specifically for interior designers, inspired by your firm's real workflow: Design → 3D → Client Approval → (parallel) Drawings + FFE.

## 🏗️ Features

### Core Workflow
- **Design Stage (Aaron)**: Rich text notes with sections for Walls/Furniture/Lighting/General, image uploads, external links
- **3D Rendering (Vitor)**: View design notes, upload renders, send to client for approval
- **Client Approval**: Branded email templates, public approval pages, revision workflow
- **Drawings (Sammy)**: File upload system for PDFs/DWGs with status tracking
- **FFE (Shaya)**: Room-specific checklists, supplier links, progress tracking

### Dashboard & Management
- **Studio Dashboard**: Overview of all projects with progress bars and alerts
- **Project Dashboard**: Room grid with stage badges and progress indicators  
- **Role-based Permissions**: Different views and capabilities based on user role
- **Real-time Collaboration**: Comments, mentions, file attachments

### Integrations
- **Dropbox Integration**: Organized file storage per project/room
- **Email Notifications**: Branded client communications and internal alerts
- **Room Presets**: Configurable templates for different room types

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
   
   # Seed with demo data
   npx prisma db seed
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Open http://localhost:3000
   - Sign in with demo credentials (see below)

## 🔐 Demo Credentials

After seeding the database, you can use these accounts:

- **Admin**: admin@example.com / password
- **Aaron (Designer)**: aaron@example.com / password  
- **Vitor (Renderer)**: vitor@example.com / password
- **Sammy (Drafter)**: sammy@example.com / password
- **Shaya (FFE)**: shaya@example.com / password

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
- **Assets**: Files, images, links with Dropbox integration
- **Comments**: Collaboration with mentions and attachments

## 🔧 Configuration

### Environment Variables
Copy `.env.example` to `.env.local` and configure:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Dropbox (Optional)
DROPBOX_APP_KEY="your-dropbox-app-key"
DROPBOX_ACCESS_TOKEN="your-dropbox-access-token"

# Email (Optional)
SMTP_HOST="smtp.gmail.com"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
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
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: SQLite (development) / PostgreSQL (production)
- **Authentication**: NextAuth.js with credentials
- **File Storage**: Dropbox API integration
- **Email**: Nodemailer with SMTP

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

This foundation includes:
- ✅ Complete database schema with all workflow entities
- ✅ Authentication system with role-based access
- ✅ Dashboard with project overview
- ✅ Project list and management UI
- ✅ Demo data with realistic workflow examples

**To complete the full system:**
1. **Room Workflow Pages**: Individual room stage interfaces
2. **Client Approval System**: Public approval pages and email templates  
3. **File Upload System**: Dropbox integration for asset management
4. **Design Stage Interface**: Rich text editor with sections
5. **FFE Management**: Interactive checklists and progress tracking
6. **Email Notifications**: Automated workflow notifications
7. **Advanced Features**: Comments, mentions, real-time updates

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

# StudioFlow by Meisner Interiors - Deployment Guide

## Quick Deploy to Vercel

### Prerequisites
1. [Vercel Account](https://vercel.com)
2. [Supabase Account](https://supabase.com) (for PostgreSQL database)
3. Git repository (GitHub, GitLab, or Bitbucket)

### Step 1: Set Up Database

#### Option A: Supabase (Recommended)
1. Go to [Supabase](https://supabase.com) and create a new project
2. Once created, go to Settings > Database
3. Copy the connection string (it looks like: `postgresql://postgres:[password]@[host]:5432/postgres`)

#### Option B: Railway
1. Go to [Railway](https://railway.app) and create a new project
2. Add a PostgreSQL database
3. Copy the DATABASE_URL from the Variables tab

### Step 2: Deploy to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy the application**:
   ```bash
   vercel --prod
   ```

4. **Set Environment Variables in Vercel**:
   - Go to your Vercel dashboard
   - Select your project
   - Go to Settings > Environment Variables
   - Add the following variables:

   ```
   DATABASE_URL=your-postgresql-connection-string
   NEXTAUTH_SECRET=your-super-secret-key-32-characters-long
   NEXTAUTH_URL=https://your-app-name.vercel.app
   APP_NAME="StudioFlow by Meisner Interiors"
   APP_URL=https://your-app-name.vercel.app
   COMPANY_NAME=Interior Design Studio
   ```

### Step 3: Set Up Database Schema

1. **Push database schema**:
   ```bash
   npx prisma db push
   ```

2. **Seed the database** (optional):
   ```bash
   npm run db:seed
   ```

### Step 4: Test Your Deployment

Visit your Vercel URL and test:
- ✅ Login/Registration
- ✅ Create projects
- ✅ Manage rooms and stages
- ✅ Dashboard functionality

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_SECRET` | Secret for JWT signing | `your-32-character-secret-key` |
| `NEXTAUTH_URL` | Your app's URL | `https://yourapp.vercel.app` |
| `APP_NAME` | Application name | `StudioFlow by Meisner Interiors` |
| `APP_URL` | Application URL | `https://yourapp.vercel.app` |
| `COMPANY_NAME` | Your company name | `Interior Design Studio` |

## Troubleshooting

### Build Errors
- Make sure all environment variables are set in Vercel
- Check that DATABASE_URL is a valid PostgreSQL connection string

### Database Connection Issues
- Verify your database is accessible from external connections
- Check that the DATABASE_URL format is correct
- Ensure the database exists and is running

### Authentication Issues
- Make sure NEXTAUTH_SECRET is set and is at least 32 characters
- Verify NEXTAUTH_URL matches your deployed domain

## Post-Deployment

1. **Create your first user**: Register through the app
2. **Set up your organization**: This happens automatically
3. **Create your first project**: Use the dashboard
4. **Invite team members**: Add users with appropriate roles

## Updates

To update your deployment:
1. Make changes to your code
2. Commit and push to your Git repository
3. Vercel will automatically redeploy

For manual deployments:
```bash
vercel --prod
```

# 🚀 SETUP: Safe Development Environments

## ⚠️ CRITICAL: Do this NOW to prevent future data loss

## Step 1: Create Three Separate Databases (10 minutes)

### 1.1 Go to Prisma Console
Visit: https://console.prisma.io

### 1.2 Create Development Database
1. Click "New Project" or "Add Database"
2. Name: `residentone-development`
3. Region: Choose closest to you
4. Click "Create"
5. **SAVE THESE CREDENTIALS:**
   ```
   DEV_DATABASE_URL=prisma+postgres://...
   DEV_DIRECT_DATABASE_URL=postgres://...
   ```

### 1.3 Create Staging Database
1. Click "New Project" or "Add Database"
2. Name: `residentone-staging`
3. Region: Same as production
4. Click "Create"
5. **SAVE THESE CREDENTIALS:**
   ```
   STAGING_DATABASE_URL=prisma+postgres://...
   STAGING_DIRECT_DATABASE_URL=postgres://...
   ```

### 1.4 Rename Your Current Database (Production)
1. Find your existing database in Prisma Console
2. Rename it to `residentone-production`
3. These credentials are already in your `.env.local`
4. **SAVE THESE CREDENTIALS:**
   ```
   PROD_DATABASE_URL=prisma+postgres://...
   PROD_DIRECT_DATABASE_URL=postgres://...
   ```

---

## Step 2: Update Local Environment (5 minutes)

### 2.1 Update Your `.env.local` File
```bash
# REPLACE the DATABASE_URL lines with DEV credentials:
DATABASE_URL="[YOUR_DEV_DATABASE_URL]"
DIRECT_DATABASE_URL="[YOUR_DEV_DIRECT_DATABASE_URL]"

# Keep all other variables as-is
NEXTAUTH_URL="http://localhost:3000"
# ... (rest of your config)
```

### 2.2 Initialize Development Database
```bash
# Push your current schema to the NEW dev database
npx prisma db push

# Optionally, seed with test data
npm run db:seed
```

---

## Step 3: Configure Vercel Environments (10 minutes)

### 3.1 Open Vercel Dashboard
Go to: https://vercel.com/[your-team]/residentone-workflow/settings/environment-variables

### 3.2 Configure Production Variables

**For each variable below, set "Environment" to ONLY "Production":**

1. `DATABASE_URL`
   - Value: `[YOUR_PROD_DATABASE_URL]`
   - Environment: ✅ Production only

2. `DIRECT_DATABASE_URL`
   - Value: `[YOUR_PROD_DIRECT_DATABASE_URL]`
   - Environment: ✅ Production only

### 3.3 Configure Preview (Staging) Variables

**For each variable below, set "Environment" to ONLY "Preview":**

1. `DATABASE_URL`
   - Value: `[YOUR_STAGING_DATABASE_URL]`
   - Environment: ✅ Preview only

2. `DIRECT_DATABASE_URL`
   - Value: `[YOUR_STAGING_DIRECT_DATABASE_URL]`
   - Environment: ✅ Preview only

### 3.4 Initialize Staging Database
```bash
# This will be done automatically on first Vercel preview deploy
# Or you can manually deploy to staging branch
```

---

## Step 4: Update Git Configuration (2 minutes)

### 4.1 Check Your `.gitignore`
Make sure these lines exist:
```gitignore
# Environment files
.env
.env.local
.env.production
.env.staging
.env.*.local

# Backups
backups/
*.backup
*.sql
```

### 4.2 Verify Production Credentials Are Not Committed
```bash
# Check if .env.local is tracked
git status

# If .env.local appears, remove it from git:
git rm --cached .env.local
git commit -m "Remove environment file from git"
```

---

## Step 5: Test Your Setup (10 minutes)

### 5.1 Test Local Development
```bash
# Start local dev (uses development database)
npm run dev

# Open http://localhost:3000
# Make a test change
# Verify it works
```

### 5.2 Test Staging Deployment
```bash
# Create a test branch
git checkout -b test-safe-workflow

# Make a small change (e.g., add a comment in a file)
# Edit README.md or any file

# Commit and push
git add .
git commit -m "Test: Verify staging deployment"
git push origin test-safe-workflow

# Go to Vercel dashboard
# You should see a Preview deployment
# This will use the STAGING database
```

### 5.3 Test Production Protection
```bash
# Try to run a dangerous command (should be blocked)
npm run db:reset
# Expected: ❌ BLOCKED message

# Try the old dangerous build command (should fail)
npm run build:db
# Expected: Error - command not found (we removed it!)
```

---

## Step 6: Deploy Updated Code (5 minutes)

### 6.1 Commit Your Changes
```bash
git checkout main
git add package.json SAFE-WORKFLOW.md SETUP-SAFE-ENVIRONMENTS.md
git commit -m "feat: Implement safe database workflow and environment separation"
git push origin main
```

### 6.2 Verify Vercel Build
1. Go to Vercel dashboard
2. Watch the production deployment
3. Should complete successfully
4. **Production database is NOT touched during build** ✅

---

## Step 7: Document for Your Team (5 minutes)

### 7.1 Create Team Rules Document
Share `SAFE-WORKFLOW.md` with your team and AI assistants

### 7.2 Set Clear Rules
- ❌ Never share production database credentials
- ❌ Never run database commands in production
- ✅ Always test in development first
- ✅ Always review in staging before production
- ✅ Always create backups before major changes

---

## VERIFICATION CHECKLIST

Before considering this complete, verify:

- [ ] Three separate databases created (dev, staging, prod)
- [ ] Local `.env.local` uses DEV database only
- [ ] Vercel Production environment uses PROD database
- [ ] Vercel Preview environment uses STAGING database
- [ ] `.gitignore` prevents committing `.env.local`
- [ ] Dangerous commands removed from `package.json`
- [ ] `db:reset` command is blocked
- [ ] Test deployment to staging works
- [ ] Production is protected

---

## DAILY WORKFLOW SUMMARY

```bash
# 1. DEVELOP LOCALLY (Development Database)
npm run dev
# Make changes, test locally

# 2. COMMIT AND PUSH
git add .
git commit -m "Add new feature"
git push origin main

# 3. VERCEL AUTO-DEPLOYS TO STAGING
# Review at: https://[your-preview-url].vercel.app

# 4. PROMOTE TO PRODUCTION (Manually in Vercel Dashboard)
# Only after thorough testing on staging
```

---

## EMERGENCY ROLLBACK

If something goes wrong in production:

### Option 1: Redeploy Previous Version
1. Go to Vercel → Deployments
2. Find last working deployment
3. Click "..." → "Promote to Production"

### Option 2: Restore from Backup
1. Go to your backup storage
2. Find latest backup before the issue
3. Contact support or restore manually

---

## SUPPORT

If you need help:
1. Check `SAFE-WORKFLOW.md` for common issues
2. Review Vercel deployment logs
3. Check Prisma Console for database status
4. Verify environment variables in Vercel

---

## NEXT: Schema Changes

After setup, when you need to make schema changes:
1. Edit `prisma/schema.prisma` locally
2. Run `npx prisma db push` (on dev database)
3. Test locally
4. Create migration: `npx prisma migrate dev --name your_change`
5. Commit and push
6. Vercel runs migration on staging
7. Test staging
8. Promote to production

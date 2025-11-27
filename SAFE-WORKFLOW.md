# 🛡️ SAFE DEVELOPMENT WORKFLOW
## Preventing Production Data Loss

## THE PROBLEM
Yesterday, your production database was wiped. This happened because:
1. A destructive command was run against the production database
2. There was no separation between development and production environments
3. The same `DATABASE_URL` was used for both development and production

## THE SOLUTION: THREE SEPARATE DATABASES

### Step 1: Create Three Prisma Postgres Databases

Go to https://console.prisma.io and create:

1. **residentone-production** (your current live database - NEVER TOUCH)
2. **residentone-staging** (for testing before production)
3. **residentone-development** (for your local development)

### Step 2: Set Up Environment-Specific Variables

#### `.env.local` (Local Development Only)
```env
# DEVELOPMENT DATABASE - Safe to reset/modify
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_DEV_API_KEY"
DIRECT_DATABASE_URL="postgres://YOUR_DEV_DIRECT_URL"

# All other local config...
NEXTAUTH_URL="http://localhost:3000"
```

#### `.env.production` (Create this NEW file for Vercel Production)
```env
# PRODUCTION DATABASE - NEVER USE LOCALLY
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_PROD_API_KEY"
DIRECT_DATABASE_URL="postgres://YOUR_PROD_DIRECT_URL"

NEXTAUTH_URL="https://studioflow-workflow.vercel.app"
```

#### `.env.staging` (Create this NEW file for Vercel Preview)
```env
# STAGING DATABASE - For testing before production
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_STAGING_API_KEY"
DIRECT_DATABASE_URL="postgres://YOUR_STAGING_DIRECT_URL"

NEXTAUTH_URL="https://studioflow-workflow-staging.vercel.app"
```

### Step 3: Configure Vercel Environments

In Vercel Dashboard → Settings → Environment Variables:

1. **Production Environment:**
   - Add `DATABASE_URL` and `DIRECT_DATABASE_URL` with PRODUCTION credentials
   - Only expose to "Production" environment

2. **Preview Environment:**
   - Add `DATABASE_URL` and `DIRECT_DATABASE_URL` with STAGING credentials
   - Only expose to "Preview" environment

3. **Development Environment:**
   - Add `DATABASE_URL` and `DIRECT_DATABASE_URL` with DEVELOPMENT credentials
   - Only expose to "Development" environment

### Step 4: Update .gitignore

```gitignore
# Environment files
.env
.env.local
.env.production
.env.staging
.env.*.local

# Only commit .env.example
```

## SAFE DEVELOPMENT WORKFLOW

### For Making Changes to the App:

```bash
# 1. ALWAYS work locally on development database
npm run dev

# 2. Make your code changes and test locally

# 3. When ready, commit and push to GitHub
git add .
git commit -m "Add new feature"
git push origin main

# 4. Vercel automatically:
#    - Builds your code
#    - Deploys to STAGING (preview)
#    - You test on staging
#    - You promote to production when ready
```

### For Database Schema Changes:

```bash
# 1. LOCALLY on development database - make schema changes
# Edit prisma/schema.prisma

# 2. LOCALLY apply changes (development database only)
npx prisma db push

# 3. Test your changes locally

# 4. When ready, create a migration
npx prisma migrate dev --name add_new_feature

# 5. Commit the migration file
git add prisma/migrations
git commit -m "Add migration for new feature"
git push origin main

# 6. Vercel deploys and runs:
#    - Staging: prisma migrate deploy (safe)
#    - After your approval, Production: prisma migrate deploy (safe)
```

## NEVER DO THESE THINGS:

❌ **NEVER** run `prisma db push` against production
❌ **NEVER** run `prisma migrate reset` against production
❌ **NEVER** run any command with `--force-reset` or `--accept-data-loss`
❌ **NEVER** use production DATABASE_URL in your local `.env.local`
❌ **NEVER** make database changes directly in production
❌ **NEVER** give AI access to production credentials

## EMERGENCY: If You Need to Make Production Schema Changes

```bash
# 1. Create migration locally (development database)
npx prisma migrate dev --name urgent_fix

# 2. Test locally thoroughly

# 3. Commit and push
git push origin main

# 4. Vercel will run the migration automatically on deploy
# Migration command: prisma migrate deploy (safe, no data loss)
```

## CURRENT DANGEROUS COMMANDS IN package.json

⚠️ **REMOVE THIS LINE:**
```json
"build:db": "prisma db push --accept-data-loss && npm run build",
```

✅ **SAFE BUILD COMMAND:**
```json
"build": "prisma generate && next build",
"build:vercel": "prisma migrate deploy && prisma generate && next build",
```

## BACKUP STRATEGY

### Automated Daily Backups (Already Configured)
- Vercel cron runs daily at 2 AM UTC
- Backs up to `/backups` directory
- Keeps last 7 days

### Manual Backup Before Any Production Changes
```bash
# Call the backup endpoint
curl -X POST https://studioflow-workflow.vercel.app/api/cron/daily-backup \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## TESTING YOUR CHANGES SAFELY

1. **Local Development**: Test on development database
2. **Staging**: Push to GitHub → Vercel deploys to staging with staging database
3. **Review**: Test staging thoroughly
4. **Production**: Promote from staging to production in Vercel

## SUMMARY: YOUR SAFE WORKFLOW

```mermaid
Local Dev (dev DB) → Commit → GitHub
                                  ↓
                         Vercel Auto-Deploy
                                  ↓
                     Staging (staging DB) → Test → Review
                                                      ↓
                                              Promote to Production
                                                      ↓
                                            Production (prod DB)
```

## AI ASSISTANT RULES

When working with AI:
1. ✅ AI can make code changes
2. ✅ AI can make schema changes (you test locally first)
3. ❌ AI should NEVER have production database credentials
4. ❌ AI should NEVER run database commands directly
5. ✅ AI should suggest migrations, you run them

## NEXT STEPS

1. [ ] Create 3 separate databases in Prisma Console
2. [ ] Update Vercel environment variables
3. [ ] Fix package.json build commands
4. [ ] Add .env.production and .env.staging files
5. [ ] Test the workflow with a small change
6. [ ] Document this workflow for your team

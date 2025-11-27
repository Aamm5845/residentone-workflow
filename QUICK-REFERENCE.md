# 🚨 QUICK REFERENCE: Prevent Data Loss

## What Happened Yesterday?

Your production database was **completely wiped** because:

1. ❌ A command with `--accept-data-loss` was run
2. ❌ The same database was used for both development and production  
3. ❌ No separation between environments existed
4. ❌ Dangerous build commands existed in `package.json`

**Result:** All production data was deleted to match schema changes.

---

## The Fix (3 Simple Rules)

### Rule #1: Three Separate Databases
```
Development  ← Work here freely
Staging      ← Test before production
Production   ← NEVER touch directly
```

### Rule #2: Never Run These Commands
```bash
❌ prisma db push --accept-data-loss
❌ prisma migrate reset
❌ prisma db push --force-reset
❌ npm run build:db (removed!)
```

### Rule #3: Use Safe Migrations
```bash
✅ npx prisma migrate dev --name your_change
✅ npx prisma migrate deploy
✅ npm run db:migrate
```

---

## Daily Workflow Cheat Sheet

### Making Code Changes
```bash
# 1. Work locally
npm run dev

# 2. Commit and push
git add .
git commit -m "Your change"
git push origin main

# 3. Vercel deploys to staging automatically
# 4. Test staging → Promote to production
```

### Making Schema Changes
```bash
# 1. Edit prisma/schema.prisma

# 2. Test locally (dev database)
npx prisma db push

# 3. Create migration when ready
npx prisma migrate dev --name your_change

# 4. Commit and push
git add prisma/migrations
git commit -m "Add migration"
git push origin main

# 5. Vercel applies migration safely
```

---

## Environment Setup Summary

| Environment | Database | When to Use | Credentials In |
|------------|----------|-------------|----------------|
| **Development** | residentone-dev | Local work | `.env.local` |
| **Staging** | residentone-staging | Testing | Vercel Preview |
| **Production** | residentone-prod | Live site | Vercel Production |

---

## Commands Reference

### ✅ SAFE Commands
```bash
npm run dev              # Local development
npm run db:push:dev      # Push schema to dev DB
npm run db:migrate       # Create migration
npm run db:studio        # Open Prisma Studio
npm run backup           # Create backup
```

### ❌ BLOCKED Commands
```bash
npm run db:reset         # BLOCKED - will show error
npm run build:db         # REMOVED - no longer exists
```

---

## Emergency Contacts

### If Production Goes Down
1. **Rollback**: Vercel → Deployments → Promote previous version
2. **Check Logs**: Vercel → Functions → View Logs
3. **Restore Backup**: Contact admin or use backup endpoint

### If Database is Corrupted
1. Go to Prisma Console
2. Find latest backup (daily at 2 AM UTC)
3. Restore from backup (contact Prisma support if needed)

---

## Protection Systems Active

✅ **Code Protection:**
- Dangerous commands removed from `package.json`
- `db-protect.js` script blocks risky commands
- Build process uses safe `migrate deploy`

✅ **Environment Protection:**
- Separate databases for each environment
- Production credentials only in Vercel Production
- Local `.env.local` uses development database only

✅ **Backup Protection:**
- Daily automated backups at 2 AM UTC
- Manual backup available via API endpoint
- Backup history retained for 7 days

---

## Vercel Configuration

### Build Command (Safe)
```json
"build:vercel": "prisma migrate deploy && prisma generate && next build"
```

This command:
- ✅ Applies migrations (safe, no data loss)
- ✅ Generates Prisma Client
- ✅ Builds Next.js app
- ❌ Does NOT use `db push` or `--accept-data-loss`

---

## Quick Checks

### Is My Setup Safe?
```bash
# Check 1: Local environment uses dev database
cat .env.local | grep DATABASE_URL
# Should NOT show production URL

# Check 2: Dangerous commands removed
npm run build:db
# Should show "command not found"

# Check 3: Protection active
npm run db:reset
# Should show "BLOCKED" message
```

### Is Production Safe?
1. Vercel → Settings → Environment Variables
2. Check `DATABASE_URL` for "Production"
3. Should be different from your local `.env.local`
4. Should point to residentone-production database

---

## When to Create a Backup

### Always Before:
- Making schema changes
- Deploying to production
- Running data migrations
- Bulk data operations

### How to Create Backup:
```bash
# Option 1: Manual backup script
npm run backup

# Option 2: API endpoint
curl -X POST https://your-domain.vercel.app/api/cron/daily-backup \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Working with AI Assistants

### ✅ AI Can Do:
- Suggest code changes
- Suggest schema changes
- Create migration files
- Review your code

### ❌ AI Should NOT:
- Have production database credentials
- Run database commands directly
- Access production environment
- Execute migrations

### Safe AI Workflow:
1. AI suggests changes
2. You review and test locally
3. You commit and push
4. Vercel handles deployment

---

## Red Flags 🚩

Stop immediately if you see:
- 🚩 `--accept-data-loss` in any command
- 🚩 `--force-reset` in any command
- 🚩 Production DATABASE_URL in local files
- 🚩 Commands that wipe/reset database
- 🚩 Direct database manipulation in production

---

## Support Resources

- **Full Guide**: `SAFE-WORKFLOW.md`
- **Setup Steps**: `SETUP-SAFE-ENVIRONMENTS.md`
- **Prisma Console**: https://console.prisma.io
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Backup Status**: Check Vercel → Functions → Cron Jobs

---

## Key Takeaway

> **The only way to modify production database schema is through migrations.**  
> **Never run `prisma db push` or any destructive command against production.**  
> **Always test in development → staging → production.**

---

## Version History

- ✅ Dangerous commands removed from package.json
- ✅ Safe build process implemented
- ✅ Environment separation configured
- ✅ Protection scripts active
- ✅ Daily backups running

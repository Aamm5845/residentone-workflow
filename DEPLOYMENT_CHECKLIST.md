# 🚀 Deployment Checklist

## ✅ Security Verified

### Protected from Git
The following files containing real credentials are **ignored by git**:
- ✅ `.env.local` (your active environment)
- ✅ `.env.local.backup` (backup with real tokens)
- ✅ `.env.local.old` (old environment)
- ✅ `.env.local.new` (template we created)
- ✅ `DROPBOX_TEAM_SETUP_GUIDE.md` (has real tokens)
- ✅ `VERCEL_ENV_SETUP.md` (has real tokens)
- ✅ `MIGRATION_COMPLETE.md` (has real tokens)
- ✅ `QUICK_START.md` (has real tokens)

### Safe for Git (No Secrets)
These files are **safe to commit**:
- ✅ `DROPBOX_SETUP.example.md` (template only)
- ✅ `VERCEL_ENV_SETUP.example.md` (template only)
- ✅ `.env.local.template` (template only)
- ✅ `src/lib/dropbox-service-v2.ts` (code, no secrets)
- ✅ `src/app/api/dropbox/test-*` (test endpoints, no secrets)

## 📝 For Vercel Production

### Environment Variables to Add (7 total)

```bash
# Get actual values from the files on your local machine:
# - DROPBOX_TEAM_SETUP_GUIDE.md (local only, not in git)
# - VERCEL_ENV_SETUP.md (local only, not in git)
# - .env.local (local only, not in git)

DROPBOX_REFRESH_TOKEN=<from-your-local-files>
DROPBOX_APP_KEY=<from-your-local-files>
DROPBOX_APP_SECRET=<from-your-local-files>
DROPBOX_TEAM_ID=<from-your-local-files>
DROPBOX_ROOT_NAMESPACE_ID=<from-your-local-files>
DROPBOX_API_SELECT_USER=<from-your-local-files>
DROPBOX_TEAM_MEMBERS=<from-your-local-files>
```

**Note**: `DROPBOX_PATH_ROOT` is **NOT** needed as a separate variable. The service constructs it automatically from `DROPBOX_ROOT_NAMESPACE_ID`.

## 🔧 Deployment Steps

### 1. Commit Safe Changes to Git
```bash
git add .gitignore
git add src/lib/dropbox-service-v2.ts
git add src/lib/dropbox-utils.ts
git add src/app/api/dropbox/test-team/
git add src/app/api/dropbox/test-auth/
git add src/app/api/dropbox/test-member-access/
git add DROPBOX_SETUP.example.md
git add VERCEL_ENV_SETUP.example.md
git commit -m "feat: Add Dropbox team integration with member support"
git push origin main
```

### 2. Add Environment Variables to Vercel

**Via Dashboard**:
1. Go to https://vercel.com
2. Select your project: **residentone-workflow**
3. Settings → Environment Variables
4. Add each of the 7 variables above
5. Select: Production, Preview, Development
6. Save

**Via CLI**:
```bash
vercel env add DROPBOX_REFRESH_TOKEN production
# ... repeat for all 7 variables
```

### 3. Deploy
```bash
# Option A: Auto-deploy via git push (already done in step 1)

# Option B: Manual deploy via CLI
vercel --prod

# Option C: Via Vercel Dashboard
# Deployments → Redeploy
```

### 4. Verify Production
Visit: `https://app.meisnerinteriors.com/api/dropbox/test-team`

Expected:
```json
{
  "success": true,
  "summary": {
    "totalMembers": 4,
    "successfulConnections": 4,
    "allConfigured": true
  }
}
```

## 🔐 Security Best Practices

### ✅ What We Did Right
1. **.env.local ignored** - Local credentials never in git
2. **Documentation with secrets ignored** - Setup guides with real tokens excluded
3. **Example files created** - Templates provided for reference
4. **.gitignore updated** - All backup and sensitive files protected
5. **Vercel-only secrets** - Production tokens only in Vercel dashboard

### ⚠️ Important Reminders
- **Never** commit `.env.local` or any file with real tokens
- **Always** check `git status` before pushing
- **Rotate** tokens if they're ever accidentally exposed
- **Use** environment variables for all secrets
- **Keep** local documentation files (with real tokens) for reference

## 📊 Files Status Summary

| File | Status | Contains Secrets | Git Action |
|------|--------|-----------------|------------|
| `.env.local` | Ignored | ✅ Yes | Never commit |
| `.env.local.backup` | Ignored | ✅ Yes | Never commit |
| `DROPBOX_TEAM_SETUP_GUIDE.md` | Ignored | ✅ Yes | Never commit |
| `VERCEL_ENV_SETUP.md` | Ignored | ✅ Yes | Never commit |
| `DROPBOX_SETUP.example.md` | Tracked | ❌ No | Safe to commit |
| `VERCEL_ENV_SETUP.example.md` | Tracked | ❌ No | Safe to commit |
| `src/lib/dropbox-service-v2.ts` | Tracked | ❌ No | Safe to commit |
| Test endpoints | Tracked | ❌ No | Safe to commit |

## ✨ What Happens After Push

1. Git push triggers Vercel deployment
2. Vercel builds with environment variables
3. New Dropbox service activates
4. All 4 team members can access their files
5. Aaron (admin) sees team folders
6. Other members see personal spaces

## 🆘 If Something Goes Wrong

### Secrets Accidentally Committed
```bash
# Remove from git history immediately
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch <filename>" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (WARNING: destructive)
git push origin --force --all

# Rotate ALL tokens immediately
```

### Vercel Build Fails
1. Check environment variables are set
2. Check all 7 variables have values
3. Check DROPBOX_TEAM_MEMBERS JSON is valid (no line breaks)
4. Check Vercel build logs for specific errors

### Test Endpoint Fails
1. Verify environment variables in Vercel dashboard
2. Check token hasn't expired (unlikely with refresh token)
3. Verify member IDs are correct
4. Check Vercel function logs

## 📞 Support Resources

- **Local docs** (with real values): Check your local machine only
- **Example docs** (safe templates): In git repository
- **Vercel dashboard**: For production environment variables
- **Test endpoint**: `/api/dropbox/test-team` for diagnostics

---

**Current Status**: ✅ Secured and ready for deployment
**Action**: Add environment variables to Vercel, then deploy!

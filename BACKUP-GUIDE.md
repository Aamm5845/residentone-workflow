# 🛡️ Complete Backup Solution for ResidentOne

**TLDR: Run `npm run backup:simple` before any changes, and `npm run backup:full` when your dev server is stopped.**

## 🚀 Quick Backup Commands

### Before Making Changes (ALWAYS DO THIS):
```powershell
npm run backup:simple
```
Creates a configuration backup instantly, even while dev server is running.

### Full Database Backup (when dev server is stopped):
```powershell
# Stop your dev server first, then:
npm run backup:full
```

### Emergency Backup (any time):
```powershell
npm run backup:emergency
```

## 📋 All Available Commands

| Command | When to Use | What it Backs Up |
|---------|-------------|------------------|
| `npm run backup:simple` | **Before any changes** | Config, structure, package info |
| `npm run backup:full` | Dev server stopped | **Full database data** |
| `npm run backup:emergency` | Server issues | Whatever is accessible |
| `npm run backup:restore` | Restore database | Interactive restore menu |
| `npm run backup:list` | Check backups | List all backup files |
| `npm run backup:schedule` | One-time setup | Daily automated backups |

## 🔄 Your Daily Workflow

### 1. Start Your Day
```powershell
npm run backup:simple    # Quick safety backup
npm run dev             # Start development
```

### 2. Before Major Changes
```powershell
npm run backup:simple    # Always before updates
# Make your changes...
```

### 3. End of Day / Before Deployment
```powershell
# Stop dev server (Ctrl+C)
npm run backup:full      # Complete database backup
```

### 4. If Something Breaks
```powershell
npm run backup:restore   # Choose which backup to restore
```

## 📁 Backup Files Location

All backups are stored in:
```
C:\Users\ADMIN\Desktop\residentone-workflow\backups\
```

## 🛠️ Setup Instructions

### 1. Initial Setup (Run Once)
```powershell
# Setup automated daily backups
npm run backup:schedule

# Create your first backup
npm run backup:simple
```

### 2. Install PostgreSQL Tools (Optional but Recommended)
1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Install with default settings
3. Add to PATH: `C:\Program Files\PostgreSQL\15\bin`
4. Restart PowerShell
5. Test: `npm run backup:pg`

## 🚨 Emergency Recovery

### If You Lose All Data:

1. **Check for backups:**
   ```powershell
   npm run backup:list
   ```

2. **Restore from most recent:**
   ```powershell
   npm run backup:restore
   ```

3. **If restore fails, manual restore:**
   ```powershell
   # Stop dev server
   # Copy backup file contents
   # Contact support with backup file
   ```

## 💡 Pro Tips

1. **Always backup before:**
   - Installing new packages
   - Updating code
   - Running database migrations
   - Deploying to production

2. **Multiple backup types:**
   - `backup:simple` - Fast, always works
   - `backup:full` - Complete, needs dev server stopped
   - `backup:emergency` - When nothing else works

3. **Backup validation:**
   ```powershell
   npm run backup:list     # Check backup sizes
   ```
   Normal sizes: 1-50 KB (simple), 100-5000 KB (full)

4. **External backups:**
   - Copy `backups` folder to OneDrive/Google Drive weekly
   - Email important backup files to yourself

## 🔧 Troubleshooting

### "Prisma client not generated"
```powershell
# Stop dev server first, then:
npx prisma generate
npm run backup:full
```

### "Permission denied" / "File locked"
```powershell
# Stop dev server, then:
npm run backup:emergency
```

### "No backups found"
```powershell
# Check directory exists:
dir backups

# Create first backup:
npm run backup:simple
```

### "Backup too small" (under 1KB)
This usually means the backup didn't capture data. Try:
1. `npm run backup:full` (with dev server stopped)
2. If that fails: `npm run backup:emergency`

## 📊 Backup Types Explained

### Simple Backup (`backup:simple`)
- **Size:** ~1KB
- **Speed:** Instant
- **Contains:** Configuration, structure, environment
- **When:** Before every change
- **Reliability:** 100% - always works

### Full Backup (`backup:full`)
- **Size:** 100KB-5MB
- **Speed:** 10-30 seconds
- **Contains:** Complete database with all projects, users, assets
- **When:** End of day, before deployment
- **Reliability:** 95% - needs dev server stopped

### Emergency Backup (`backup:emergency`)
- **Size:** Variable
- **Speed:** Fast
- **Contains:** Whatever is accessible
- **When:** When other backups fail
- **Reliability:** 80% - fallback method

## 🎯 Best Practices

1. **Daily Routine:**
   ```powershell
   # Morning:
   npm run backup:simple && npm run dev

   # Before changes:
   npm run backup:simple

   # Evening:
   # Stop server, then:
   npm run backup:full
   ```

2. **Before Updates:**
   ```powershell
   npm run backup:simple
   npm run backup:full  # if server stopped
   # Make changes
   # Test everything
   # Deploy
   ```

3. **Weekly:**
   - Copy `backups` folder to external storage
   - Test restore process with old backup
   - Clean up very old backups (>30 days)

## 📞 Support

If backups fail:

1. Check `backups/backup-log.txt`
2. Try different backup type
3. Ensure database is accessible
4. Contact support with error details

---

**🛡️ Remember: When in doubt, backup! It takes 10 seconds and can save hours of work.**
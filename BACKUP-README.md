# 🛡️ ResidentOne Database Backup System

This backup system ensures your project data is always safe and can be restored when needed. It's designed specifically for your Windows development environment.

## 📋 Quick Start

### 1. Create Your First Backup
```powershell
npm run backup
```

### 2. Start Development with Auto-Backup
```powershell
npm run dev:safe
```
This creates a backup before starting your dev server.

### 3. Setup Automated Daily Backups
```powershell
npm run backup:schedule
```
This sets up a Windows Task Scheduler task to backup daily at 2 AM.

## 🔧 Available Commands

| Command | Description |
|---------|-------------|
| `npm run backup` | Create immediate backup |
| `npm run backup:restore` | Interactive restore from backup |
| `npm run backup:list` | List all available backups |
| `npm run backup:schedule` | Setup automated daily backups |
| `npm run backup:manual` | Run manual backup via PowerShell |
| `npm run dev:safe` | Backup then start development |

## 📁 File Structure

```
residentone-workflow/
├── scripts/
│   ├── backup-database.js      # Main backup script
│   ├── restore-database.js     # Restore utility
│   └── daily-backup.ps1        # PowerShell automation
├── backups/                    # Backup storage
│   ├── database-backup-2024-01-15T10-30-00.sql
│   ├── database-backup-2024-01-14T10-30-00.sql
│   └── backup-log.txt          # Backup history
└── BACKUP-README.md           # This file
```

## 🚀 Workflow Integration

### Before Major Updates
1. **Always backup first:**
   ```powershell
   npm run backup
   ```

2. **Test your changes:**
   ```powershell
   npm run dev:safe  # Starts with fresh backup
   ```

3. **If something breaks, restore:**
   ```powershell
   npm run backup:restore
   ```

### Before Deploying
```powershell
# Create backup, test, then deploy
npm run backup
npm run build:full
# Deploy to Vercel/production
```

## 🔄 Restore Process

1. **List available backups:**
   ```powershell
   npm run backup:list
   ```

2. **Choose backup to restore:**
   ```powershell
   npm run backup:restore
   ```

3. **Follow interactive prompts:**
   - Select backup by number
   - Confirm restoration
   - Wait for completion

## ⚙️ Automated Backups

### Setup Once:
```powershell
npm run backup:schedule
```

This creates a Windows Task Scheduler task that:
- Runs daily at 2:00 AM
- Creates timestamped backups
- Keeps last 10 backups (auto-cleanup)
- Logs all operations
- Sends notifications on failure

### Manual Scheduled Backup:
```powershell
npm run backup:manual
```

## 🛠️ Troubleshooting

### If Backup Fails:
1. **Check PostgreSQL is running:**
   - Make sure your database server is started
   - Verify DATABASE_URL in .env file

2. **Check permissions:**
   - Ensure scripts directory is accessible
   - Run PowerShell as Administrator if needed

3. **Check disk space:**
   - Ensure enough space in backups folder
   - Old backups auto-cleanup after 10 files

### If Restore Fails:
1. **Verify backup file integrity:**
   ```powershell
   # Check backup file size
   dir backups\database-backup-*.sql
   ```

2. **Try different backup:**
   - Use `npm run backup:restore` and select different backup
   - Choose most recent working backup

3. **Manual restore:**
   ```powershell
   # If scripts fail, use direct PostgreSQL commands
   psql -d your_database -f "backups\database-backup-YYYY-MM-DDTHH-mm-ss.sql"
   ```

## 📊 Backup Verification

### Check Backup Size:
```powershell
npm run backup:list
```
Typical backup sizes:
- Fresh install: 10-50 KB
- With projects: 100-500 KB  
- Heavy usage: 1-5 MB

### Test Restore (Safe):
1. Create current backup
2. Restore from older backup
3. Verify data is correct
4. Restore back to current backup

## 🚨 Emergency Recovery

If you lose all data:

1. **Check backup folder:**
   ```
   C:\Users\ADMIN\Desktop\residentone-workflow\backups\
   ```

2. **Find latest backup:**
   Look for `database-backup-[timestamp].sql`

3. **Manual restore:**
   ```powershell
   psql -U postgres -d residentone -f "path\to\backup.sql"
   ```

4. **Regenerate Prisma:**
   ```powershell
   npx prisma generate
   ```

## 🔒 Security Notes

- Backups contain sensitive project data
- Store backups in secure location
- Consider encrypting backup files for production
- Don't commit backup files to Git (already in .gitignore)

## 📝 Best Practices

1. **Backup before every major change**
2. **Test restore process monthly**
3. **Keep external copies of important backups**
4. **Monitor automated backup logs**
5. **Use `npm run dev:safe` during development**

## 🆘 Support

If you encounter issues:

1. Check `backups/backup-log.txt` for errors
2. Verify PostgreSQL is running
3. Ensure DATABASE_URL is correct in .env
4. Try running individual scripts manually:
   ```powershell
   node scripts/backup-database.js
   node scripts/restore-database.js
   ```

---

**Remember: Your data is precious. When in doubt, backup! 🛡️**
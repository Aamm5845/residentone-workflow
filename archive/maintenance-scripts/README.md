# Maintenance Scripts Archive

This folder contains utility scripts used during development and debugging.

## ⚠️ Important Notice

These scripts are **archived** and should **NOT be used in production**. They were created during development for:
- Database backup and restore operations
- Data verification and consistency checks
- Emergency recovery procedures
- Development debugging

## Scripts Overview

### Backup/Restore Scripts
- Various `backup-*.js`, `restore-*.js` files
- `EMERGENCY_RESTORE.js` - Emergency database restore
- `restore_backup.ts` - TypeScript backup restoration

### Verification Scripts
- `check-*.js` - Database consistency checks
- `verify-*.js` - Data verification utilities

### Cleanup Scripts
- `cleanup-*.js` - Data cleanup utilities
- `nuclear-cleanup.js` - Aggressive cleanup (USE WITH CAUTION)

### Analysis Scripts
- `search-*.js` - Data search utilities
- `find-*.js` - Finding specific data patterns
- `analyze-backup.js` - Backup analysis

## Usage Warning

**DO NOT run these scripts on production databases unless you:**
1. Have a complete backup
2. Understand exactly what the script does
3. Have tested it on a development copy first

## Modern Alternatives

Instead of these scripts, use the built-in npm commands:

```bash
# Database backup
npm run backup

# Database restore
npm run backup:restore

# Check database
npm run db:studio
```

## Archived Date

November 24, 2025

## If You Need These Scripts

If you need to use any of these scripts:
1. Review the code carefully
2. Test on a development database first
3. Create a backup before running
4. Consider if there's a better modern approach

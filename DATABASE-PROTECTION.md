# 🛡️ Database Protection System

This project has a **multi-layer database protection system** to prevent accidental data loss.

## 🔒 Protection Layers

### 1. Command Blocker (`scripts/db-protect.js`)
Blocks dangerous Prisma commands that can delete data:
- `prisma migrate reset`
- `prisma db push --force-reset`
- `prisma db push --accept-data-loss`

### 2. Automatic Backups
Prisma automatically creates:
- **Hourly backups** (kept for 24 hours)
- **Daily backups** (kept for 7 days)

Access backups at: https://console.prisma.io/

### 3. Backup Reminders
The backup script reminds you to create backups before changes.

## ✅ Safe Commands for Schema Changes

### Adding New Fields/Tables (Recommended)
```bash
npm run db:push
```
This command:
- ✅ Adds new columns/tables
- ✅ Preserves all existing data
- ✅ Safe for production

### Creating Migration Files
```bash
npm run db:migrate
```
This command:
- ✅ Creates migration files
- ✅ Tracks schema history
- ✅ Safe for production

## ⚠️ Emergency: If You Need to Reset Database

**WARNING: This will DELETE ALL DATA!**

Only do this if:
- You're starting fresh
- You have a recent backup
- You understand you'll lose all data

Steps:
1. **Create a backup first!**
   ```bash
   npm run db:backup
   ```

2. **Disable protection temporarily**
   Add to `.env`:
   ```
   DB_PROTECTION=disabled
   ```

3. **Run your reset command**
   ```bash
   npx prisma migrate reset
   ```

4. **Re-enable protection**
   Remove `DB_PROTECTION=disabled` from `.env`

## 🔧 NPM Scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "db:push": "node scripts/db-protect.js prisma db push",
    "db:migrate": "node scripts/backup-db.js && node scripts/db-protect.js prisma migrate dev",
    "db:backup": "node scripts/backup-db.js",
    "db:studio": "prisma studio"
  }
}
```

## 📋 Best Practices

1. **Always use `npm run db:push` for schema changes** - Never use `prisma migrate reset`
2. **Run `npm run db:backup` before major changes**
3. **Check Prisma Console regularly** for backup status
4. **Never disable protection** unless absolutely necessary
5. **Test changes locally first** before pushing to production

## 🆘 Restoring from Backup

If data is lost:

1. Go to https://console.prisma.io/
2. Select your database
3. Go to "Backups" tab
4. Choose a backup point
5. Click "Restore"
6. Create new environment or restore to existing
7. Update `DATABASE_URL` in `.env` and Vercel

## 🤖 For AI Assistants

**IMPORTANT RULES:**
- ❌ NEVER run `prisma migrate reset`
- ❌ NEVER run `prisma db push --force-reset`
- ❌ NEVER run `prisma db push --accept-data-loss`
- ✅ ALWAYS use `npm run db:push` for schema changes
- ✅ ALWAYS run `npm run db:backup` before major changes
- ✅ ALWAYS check if command is blocked before suggesting alternatives

If schema changes are needed:
1. Run `npm run db:backup` first
2. Use `npm run db:push` to apply changes
3. Verify changes don't break existing data

## 📞 Support

If you encounter issues:
- Check Prisma Console: https://console.prisma.io/
- Review backup metadata in `.db-backups/` folder
- Contact support with your database ID

---

**Remember: Data loss is permanent. Always backup before changes!**

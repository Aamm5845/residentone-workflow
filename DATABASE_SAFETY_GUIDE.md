# Database Safety Guide 🛡️

## The Problem
Using `prisma db push` bypasses migration history and can cause data loss during breaking changes.

## Safe Database Change Process

### ✅ SAFE: Use Migrations
```bash
# 1. Make schema changes in prisma/schema.prisma
# 2. Generate migration
npx prisma migrate dev --name "add_contractor_model"

# 3. Migration gets saved in prisma/migrations/
# 4. Can be reviewed, tested, and rolled back if needed
```

### ❌ DANGEROUS: Using db push
```bash
# This bypasses migration history and can lose data
npx prisma db push --accept-data-loss  # ❌ NEVER USE
```

## Data-Safe Schema Changes

### ✅ Safe Changes (No Data Loss)
- Adding new optional columns
- Adding new tables
- Adding indexes
- Expanding column size (varchar(50) → varchar(100))

### ⚠️ Risky Changes (Potential Data Loss)
- Renaming columns
- Changing column types
- Adding required columns to existing tables with data
- Dropping columns or tables

### 🛡️ Safe Migration Strategy for Risky Changes

#### Example: Renaming a Column Safely
```sql
-- Instead of: ALTER TABLE projects DROP COLUMN coverImageUrl, ADD COLUMN coverImages JSON;

-- Step 1: Add new column
ALTER TABLE projects ADD COLUMN coverImages JSON;

-- Step 2: Migrate data (custom script)
UPDATE projects SET coverImages = JSON_ARRAY(coverImageUrl) WHERE coverImageUrl IS NOT NULL;

-- Step 3: In a separate migration, drop old column
ALTER TABLE projects DROP COLUMN coverImageUrl;
```

## Database Backup Strategy

### 1. Automated Backups (Neon/Vercel Postgres)
Your current provider (Neon) automatically creates backups:
- Point-in-time recovery available
- Check your Neon dashboard for backup options

### 2. Manual Backup Before Risky Changes
```bash
# Export current data before changes
npx prisma db execute --file=backup_$(date +%Y%m%d_%H%M%S).sql --stdin < schema.sql
```

### 3. Test Environment
```bash
# Use a separate database for testing migrations
DATABASE_URL="your_test_db_url" npx prisma migrate dev
```

## Recovery Options

### 1. Neon Dashboard Recovery
1. Go to your Neon dashboard (console.neon.tech)
2. Select your database
3. Look for "Restore" or "Point-in-time recovery"
4. Select a point before the data loss

### 2. Migration Rollback
```bash
# If using migrations, you can rollback
npx prisma migrate reset  # Resets and re-applies all migrations
```

### 3. Schema Restore
```bash
# If you have a backup schema
cp backup_schema.prisma prisma/schema.prisma
npx prisma db push --accept-data-loss  # Only if you're sure
```

## Best Practices Going Forward

### ✅ DO
- Always use `npx prisma migrate dev` for schema changes
- Test migrations on development data first
- Keep migration files in version control
- Read warnings carefully before proceeding
- Create backups before major changes

### ❌ DON'T
- Use `db push --accept-data-loss` on production data
- Ignore data loss warnings
- Make breaking changes without data migration plan
- Delete migration files from version control

## Emergency Recovery Checklist

1. **Check current data state** (like we just did)
2. **Check Neon dashboard** for point-in-time recovery
3. **Restore from backup** if available
4. **Re-seed critical data** if backup not available
5. **Document what was lost** for future prevention

## Current Status ✅
Your data is SAFE! Only the coverImageUrl field content was lost (2 URLs), but all critical business data (users, projects, clients, rooms) is intact.
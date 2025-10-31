# Database Migration Instructions - Custom Design Sections

## What Changed
Changed `DesignSection.type` from an enum (`DesignSectionType`) to a `String` to allow custom section types.

## Why This Is Safe
✅ **Your data will NOT be deleted!** This migration only changes the column type from enum to string.
✅ All existing sections (GENERAL, WALL_COVERING, CEILING, FLOOR) will remain unchanged.
✅ The values are compatible - the migration just relaxes the constraint.

## Steps to Apply Migration

### 1. Create the migration
```bash
npx prisma migrate dev --name allow-custom-design-sections
```

This will:
- Generate SQL migration file
- Apply it to your database
- Regenerate Prisma Client

### 2. If you see any warnings
If Prisma shows a warning about data loss (it shouldn't, but just in case):
- Review the generated SQL file in `prisma/migrations/`
- The SQL should be something like: `ALTER TABLE "DesignSection" ALTER COLUMN "type" TYPE TEXT;`
- This is safe and won't delete data

### 3. Expected SQL Migration
The migration should look like this:
```sql
-- AlterTable
ALTER TABLE "DesignSection" ALTER COLUMN "type" TYPE TEXT;
```

### 4. After Migration
Once applied, you'll be able to create custom sections like:
- LIGHTING
- FURNITURE
- ACCESSORIES
- WINDOW_TREATMENTS
- Or any other custom name

## Rollback (if needed)
If you need to undo this change:
```bash
npx prisma migrate resolve --rolled-back <migration-name>
```

Then manually revert the schema.prisma changes and create a new migration.

## Testing
After migration, test by:
1. Creating a new custom section in the Design Concept workspace
2. Verify it appears correctly
3. Verify existing sections (GENERAL, WALL_COVERING, CEILING, FLOOR) still work

## Notes
- The 4 default sections are still hardcoded in the frontend
- Custom sections will be added dynamically to the UI
- Section count will show: 4 default + X custom sections

# Database Schema Sync Fix

## Issue
The Prisma schema includes an `address` field in the Project model, but the database schema doesn't have this column, causing the "Unknown argument `address`" error.

## Solution Options

### Option 1: Push Schema Changes (Recommended)
When Node.js is available in the system PATH, run:
```bash
npx prisma db push
```

### Option 2: Generate and Apply Migration
```bash
npx prisma migrate dev --name add-address-to-projects
```

### Option 3: Manual Database Update
If using a direct database connection, add the address column:
```sql
ALTER TABLE Project ADD COLUMN address TEXT;
```

## Current Workaround
- The `address` field has been temporarily commented out in `/src/app/api/projects/route.ts`
- Projects can be created without the address field
- Once the database is synced, uncomment line 114 to restore full functionality

## Steps to Fully Fix:
1. Ensure Node.js is in your system PATH
2. Run `npx prisma db push` or `npx prisma migrate dev`
3. Uncomment the address field in the projects API route
4. Test project creation with address field

## Related Files:
- `/src/app/api/projects/route.ts` (line 114 - commented address field)
- `/prisma/schema.prisma` (line 195 - address field definition)

## Verification:
After fixing, you should be able to create projects with the full address field included.
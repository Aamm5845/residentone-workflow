# Prisma Reset Protection System

## 🔒 Protection Active

This project has multiple layers of protection against accidental database resets.

## How It Works

### 1. **Command Override**
The `npm run prisma` command is now blocked by default and will show an error.

### 2. **Reset Command Protection**
Running `npm run db:reset` will be blocked unless you explicitly enable it.

### 3. **Production Lock**
Database resets are **NEVER** allowed when `NODE_ENV=production`.

## Enabling Reset (When Needed)

If you **intentionally** need to reset your database:

### PowerShell (Windows):
```powershell
$env:ALLOW_PRISMA_RESET="true"
npx prisma migrate reset --force
```

### CMD (Windows):
```cmd
set ALLOW_PRISMA_RESET=true
npx prisma migrate reset --force
```

### Bash/Zsh (Mac/Linux):
```bash
export ALLOW_PRISMA_RESET=true
npx prisma migrate reset --force
```

## ⚠️ Important Notes

1. **The environment variable is session-specific** - it only lasts for the current terminal session
2. **Always create a backup first** using: `npm run backup`
3. **Never commit with `ALLOW_PRISMA_RESET=true`** in your `.env` files
4. **AI agents cannot bypass this protection** without explicitly setting the variable

## Restore from Backup

If data is accidentally lost, restore using:

```powershell
npm run backup:restore
```

## Testing the Protection

Try running these commands - they should all be blocked:

```bash
npm run db:reset
npx prisma migrate reset
npx prisma migrate reset --force
```

You should see:
```
❌ PRISMA RESET IS BLOCKED
   To allow database reset, run:
   $env:ALLOW_PRISMA_RESET="true"  (PowerShell)
```

## For AI Agents Working on This Project

**NEVER run any of these commands:**
- `npx prisma migrate reset`
- `prisma migrate reset --force`
- Any command containing "reset" and "prisma"

**Instead, suggest:**
- `npm run db:push` for schema changes
- `npm run db:migrate` for creating migrations
- `npm run backup` before making changes

The protection system will prevent accidental resets, but explicit manual commands can still bypass it if the user sets the environment variable.

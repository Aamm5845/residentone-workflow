# Security Guidelines

## 🚨 Important Security Notice

This repository has been cleaned of exposed secrets. Follow these guidelines to maintain security:

## Environment Variables

### Required Environment Variables
Copy `.env.example` to `.env.local` and fill in your actual values:

```bash
cp .env.example .env.local
```

### Never Commit These:
- Database connection strings
- API keys and tokens  
- Passwords (even temporary ones)
- Private keys or certificates
- Client secrets
- Authentication tokens

## Best Practices

### 1. Use Environment Variables
```typescript
// ❌ Never do this
const password = "hardcoded-password-123"

// ✅ Do this instead  
const password = process.env.TEMP_PASSWORD
```

### 2. Document With Placeholders
```markdown
# ❌ Bad - exposes actual credentials
Database: postgresql://user:password123@host.com:5432/db

# ✅ Good - uses placeholders
Database: postgresql://[username]:[password]@[host]:[port]/[database]
```

### 3. Use Secure Secret Generation
```bash
# Generate secure secrets
openssl rand -base64 32

# Or use Node.js
node -p "require('crypto').randomBytes(32).toString('base64')"
```

## Files to Keep Private

These files should NEVER be committed:
- `.env.local`
- `.env.production`  
- `backup-log.txt`
- `*.sql` database dumps
- Any file ending in `-secrets.*`
- Test files with actual credentials

## Emergency Response

If secrets are accidentally committed:

1. **Immediately rotate the exposed secrets**
2. **Remove from git history** (if recent):
   ```bash
   git filter-branch --force --index-filter \
   'git rm --cached --ignore-unmatch path/to/file' \
   --prune-empty --tag-name-filter cat -- --all
   ```
3. **Force push to remove from remote**:
   ```bash  
   git push origin --force --all
   ```
4. **Update all deployments** with new secrets

## Verification

Run this to check for potential secrets:
```bash
# Search for common patterns
grep -r "password.*=" . --exclude-dir=node_modules
grep -r "postgresql://" . --exclude-dir=node_modules  
grep -r "sk_" . --exclude-dir=node_modules
```

## Contact

If you discover any exposed secrets, immediately:
1. Notify the development team
2. Rotate the compromised credentials
3. Update all environments with new values

---
**Last Updated:** September 2025  
**Status:** ✅ Repository cleaned of exposed secrets
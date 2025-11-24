# Test Routes Archive

This folder contains test and debug routes that were used during development.

## ⚠️ Important Notice

These routes are **archived** and have been removed from the production codebase to:
- Reduce security risk (test endpoints can expose internal logic)
- Improve performance (fewer routes to compile)
- Clean up the codebase
- Prevent accidental exposure of debug tools in production

## What's Archived

### App Pages (`/app`)
- `test-auth` - Authentication testing page
- `test-cad-interface` - CAD interface testing
- `test-design-board` - Design board testing
- `test-dropbox` - Dropbox integration testing
- `test-icons` - Icon library preview
- `test-project-settings` - Project settings testing
- `email-demo` - Email template preview
- `debug`, `debug-design-concept`, `debug-mentions` - Various debug pages
- `dashboard-simple` - Simplified dashboard variant

### API Routes (`/api`)
- `test-*` routes - Various API testing endpoints
- `debug-*` routes - Debug utilities
- `explore-folders` - Folder exploration tool
- `final-test` - Final testing route
- `direct-ns-test` - Namespace testing
- Nested debug routes from dropbox, ffe, etc.

## If You Need These Routes in Development

### Option 1: Restore Temporarily
```bash
# Copy back the routes you need
cp -r archive/test-routes/app/test-auth src/app/
```

### Option 2: Create New Test Routes (Recommended)
Instead of using old test routes, create new ones in a dedicated testing directory:

```
src/__tests__/manual-testing/
```

### Option 3: Use Environment-Based Access
If you need test routes in development but not production, use:

```typescript
// In route.ts
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  
  // Your test logic here
}
```

## Best Practices for Testing

Instead of exposing test routes:

1. **Unit Tests**: Use Jest for component and function testing
   ```bash
   npm test
   ```

2. **Integration Tests**: Test API routes with supertest
   ```bash
   npm run test:integration
   ```

3. **Manual Testing**: Use dedicated testing tools
   - API testing: Use Postman or Thunder Client
   - UI testing: Use browser dev tools
   - Email testing: Use Ethereal Email or MailHog

4. **Development Tools**: Use Next.js features
   - API routes in development mode only
   - Development-only middleware
   - Environment-based feature flags

## Archived Date

November 24, 2025

## Security Note

**Never expose test/debug routes in production** as they can:
- Reveal implementation details
- Bypass authentication/authorization
- Expose sensitive data
- Provide attack vectors
- Impact performance

If you absolutely need a test endpoint in production, ensure it:
- Requires authentication
- Has rate limiting
- Logs all access
- Only returns sanitized data
- Is documented and reviewed

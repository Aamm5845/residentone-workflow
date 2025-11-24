# Known Issues

This document tracks known issues that need to be resolved.

---

## 🚨 High Priority

### Next.js 15 Route Handler Type Errors

**Status:** 🟡 Deferred (Tracked)  
**Priority:** High  
**Affects Build:** Yes (temporarily ignored)  
**Affects Functionality:** No

#### Description

Next.js 15 has stricter type checking for route handlers with dynamic parameters. Several API routes have type mismatches between the expected parameter types and the actual implementation.

#### Affected Routes

Routes with dynamic parameters like `[messageId]`, `[stageId]`, `[token]`, etc.:

- `/api/chat/messages/[messageId]/reactions`
- `/api/client-approval/[stageId]/aaron-approve`
- `/api/client-approval/[stageId]/client-decision`
- `/api/client-approval/[stageId]/email-preview`
- `/api/client-approval/[stageId]/resend-to-client`
- `/api/client-approval/[stageId]/send-to-client`
- `/api/client-approval/public/[token]`
- And potentially more...

#### Error Pattern

```typescript
error TS1360: Type 'typeof import(...)' does not satisfy the expected type 'RouteHandlerConfig<...>'.
Types of property 'GET' are incompatible.
Property 'messageId' is missing in type 'Promise<{ messageId: string; }>' 
but required in type '{ messageId: string; }'
```

#### Current Workaround

Build errors are temporarily ignored in `next.config.ts`:

```typescript
typescript: {
  ignoreBuildErrors: true, // TODO: Remove after fixing route types
},
```

#### Proper Fix (To Do)

Update route handlers to match Next.js 15's expected types. Example pattern:

```typescript
// Current (causes error)
export async function GET(
  request: Request,
  { params }: { params: { messageId: string } }
) {
  const messageId = params.messageId
  // ...
}

// Fixed (Next.js 15)
export async function GET(
  request: Request,
  context: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await context.params
  // ...
}
```

#### Resources

- [Next.js 15 Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [Next.js 15 Type Safety](https://nextjs.org/docs/app/building-your-application/configuring/typescript)

#### Steps to Fix

1. Identify all routes with dynamic parameters
2. Update parameter destructuring to async pattern
3. Test each route endpoint
4. Enable TypeScript checks in `next.config.ts`
5. Verify build succeeds

**Estimated Effort:** 2-3 hours

---

## 🟢 Resolved Issues

### Root Directory Clutter ✅

**Status:** ✅ Resolved  
**Resolution Date:** November 24, 2025  
**Resolution:** Moved 63 utility scripts to `archive/maintenance-scripts/`

### Test/Debug Routes Exposed ✅

**Status:** ✅ Resolved  
**Resolution Date:** November 24, 2025  
**Resolution:** Archived 30+ test routes to `archive/test-routes/`

### Dual Prisma Schema ✅

**Status:** ✅ Resolved  
**Resolution Date:** November 24, 2025  
**Resolution:** Moved `actual-database-schema.prisma` to archive

---

## 📋 Backlog (Low Priority)

### Multiple FFE Implementations

**Status:** 🔵 Planned (Phase 2)  
**Priority:** Medium  

Multiple versions of the FFE system exist (v1, v2, variants). Needs consolidation.

**Planned Resolution:** Phase 2 - Code Consolidation

### Unused Dependencies

**Status:** 🔵 Planned (Phase 2)  
**Priority:** Medium

Multiple email providers and storage solutions installed but not all used.

**Planned Resolution:** Phase 2 - Dependency cleanup

### Console.log Statements

**Status:** 🔵 Planned (Phase 2)  
**Priority:** Low

Many console.log statements throughout codebase should use proper logger.

**Planned Resolution:** Phase 2 - Create logger utility

---

## 📝 How to Report New Issues

1. Add to this document under appropriate priority
2. Include:
   - Description
   - Affected files/routes
   - Error messages
   - Workaround (if any)
   - Proper fix steps
3. Update status as you work on it

---

**Last Updated:** November 24, 2025

# Fix All Prisma Relation Names

## ✅ **Files Fixed So Far:**
1. `/src/app/api/dashboard/tasks/route.ts` - Changed `room:` → `Room:`
2. `/src/app/api/projects/[id]/route.ts` - Changed all lowercase relations to capitalized

## 🔍 **The Pattern**

Your Prisma schema uses **Capitalized** relation names, but your code is using **lowercase**.

### Common Mistakes:
```typescript
// ❌ WRONG
include: {
  client: true,
  rooms: true,
  stages: true,
  assignedUser: true,
  createdBy: true
}

// ✅ CORRECT
include: {
  Client: true,
  Room: true,
  Stage: true,
  User_Stage_assignedToToUser: true,
  User_Project_createdByIdToUser: true
}
```

## 📋 **Relation Name Reference**

### Project Relations:
- `client:` → `Client:`
- `rooms:` → `Room:`
- `roomSections:` → `RoomSection:`
- `createdBy:` → `User_Project_createdByIdToUser:`
- `updatedBy:` → `User_Project_updatedByIdToUser:`

### Room Relations:
- `project:` → `Project:`
- `section:` → `RoomSection:`
- `stages:` → `Stage:`

### Stage Relations:
- `room:` → `Room:`
- `assignedUser:` → `User_Stage_assignedToToUser:`
- `createdBy:` → `User_Stage_createdByIdToUser:`
- `completedBy:` → `User_Stage_completedByIdToUser:`

### _count Relations (also need Capital):
```typescript
_count: {
  select: {
    rooms: true,    // ❌ Wrong
    assets: true,   // ❌ Wrong
    Room: true,     // ✅ Correct
    Asset: true     // ✅ Correct
  }
}
```

## 🔧 **How to Find Remaining Errors**

1. **Look at browser errors** - Prisma will tell you exactly which field is wrong
2. **Search for patterns:**
   ```bash
   # In VS Code or your editor:
   # Search for: include.*{.*[a-z]
   # This finds lowercase keys in include statements
   ```

3. **Common files to check:**
   - `/src/app/api/**/*.ts` - All API routes
   - `/src/hooks/**/*.ts` - React hooks that query data
   - `/src/lib/**/*.ts` - Library functions

## 🎯 **Quick Fix Strategy**

When you see an error like:
```
Unknown field `client` for select statement on model `Project`. 
Available options are marked with ?: Client?
```

The fix is simple:
1. Find the file mentioned in the error stack trace
2. Change `client:` to `Client:` (match the capitalization shown with `?`)
3. Save and let the dev server reload

## 🚀 **After Fixing All Errors**

Once all relation names are fixed:
1. ✅ No more Prisma errors in console
2. ✅ Projects will show in UI
3. ✅ All queries will work correctly
4. ✅ You can use the app normally

## 💡 **Pro Tip**

The error messages tell you EXACTLY what to use:
```
Unknown field `client` ... Available options are marked with ?: Client?
                                                                ^^^^^^
                                                          Use this name!
```

Just copy the capitalized version from the error message!

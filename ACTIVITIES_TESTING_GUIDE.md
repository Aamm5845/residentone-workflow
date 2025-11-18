# Activities Feature - Testing Guide

## 🎯 What's Been Implemented

### Core Features
- ✅ **Activities Page** (`/activities`) - Auto-refreshes every 30 seconds
- ✅ **Sidebar Link** - "Activities" appears under "Inbox" in the sidebar
- ✅ **Activity Logging** - Key routes now log activities:
  - Asset uploads
  - Project creation
  - Issue creation
  - And more...
- ✅ **Organization-Scoped** - Only shows activities from your organization
- ✅ **Smart Descriptions** - Activities show context like project names, file names, etc.
- ✅ **Pagination** - Load 25 activities at a time
- ✅ **Auto-Refresh** - Updates every 30 seconds automatically

### Activity Types Supported
The system can track 100+ activity types including:
- **Projects**: created, updated, status changed
- **Assets**: uploaded, deleted, tagged, pinned
- **Comments**: created, updated, pinned, liked
- **Issues**: created, updated, assigned, resolved
- **Chat**: messages sent, edited, deleted
- **Design**: sections completed, items added
- **Renderings**: versions created, pushed to client
- **Drawings**: uploaded, checklist completed
- **FFE**: items created, status changed
- **Approvals**: sent to client, received
- **Team**: user created, role changed
- **And many more...**

## 🧪 Testing Steps

### Step 1: Start the Development Server
```bash
npm run dev
```

### Step 2: Create Test Activities
Run this command to populate the feed with test data:

```bash
npx tsx scripts/test-activities.ts
```

This will create sample activities based on your existing data (projects, issues, assets, etc.).

### Step 3: Visit the Activities Page
1. Navigate to your app in the browser
2. Look for the **"Activities"** link in the sidebar (under "Inbox")
3. Click it to go to `/activities`

You should now see:
- ✅ A list of recent activities
- ✅ User avatars with initials
- ✅ Activity icons with colors
- ✅ Smart descriptions like "John Smith uploaded photo.jpg in project Kitchen Remodel"
- ✅ Relative timestamps ("5 minutes ago")
- ✅ "View details" links when available

### Step 4: Test Real-Time Activity Logging
Try these actions and watch them appear in Activities:

#### Test 1: Upload a File
1. Go to any project
2. Upload an image or document
3. Go back to `/activities`
4. You should see: "[Your Name] uploaded [filename]"

#### Test 2: Create an Issue
1. Click "Report Issue" in the dashboard
2. Fill out the form and submit
3. Go back to `/activities`
4. You should see: "[Your Name] created issue '[Issue Title]'"

#### Test 3: Create a Project
1. Click "New Project"
2. Fill out the project details and create it
3. Go back to `/activities`
4. You should see: "[Your Name] created project '[Project Name]'"

### Step 5: Test Auto-Refresh
1. Open `/activities` in your browser
2. In another tab/window, perform an action (upload a file, create an issue, etc.)
3. Wait up to 30 seconds
4. The activities page should automatically update with the new activity

### Step 6: Test Load More
1. If you have more than 25 activities, scroll to the bottom
2. Click "Load More"
3. The next 25 activities should appear

## 🔧 Troubleshooting

### No activities showing?
1. Make sure you've run the test script: `npx tsx scripts/test-activities.ts`
2. Check that you have an organization and user in your database
3. Check the browser console for errors

### Activities not auto-refreshing?
1. Check the browser console for network errors
2. Make sure `/api/activities` endpoint is responding
3. Verify you're logged in with a valid session

### Activity descriptions are generic?
- This means the activity logging didn't include rich context
- For new activity logs, make sure to use the helpers from `src/lib/activity-logger.ts`
- These helpers auto-enrich context with project names, room names, etc.

### "View details" link not working?
- Make sure the `entityUrl` is included when logging the activity
- Example: `entityUrl: \`/projects/\${projectId}\``

## 📝 Adding More Activity Logging

To log activities in other parts of your app, use the helpers:

```typescript
import { logAssetUpload, ActivityActions, getIPAddress } from '@/lib/activity-logger'

// After uploading an asset:
await logAssetUpload(session, {
  assetId: asset.id,
  assetName: file.name,
  projectId: project.id,
  projectName: project.name,
  size: file.size,
  mimeType: file.type,
  entityUrl: `/projects/${project.id}`,
  ipAddress: getIPAddress(request)
})
```

Available helpers:
- `logProjectActivity()` - For project changes
- `logRoomActivity()` - For room changes
- `logStageActivity()` - For stage completions, assignments
- `logAssetUpload()` - For file uploads
- `logAssetActivity()` - For asset deletions, tagging, pinning
- `logCommentActivity()` - For comments
- `logIssueActivity()` - For issues
- `logChatActivity()` - For chat messages
- `logRenderingActivity()` - For rendering activities
- `logDrawingActivity()` - For drawings
- `logFFEActivity()` - For FFE items
- `logApprovalActivity()` - For approvals
- And more in `src/lib/activity-logger.ts`

## 🎨 Customization

### Changing Auto-Refresh Interval
Edit `/activities/page.tsx`:
```typescript
refreshInterval: 30000, // Change from 30 seconds to your preferred interval
```

### Adding Filters
The API already supports filtering by:
- `types` - Activity types (comma-separated)
- `users` - User IDs (comma-separated)
- `entities` - Entity types (comma-separated)
- `startDate` & `endDate` - Date range

You can build a filter UI component if needed.

### Customizing Activity Descriptions
Edit `src/lib/activity-types.ts` in the `formatDescription()` function.

## 📊 Database Schema

Activities are stored in the `ActivityLog` table:
- `id` - Unique identifier
- `actorId` - User who performed the action
- `action` - Activity type (e.g., 'ASSET_UPLOADED')
- `entity` - Entity type (e.g., 'Asset')
- `entityId` - Entity identifier
- `details` - JSON object with rich context
- `orgId` - Organization scope
- `ipAddress` - Optional IP address
- `createdAt` - Timestamp

## 🚀 Next Steps

1. **Add More Logging**: Instrument remaining API routes (see `src/lib/activity-logger.ts` for helpers)
2. **Add Filters**: Build a filter UI component for the Activities page
3. **Export**: Add ability to export activities as CSV
4. **Real-time Updates**: Consider WebSocket integration for instant updates
5. **Activity Details Modal**: Show full activity details in a modal

## ✅ Verification Checklist

- [ ] Activities link appears in sidebar
- [ ] `/activities` page loads without errors
- [ ] Test script creates sample activities
- [ ] Real activities appear after actions (upload, create issue, etc.)
- [ ] Auto-refresh works (wait 30 seconds)
- [ ] Load More button works
- [ ] Activity descriptions are meaningful
- [ ] User avatars display correctly
- [ ] Activity icons show with correct colors
- [ ] "View details" links navigate correctly
- [ ] Activities are scoped to organization only

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Check the server logs
3. Verify database connectivity
4. Ensure Prisma schema is up to date

Happy testing! 🎉

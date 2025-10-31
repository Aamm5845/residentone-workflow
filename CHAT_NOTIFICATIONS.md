# Chat Notification System for Assigned Team Members

## Overview
When team members send messages in phase chat sections, the assigned team member for that phase will be automatically notified based on their notification preferences (Email, SMS, or both).

## Features

### 1. **Asana-Style Notification Toggle**
- Shows below the chat input area
- Displays: `"[Assigned Name] will be notified"` with a blue indicator dot
- Small X button to toggle notification on/off
- Only visible when there's an assigned user who isn't the current sender
- Defaults to "notify" (user must opt-out)

### 2. **Multi-Channel Notifications**
The system respects user preferences set in their profile page:

#### Email Notifications (Default)
- **Always sent** to assigned team members who have an email address
- Professional HTML email template matching your brand
- Includes:
  - Author name and phase name
  - Message preview (truncated if too long)
  - "📎 Image attached" indicator if applicable
  - Direct link to the project
  - Meisner Interiors branding

#### SMS Notifications (Optional)
- **Only sent if** the user has:
  - A valid phone number configured
  - SMS notifications enabled in their settings
- Uses your existing Twilio integration
- SMS format includes:
  - Author name and phase info
  - Message preview (max 100 chars)
  - Stage reference for reply tracking

## User Notification Preferences

Team members can configure their notification preferences on their profile page:

### Settings Location
Navigate to: **Team → [Member] → Phone Number Settings**

### Available Options
1. **Phone Number**: Add/edit phone number with country code
2. **SMS Notifications Toggle**: Enable/disable SMS notifications
3. **Test SMS**: Send a test message to verify setup

### Database Fields
```typescript
User {
  phoneNumber: string?              // Phone with country code (e.g., "+15551234567")
  smsNotificationsEnabled: boolean  // Default: false
  email: string                     // Always required
}
```

## Technical Implementation

### Backend (API)
**File**: `src/app/api/chat/[stageId]/route.ts`

#### GET Endpoint
- Returns chat messages with `assignedUser` information
- Includes: id, name, email, role

#### POST Endpoint
- Accepts `notifyAssignee` boolean parameter (default: true)
- Fetches full user details including notification preferences
- Sends notifications based on preferences:
  - **Email**: Always sent (using Resend)
  - **SMS**: Sent only if enabled (using Twilio)
- Logs notification results to console
- Does not fail request if notifications fail

### Frontend (React)
**File**: `src/components/chat/PhaseChat.tsx`

#### State Management
```typescript
const [assignedUser, setAssignedUser] = useState<AssignedUser | null>(null)
const [notifyAssignee, setNotifyAssignee] = useState(true)
```

#### UI Components
- Notification banner shown above chat input
- Toggle button to enable/disable notification
- Visual indicator (blue dot) when notifications are active
- Sends `notifyAssignee` flag with both text and image messages

### Email Template
**Function**: `generateChatNotificationEmail()`

Professional HTML email with:
- Blue gradient header
- Meisner Interiors logo
- Message preview in styled box
- Call-to-action button
- Footer with contact information

### SMS Integration
**File**: `src/lib/twilio.ts`

Reuses existing `sendMentionSMS()` function for consistency:
- Formats phone numbers with country codes
- Includes stage reference for reply tracking
- Handles Twilio errors gracefully

## Notification Flow

```
User sends message in chat
        ↓
Check if notification enabled
        ↓
Get assigned user for phase
        ↓
Fetch user notification preferences
        ↓
    ┌───┴───┐
    ↓       ↓
  Email    SMS?
(Always)  (If enabled)
    ↓       ↓
  Resend  Twilio
    ↓       ↓
    └───┬───┘
        ↓
   Log results
```

## Environment Variables Required

### Email (Resend)
```bash
RESEND_API_KEY=your_resend_api_key
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

### SMS (Twilio)
```bash
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number
```

## Error Handling

- All notification failures are logged but don't block the chat message
- Email failures: Logged to console, request continues
- SMS failures: Logged to console, email still sent
- Missing assignee: Notification UI not shown
- Invalid phone: SMS skipped, email still sent

## Future Enhancements

Potential improvements:
1. Add in-app notification badge/bell icon
2. Allow users to choose email-only, SMS-only, or both
3. Add "Do Not Disturb" hours for notifications
4. Batch notifications for multiple messages
5. Add notification history/logs for users
6. Allow users to reply to SMS directly to chat

## Testing

### Test Email Notifications
1. Assign yourself to a phase
2. Have another user send a message in that phase
3. Check your email for notification

### Test SMS Notifications
1. Configure phone number in Team Settings
2. Enable SMS notifications
3. Use "Send Test SMS" button to verify
4. Have another user send a chat message
5. Check your phone for SMS

### Test Toggle Functionality
1. Send a message with notification enabled (default)
2. Verify assigned user receives notification
3. Toggle off notification (click X)
4. Send another message
5. Verify no notification received

## Related Files

- `src/app/api/chat/[stageId]/route.ts` - Chat API with notifications
- `src/components/chat/PhaseChat.tsx` - Chat UI component
- `src/lib/twilio.ts` - SMS integration
- `src/lib/email/email-service.ts` - Email integration
- `src/components/team/PhoneNumberSettings.tsx` - User preferences UI
- `prisma/schema.prisma` - User model with notification fields

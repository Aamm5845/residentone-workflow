# Notification Preferences Setup Guide

## Overview

Users can now choose how they want to be notified when someone sends them a message in phases they're assigned to:
- **Email Only** (default)
- **SMS Only** (requires phone number)
- **Both Email & SMS**
- **None** (disable all notifications)

## Database Migration

### Step 1: Run the Migration

```bash
npx prisma migrate dev --name add_email_notifications_enabled
npx prisma generate
```

This adds the `emailNotificationsEnabled` field to the User model with a default value of `true`.

### Step 2: Verify Migration

```bash
npx prisma studio
```

Check that:
- The `emailNotificationsEnabled` column exists in the User table
- Existing users have `emailNotificationsEnabled = true`
- `smsNotificationsEnabled` remains `false` by default

## User Interface

### Where Users Configure Preferences

**Team Member Profile Page**: `/team/[memberId]`

The "Notification Preferences" card shows:
1. **Email Notifications** toggle with icon
2. **SMS Notifications** toggle with icon
3. **Phone Number** input field (required for SMS)
4. **Test SMS** button (when SMS is enabled and phone is saved)
5. **Save/Cancel** buttons when editing

### Permission Model

- **Self-Edit**: Users can edit their own preferences
- **Admin/Owner**: Can edit any team member's preferences
- **Others**: Read-only view (if they can access the page)

## API Endpoints

### GET `/api/users/[userId]/notifications`

Returns user notification preferences.

**Response:**
```json
{
  "success": true,
  "preferences": {
    "emailNotificationsEnabled": true,
    "smsNotificationsEnabled": false,
    "phoneNumber": "+15551234567"
  }
}
```

### PUT `/api/users/[userId]/notifications`

Updates user notification preferences.

**Request Body:**
```json
{
  "emailNotificationsEnabled": true,
  "smsNotificationsEnabled": true,
  "phoneNumber": "+15551234567"
}
```

**Validation:**
- `emailNotificationsEnabled` and `smsNotificationsEnabled` must be booleans
- `phoneNumber` is required if `smsNotificationsEnabled` is `true`
- Returns 400 if validation fails
- Returns 403 if user lacks permission

## Notification Behavior

### Chat Messages

When a user sends a message in a phase chat:

1. **Check if notification is enabled** (toggle in chat UI, defaults to `true`)
2. **Get assigned user** for that phase
3. **Fetch notification preferences** for assigned user
4. **Send notifications based on preferences:**
   - Email: Only if `emailNotificationsEnabled` is `true`
   - SMS: Only if `smsNotificationsEnabled` is `true` AND `phoneNumber` exists

### Logging

The system logs all notification attempts:

```
[Chat Notification] Email sent to John Doe
[Chat Notification] SMS sent to John Doe
[Chat Notification] Email skipped for Jane Smith (disabled by preference)
```

## Testing Checklist

### Functional Tests

- [ ] User can toggle email notifications on/off
- [ ] User can toggle SMS notifications on/off
- [ ] Phone number is required to enable SMS
- [ ] "Test SMS" button works when SMS is enabled
- [ ] Save button persists preferences
- [ ] Cancel button reverts changes
- [ ] Admin can edit other users' preferences
- [ ] Non-admin cannot edit other users' preferences

### Integration Tests

- [ ] Email sent when `emailNotificationsEnabled = true`
- [ ] Email skipped when `emailNotificationsEnabled = false`
- [ ] SMS sent when `smsNotificationsEnabled = true` and phone exists
- [ ] SMS skipped when `smsNotificationsEnabled = false`
- [ ] No notifications sent when chat notify toggle is off

### Edge Cases

- [ ] SMS toggle disabled when no phone number
- [ ] Validation error shown when enabling SMS without phone
- [ ] Existing users default to email enabled
- [ ] New users default to email enabled, SMS disabled

## Environment Variables

Make sure these are configured:

```bash
# Email (Resend)
RESEND_API_KEY=your_resend_key

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=your_twilio_number

# App URL for links in notifications
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

## Deployment Steps

1. **Backup Database** (recommended before any schema changes)
2. **Run Migration** in production
3. **Deploy Updated Code**
4. **Monitor Logs** for notification behavior
5. **Notify Team** about new preference options

## Troubleshooting

### "emailNotificationsEnabled is not defined" Error

- Run `npx prisma generate` to regenerate the Prisma client
- Restart your dev server

### Migration Fails

- Check if the column already exists: `SELECT * FROM "User" LIMIT 1;`
- If it exists, mark migration as resolved: `npx prisma migrate resolve --applied [migration_name]`

### Notifications Not Being Sent

1. Check user preferences in database
2. Check notification logs in console
3. Verify environment variables are set
4. Test email/SMS services independently

### SMS Toggle Won't Enable

- Ensure phone number is entered first
- Check phone number format (should include country code)
- Verify validation logic in NotificationPreferences component

## Future Enhancements

Potential improvements:
- Per-phase notification preferences
- Quiet hours/Do Not Disturb settings
- Digest mode (batch notifications)
- In-app notification center
- Email verification status badge
- Phone verification status badge
- Notification history/audit log

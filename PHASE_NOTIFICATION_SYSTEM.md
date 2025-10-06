# 📧 Phase Notification System

A comprehensive notification system for the ResidentOne 5-phase interior design workflow that automatically sends notifications and emails when phases complete.

## 🌟 Overview

When a phase gets completed, the next phase assigned user gets a notification and also an email that the previous phase was completed. The only exception is when client approval gets completed - both drawing and FFE should get notifications that they can start.

### Key Features

- ✅ **Automatic notifications** when phases complete
- ✅ **Email alerts** to relevant team members  
- ✅ **In-app notifications** for next phase assignees
- ✅ **Optional email confirmation prompts** - allow users to confirm before sending emails
- ✅ **Manual email trigger endpoint** - send phase-ready emails on demand
- ✅ **Special client approval handling** - notifies both DRAWINGS and FFE phases
- ✅ **Professional HTML email templates** 
- ✅ **Error handling** that doesn't break the main workflow
- ✅ **Comprehensive logging** for debugging

## 🏗️ System Architecture

```
Phase Completion Trigger
         ↓
Phase Notification Service
         ↓
    ┌────────────────┬────────────────┐
    ↓                ↓                ↓
Email Service    In-App           Activity 
                Notifications     Logging
```

### Components

1. **PhaseNotificationService** - Main orchestrator for notifications
2. **EmailService** - Handles email sending (configurable provider)
3. **PhaseUtils** - Utilities for phase sequencing and user lookup
4. **API Integration** - Hooks into stage completion endpoint

## 📋 5-Phase Workflow

| Phase | Order | Next Phase(s) | Special Handling |
|-------|-------|---------------|-----------------|
| Design Concept | 1 | 3D Rendering | Regular |
| 3D Rendering | 2 | Client Approval | Regular |
| Client Approval | 3 | **Drawings + FFE** | ⚡ Special Case |
| Drawings | 4 | FFE | Regular |
| FFE | 5 | None (final) | Regular |

### Special Client Approval Case

When `CLIENT_APPROVAL` phase completes:
- **BOTH** `DRAWINGS` and `FFE` assignees receive notifications
- They can start working in parallel
- Each gets personalized emails and in-app notifications

## 🚀 Implementation

### Files Created/Modified

```
src/lib/notifications/
├── phase-notification-service.ts     # Main notification service
├── __tests__/
│   └── phase-notification-service.test.ts  # Test cases
└── test-utilities.js                 # Utility tests

src/lib/email/
└── email-service.ts                  # Email provider abstraction

src/lib/utils/
└── phase-utils.ts                    # Phase sequencing utilities

src/app/api/stages/[id]/
└── route.ts                          # Modified to trigger notifications
```

### API Integration

The notification system is automatically triggered when completing a phase:

```typescript
// PATCH /api/stages/{stageId}
{
  "action": "complete"
}
```

The API endpoint now includes:

```typescript
// Send notifications for phase completion with optional email control
const notificationResult = await phaseNotificationService.handlePhaseCompletion(
  stageId,
  session.user.id,
  session,
  { autoEmail: false } // Optional: set to false to skip automatic emails
)

// Return next phase info for UI confirmation prompts
if (action === 'complete' && !notificationResult.autoEmail) {
  return NextResponse.json({
    message: 'Stage completed successfully',
    stage: updatedStage,
    nextPhaseInfo: notificationResult.nextPhaseInfo // For UI email prompt
  })
}
```

## 🎛️ Optional Email Confirmation

### Email Confirmation Prompts

Starting with the enhanced notification system, you can now control when phase-ready emails are sent:

#### Automatic Mode (Default)
```typescript
// Emails sent immediately upon phase completion
phaseNotificationService.handlePhaseCompletion(stageId, userId, session, { autoEmail: true })
```

#### Manual Confirmation Mode
```typescript
// Emails held back, UI shows confirmation prompt
phaseNotificationService.handlePhaseCompletion(stageId, userId, session, { autoEmail: false })
```

### Manual Email Trigger

Send phase-ready emails on demand:

```typescript
// POST /api/notifications/phase-email
{
  "stageId": "stage_123"
}
```

### UI Integration

The `SendPhaseEmailPrompt` modal component provides:
- Next phase preview with assignee information
- Email subject/preview snippets
- Individual email selection (multiple assignees)
- Send confirmation with success feedback

## 📧 Email Templates

### Phase Completion Email
- **Recipients**: All team members
- **Subject**: `✅ {Phase Name} Phase Completed - {Project Name}`
- **Content**: Project details, completed by, completion date
- **CTA**: Link to view project details

### Phase Ready Email  
- **Recipients**: Next phase assignee(s)
- **Subject**: `🚀 {Phase Name} Phase Ready to Start - {Project Name}`
- **Content**: Personalized message, previous phase completion, next steps
- **CTA**: Link to start working on phase

## 🔔 In-App Notifications

- **Type**: `PHASE_READY_TO_START`
- **Title**: `{Phase Name} Phase Ready`
- **Message**: Detailed context about completion and next steps
- **Related**: Links to the specific stage/workspace

## 🧪 Testing

### Utility Tests (No Database Required)

```bash
node src/lib/notifications/test-utilities.js
```

**Results:**
```
🚀 Running Phase Notification Utility Tests
============================================================
✅ Phase sequence logic working correctly
✅ Client approval special case handled properly  
✅ Transition summaries generated correctly
✅ All test scenarios passed
```

### Integration Tests (Database Required)

1. **Setup Test Environment**
   ```typescript
   // Create test project with room
   // Assign different users to each phase
   // Ensure users have valid email addresses
   ```

2. **Test Regular Phase Completion**
   ```bash
   # Complete DESIGN_CONCEPT phase
   PATCH /api/stages/{stageId} 
   { "action": "complete" }
   
   # Verify THREE_D assignee receives notification
   # Check console logs for processing details
   ```

3. **Test Client Approval Special Case**
   ```bash
   # Complete CLIENT_APPROVAL phase
   PATCH /api/stages/{stageId}
   { "action": "complete" }
   
   # Verify BOTH DRAWINGS and FFE assignees receive notifications
   # Check email templates render correctly
   ```

## ⚙️ Configuration

### Email Provider Setup

Replace the mock email service with your provider:

```typescript
// src/lib/email/email-service.ts

// Example with SendGrid
import sgMail from '@sendgrid/mail'
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

export async function sendEmail(emailData: EmailData): Promise<EmailResult> {
  const response = await sgMail.send({
    to: emailData.to,
    from: process.env.FROM_EMAIL,
    subject: emailData.subject,
    html: emailData.html,
    text: emailData.text
  })
  
  return {
    success: true,
    messageId: response[0].headers['x-message-id']
  }
}
```

### Environment Variables

```bash
# Email Configuration
FROM_EMAIL=noreply@yourcompany.com
FROM_NAME=ResidentOne Workflow
REPLY_TO_EMAIL=support@yourcompany.com

# Provider-specific (example)
SENDGRID_API_KEY=your_sendgrid_api_key
# or
RESEND_API_KEY=your_resend_api_key
# or
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1

# App URL for email links
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## 🔧 Usage Examples

### Automatic (Recommended)

Notifications are sent automatically when phases complete via the API:

```typescript
// Complete a phase - notifications sent automatically
const response = await fetch(`/api/stages/${stageId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'complete' })
})
```

### Manual (Advanced)

For custom scenarios, call the service directly:

```typescript
import { phaseNotificationService } from '@/lib/notifications/phase-notification-service'

const result = await phaseNotificationService.handlePhaseCompletion(
  stageId,
  completedByUserId,
  session
)

console.log(`Sent ${result.notificationsSent} notifications and ${result.emailsSent} emails`)
```

## 🐛 Troubleshooting

### Common Issues

1. **No notifications sent**
   - Check if phases have assigned users
   - Verify users have valid email addresses
   - Check console logs for errors

2. **Email delivery fails**
   - Verify email provider configuration
   - Check API keys and environment variables
   - Test email provider connectivity

3. **Special client approval case not working**
   - Verify stage type is exactly `CLIENT_APPROVAL`
   - Check if DRAWINGS and FFE stages exist
   - Confirm these stages have assigned users

### Debugging

Enable detailed logging:

```typescript
// The service logs extensively to console
// Check your application logs for:
console.log('Phase completion notifications processed:', {
  stageId,
  stageType: completedStage.type,
  notificationsSent: result.notificationsSent,
  emailsSent: result.emailsSent
})
```

### Database Verification

```sql
-- Check notifications were created
SELECT * FROM notifications 
WHERE type = 'PHASE_READY_TO_START' 
ORDER BY createdAt DESC;

-- Check activity logs
SELECT * FROM activityLogs 
WHERE action = 'STAGE_COMPLETED' 
ORDER BY createdAt DESC;
```

## 🚀 Future Enhancements

- [ ] **Push notifications** for mobile apps
- [ ] **Slack/Teams integration** for team channels
- [ ] **SMS notifications** for urgent phases
- [ ] **Custom email templates** per organization
- [ ] **Notification preferences** per user
- [ ] **Digest emails** for daily/weekly summaries
- [ ] **Webhook support** for external integrations

## 📊 Monitoring

Track notification performance:

```typescript
// Metrics to monitor
- Notification delivery success rate
- Email open rates
- Time from phase completion to next phase start
- User engagement with notifications
- Error rates and failure reasons
```

---

## 📞 Support

For questions or issues with the notification system:

1. Check the test utilities and documentation
2. Review console logs for error messages
3. Verify database schema and relationships
4. Test with mock data first, then real data
5. Consider email provider limitations and quotas

The system is designed to be robust and fail gracefully - the main workflow will continue even if notifications fail, but errors are logged for investigation.

**Happy notifying! 🎉**
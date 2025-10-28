# SMS Notifications Setup Guide

This guide will help you set up SMS notifications for chat mentions using Twilio.

## Overview

When someone gets mentioned in a phase chat, they will:
1. Receive an SMS notification on their registered phone number
2. Can reply via SMS, and their reply will appear in the chat
3. See the notification in their inbox as well

## Prerequisites

- A Twilio account ([Sign up here](https://www.twilio.com/try-twilio))
- A Twilio phone number capable of sending/receiving SMS
- Your application deployed on Vercel (or any public URL)

## Step 1: Get Twilio Credentials

1. **Sign up for Twilio**: Visit [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. **Get your credentials** from the Twilio Console:
   - **Account SID**: Found on your dashboard (starts with "AC")
   - **Auth Token**: Click the "eye" icon to reveal it on your dashboard
3. **Buy a phone number**:
   - Go to Phone Numbers → Buy a Number
   - Choose a number that supports SMS
   - Note this number (format: +1XXXXXXXXXX)

## Step 2: Configure Environment Variables

Add the following to your `.env.local` file (or Vercel environment variables):

```bash
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID="your-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_PHONE_NUMBER="+1XXXXXXXXXX"
```

### For Vercel Deployment:

1. Go to your Vercel project settings
2. Navigate to **Settings → Environment Variables**
3. Add each variable:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
4. Make sure they're available for all environments (Production, Preview, Development)

## Step 3: Set Up Twilio Webhooks

Twilio needs to know where to send incoming SMS messages. You'll configure two webhooks:

### A. SMS Webhook (for receiving replies)

1. Go to your Twilio Console → Phone Numbers → Manage → Active Numbers
2. Click on your phone number
3. Scroll down to **Messaging Configuration**
4. Under **A MESSAGE COMES IN**, configure:
   - **Webhook**: `https://app.meisnerinteriors.com/api/sms/webhook`
   - **HTTP Method**: `POST`
5. Click **Save**

### B. Status Callback (optional, for delivery tracking)

This is automatically configured in the code. No additional setup needed.

## Step 4: Install Twilio Package

The Twilio Node.js SDK needs to be installed:

```bash
npm install twilio
```

Or if using yarn:

```bash
yarn add twilio
```

## Step 5: Run Database Migration

The user schema has been updated to include phone numbers. Run the migration:

```bash
npx prisma migrate dev --name add_user_phone_number
```

Or generate the Prisma client if you've already migrated:

```bash
npx prisma generate
```

## Step 6: Configure Phone Numbers for Team Members

1. Navigate to the **Team** page in your application
2. Click on a team member
3. In the **SMS Notifications** section:
   - Enter the phone number (US/Canada format: 10 digits)
   - Toggle **Enable SMS Notifications** to ON
   - Click **Save**

## Testing the Feature

### Test Sending SMS:

1. Go to any phase/stage chat
2. Mention a user who has SMS notifications enabled: `@username Hello!`
3. The user should receive an SMS on their registered phone number

### Test Receiving SMS Replies:

1. After receiving an SMS notification, reply to the message
2. Your reply should appear in the chat with a "📱 [SMS Reply]" prefix

## Troubleshooting

### SMS not being sent?

1. **Check Twilio credentials**: Verify they're correct in environment variables
2. **Check console logs**: Look for errors in your application logs
3. **Verify phone number**: Make sure it's in the correct format (10 digits for US/Canada)
4. **Check Twilio balance**: Trial accounts have limited credits

### SMS replies not appearing in chat?

1. **Verify webhook URL**: Make sure it's publicly accessible
2. **Check webhook configuration**: Ensure it's set to POST method
3. **Test webhook**: Use Twilio's webhook debugger to see if requests are reaching your endpoint
4. **Check user's phone number**: It must match exactly (including country code)

### Common Error Messages:

- `"Twilio not configured"`: Environment variables are missing or incorrect
- `"Invalid phone number format"`: Phone number must be 10 digits (US/Canada)
- `"User not found for phone number"`: The SMS sender's number isn't registered in the system

## Security Notes

1. **Webhook validation**: All incoming webhooks are validated using Twilio signatures
2. **Auth Token**: Keep your `TWILIO_AUTH_TOKEN` secret - never commit it to version control
3. **Phone numbers**: Store phone numbers securely in the database
4. **Rate limiting**: Consider implementing rate limiting for SMS endpoints

## Cost Considerations

- Twilio charges per SMS sent/received
- Trial accounts get $15.50 in free credits
- SMS costs vary by country (US/Canada: ~$0.0079 per SMS)
- Monitor your Twilio usage dashboard regularly

## Architecture Overview

```
User mentions someone → 
  ├─ In-app notification created
  ├─ SMS sent via Twilio (if enabled)
  └─ SMS delivery status tracked

User replies via SMS →
  ├─ Twilio webhook receives message
  ├─ Validates request signature
  ├─ Finds user by phone number
  ├─ Posts message to chat
  └─ Sends confirmation SMS
```

## File Structure

```
src/
├── lib/
│   └── twilio.ts                          # Twilio utility functions
├── app/
│   └── api/
│       ├── chat/[stageId]/route.ts        # Sends SMS on mention
│       ├── sms/
│       │   ├── webhook/route.ts           # Receives SMS replies
│       │   └── status/route.ts            # Delivery status tracking
│       └── users/[userId]/phone/route.ts  # Update phone settings
└── components/
    └── team/
        └── PhoneNumberSettings.tsx        # Phone number UI component
```

## Support

For issues specific to:
- **Twilio**: Check [Twilio Support](https://support.twilio.com)
- **Application**: Check application logs and console errors
- **Webhook issues**: Use Twilio's webhook debugger in the console

## Next Steps

After setup:
1. Test with a small group of users first
2. Monitor SMS delivery rates
3. Gather user feedback
4. Consider adding SMS notifications for other events
5. Implement SMS opt-out functionality if needed

# Email Setup Guide

The client approval workflow includes email functionality with **Mailgun for production** and fallback options for development. Here are the configuration options:

## Production: Mailgun (Recommended)

Mailgun is a reliable email service for production applications.

### Setup:
1. Sign up at https://www.mailgun.com/
2. Add and verify your domain
3. Get your API key from Settings → API Keys
4. Configure DNS records for your domain

### Environment Variables (.env.local):
```
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=yourdomain.com
MAILGUN_URL=https://api.mailgun.net
EMAIL_FROM=ResidentOne <noreply@yourdomain.com>
```

### DNS Records for Domain Verification:
Add these DNS records to your domain:
- **TXT Record**: `v=spf1 include:mailgun.org ~all`
- **CNAME**: `email.yourdomain.com` → `mailgun.org` 
- **MX Records**: As provided by Mailgun dashboard

## Development Options

### Option 1: MailHog (Recommended for Development)

MailHog is a local SMTP server that captures emails for testing.

### Installation:
```bash
# Windows (using Chocolatey)
choco install mailhog

# Or download from: https://github.com/mailhog/MailHog/releases
```

### Usage:
1. Start MailHog: `mailhog`
2. Access web interface: http://localhost:8025
3. Emails will be captured and displayed in the web interface

### Environment Variables (.env.local):
```
EMAIL_HOST=localhost
EMAIL_PORT=1025
# No EMAIL_USER or EMAIL_PASSWORD needed for MailHog
```

## Option 2: Mailtrap

Mailtrap is a hosted email testing service.

### Setup:
1. Sign up at https://mailtrap.io
2. Create a new inbox
3. Get SMTP credentials

### Environment Variables (.env.local):
```
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=587
EMAIL_USER=your-mailtrap-username
EMAIL_PASSWORD=your-mailtrap-password
```

## Option 3: Gmail with App Password

Use a real Gmail account for testing.

### Setup:
1. Enable 2-factor authentication on your Gmail
2. Generate an App Password: https://support.google.com/accounts/answer/185833
3. Use the App Password (not your regular password)

### Environment Variables (.env.local):
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-character-app-password
EMAIL_FROM=Your Name <your-email@gmail.com>
```

## Testing the Workflow

1. Upload renderings in the 3D Rendering stage
2. Navigate to the Client Approval stage
3. Approve renderings as Aaron
4. Send to client using the "Send to Client" button
5. Check your email testing tool for the sent email
6. Click the approval link in the email to test client decision flow

## Current Configuration

The system automatically detects the email service to use:

1. **Mailgun** (if `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` are set)
2. **SMTP Fallback** (nodemailer with configured host)
3. **Development Default** (MailHog at `localhost:1025`)

## Email Service Priority

The system tries email services in this order:
1. **Mailgun** → Fast, reliable, production-ready
2. **SMTP** → Fallback for custom email providers
3. **Fails** → Returns error if both fail

## Vercel Deployment

For production deployment on Vercel:
1. Set Mailgun environment variables in Vercel dashboard
2. Verify your domain with Mailgun
3. Test with real email addresses
4. Monitor email delivery in Mailgun dashboard

See `VERCEL_DEPLOYMENT.md` for complete deployment instructions.

# Resend Email Configuration for ResidentOne

The current system is configured to use **Resend** for email delivery. Here's how to properly set it up:

## Resend Setup

### 1. Get Resend API Key
1. Go to https://resend.com
2. Sign up or log in
3. Go to API Keys section
4. Create a new API key
5. Copy the API key (starts with `re_`)

### 2. Configure Domain (Optional but Recommended)
1. In Resend dashboard, go to Domains
2. Add your domain (e.g., `yourdomain.com`)
3. Add the required DNS records to verify your domain
4. This allows you to send from `noreply@yourdomain.com` instead of the default Resend domain

### 3. Environment Variables

#### For Local Development (.env.local):
```env
RESEND_API_KEY=re_your_resend_api_key_here
EMAIL_FROM=noreply@yourdomain.com
# or for testing with unverified domain:
# EMAIL_FROM=noreply@resend.dev
```

#### For Vercel Deployment:
In your Vercel project settings → Environment Variables, add:
- `RESEND_API_KEY` = `re_your_resend_api_key_here`
- `EMAIL_FROM` = `noreply@yourdomain.com`

### 4. Testing the Configuration

#### Test Email API Route:
```bash
# Test the email configuration
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json"
```

This will test:
- ✅ Environment variables are set correctly
- ✅ Resend API key is valid
- ✅ Email sending works
- ✅ No validation errors occur

## Common Issues and Solutions

### Issue: "validation_error: Invalid literal value, expected \"\""
**Cause**: Empty string being passed to Resend API
**Solution**: 
- Ensure `EMAIL_FROM` is set and not empty
- Check that client data (name, email, project name) is not empty

### Issue: "RESEND_API_KEY not configured"
**Solution**: Add the API key to your environment variables

### Issue: "Failed to send email via Resend"
**Solutions**:
- Verify your Resend API key is correct
- Check that the sender email domain is verified (or use `noreply@resend.dev` for testing)
- Ensure recipient email is valid

## Fallback Configuration

If no `EMAIL_FROM` is configured, the system will use:
1. `process.env.EMAIL_FROM`
2. `process.env.RESEND_FROM_EMAIL` 
3. `noreply@resend.dev` (default)

## Client Approval Email Flow

1. **Upload Renderings**: 3D renderings are uploaded to the system
2. **Aaron Approval**: Internal approval of renderings
3. **Send to Client**: Beautiful HTML email sent via Resend
4. **Tracking**: Email opens and clicks are tracked
5. **Client Response**: Client can view and download renderings

## Current Template Features

- ✨ Professional Meisner Interiors branding
- 📱 Mobile-responsive design
- 🎨 Beautiful rendering showcase
- 📊 Email analytics and tracking
- 🔗 Direct download links for high-res images

## Support

If you encounter issues:
1. Check the Vercel function logs
2. Use the test email API to debug
3. Verify your Resend dashboard for delivery status
4. Check that all environment variables are set correctly
# Vercel Deployment Guide

This guide covers deploying the ResidentOne Workflow app to Vercel with Mailgun email integration.

## Required Environment Variables

Add these to your Vercel project settings under "Environment Variables":

### Database
```
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
```

### Authentication (NextAuth.js)
```
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your-nextauth-secret-key-generate-a-long-random-string
JWT_SECRET=your-jwt-secret-for-client-approval-tokens
```

### Mailgun (Production Email)
```
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-mailgun-domain.com
MAILGUN_URL=https://api.mailgun.net
EMAIL_FROM=ResidentOne <noreply@your-mailgun-domain.com>
```

### Optional SMTP Fallback
```
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USER=your-smtp-username
EMAIL_PASSWORD=your-smtp-password
```

### File Storage (Optional - Dropbox)
```
DROPBOX_ACCESS_TOKEN=your-dropbox-access-token
DROPBOX_APP_KEY=your-dropbox-app-key
DROPBOX_APP_SECRET=your-dropbox-app-secret
```

## Mailgun Setup

1. **Sign up for Mailgun**: https://www.mailgun.com/
2. **Add your domain** in the Mailgun dashboard
3. **Verify your domain** by adding DNS records
4. **Get your API key** from Settings → API Keys
5. **Set your sending domain** (e.g., `mg.yourdomain.com`)

### DNS Records for Mailgun
Add these DNS records to your domain:
- **TXT Record**: `v=spf1 include:mailgun.org ~all`
- **CNAME Record**: `email.yourdomain.com` → `mailgun.org`
- **MX Records**: As provided by Mailgun

## Deployment Steps

1. **Connect your repository** to Vercel
2. **Add environment variables** in project settings
3. **Deploy** - Vercel will automatically build and deploy
4. **Run database migrations** if needed:
   ```bash
   vercel env pull .env.local
   npx prisma db push
   ```

## Database Considerations

### PostgreSQL on Vercel
- Use **Vercel Postgres** or **Supabase** for managed PostgreSQL
- Ensure `sslmode=require` in your connection string
- Connection pooling is recommended for serverless functions

### Connection Pool Settings
Add to your DATABASE_URL:
```
?sslmode=require&connection_limit=5&pool_timeout=0
```

## Email Testing on Vercel

### Test Email Configuration
1. Check logs: `vercel logs your-app-url`
2. Use Mailgun's logs to track email delivery
3. Test with real email addresses initially

### Mailgun Sandbox vs Production
- **Sandbox domain**: Free testing with limited recipients
- **Production domain**: Requires domain verification for unlimited sending

## Performance Optimization

### Edge Functions
The app is configured for Vercel Edge Runtime where possible.

### Static Assets
- Images are automatically optimized by Vercel
- Use Vercel's Image Optimization for user uploads

## Monitoring

### Vercel Analytics
Enable Vercel Analytics for performance monitoring.

### Error Tracking
Consider adding Sentry for error tracking:
```bash
npm install @sentry/nextjs
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify DATABASE_URL format
   - Check connection limits
   - Ensure SSL is enabled

2. **Email Not Sending**
   - Check Mailgun API key and domain
   - Verify DNS records
   - Check Vercel function logs

3. **Authentication Issues**
   - Verify NEXTAUTH_URL matches your domain
   - Generate new NEXTAUTH_SECRET if needed
   - Check JWT_SECRET is set

4. **File Upload Issues**
   - Local storage works in development only
   - Configure Dropbox or other cloud storage for production

### Debugging Commands
```bash
# Pull environment variables locally
vercel env pull .env.local

# View deployment logs
vercel logs

# Check database connection
npx prisma db push --preview-feature
```

## Security Checklist

- [ ] All secrets use environment variables
- [ ] DATABASE_URL uses SSL connection
- [ ] NEXTAUTH_SECRET is cryptographically secure
- [ ] Mailgun API key is kept secret
- [ ] Domain is verified in Mailgun
- [ ] CORS is properly configured
- [ ] Rate limiting is implemented

## Production Checklist

- [ ] Environment variables configured
- [ ] Database is set up and migrated
- [ ] Mailgun domain verified
- [ ] DNS records configured
- [ ] Test email sending works
- [ ] Authentication flow tested
- [ ] File uploads working (cloud storage)
- [ ] All API endpoints responding
- [ ] Error monitoring configured
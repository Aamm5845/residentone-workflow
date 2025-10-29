# Vercel Environment Variables for Production

## 🚀 Required Dropbox Environment Variables

Add these to your Vercel project settings at: https://vercel.com/your-team/residentone-workflow/settings/environment-variables

### Dropbox Authentication
```
DROPBOX_REFRESH_TOKEN=<your-refresh-token-from-oauth>
DROPBOX_APP_KEY=<your-app-key>
DROPBOX_APP_SECRET=<your-app-secret>
```

### Dropbox Team Configuration
```
DROPBOX_TEAM_ID=<your-team-id>
DROPBOX_ROOT_NAMESPACE_ID=<your-root-namespace-id>
DROPBOX_API_SELECT_USER=<default-member-id>
```

### Dropbox Team Members (Single Line JSON)
```
DROPBOX_TEAM_MEMBERS=[{"name":"Team Admin","email":"admin@company.com","memberId":"dbmid:AAAA...","role":"team_admin"},{"name":"Member 1","email":"member1@company.com","memberId":"dbmid:BBBB...","role":"member_only"}]
```

## 📝 How to Add to Vercel

### Option 1: Via Vercel Dashboard (Recommended)

1. Go to: https://vercel.com
2. Navigate to your project
3. Go to **Settings** → **Environment Variables**
4. For each variable above:
   - Click **Add New**
   - Enter the **Name** 
   - Enter the **Value** (from your Dropbox app settings)
   - Select environments: **Production**, **Preview**, and **Development**
   - Click **Save**

### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Login to Vercel
vercel login

# Link to your project
vercel link

# Add environment variables
vercel env add DROPBOX_REFRESH_TOKEN production
vercel env add DROPBOX_APP_KEY production
vercel env add DROPBOX_APP_SECRET production
vercel env add DROPBOX_TEAM_ID production
vercel env add DROPBOX_ROOT_NAMESPACE_ID production
vercel env add DROPBOX_API_SELECT_USER production
vercel env add DROPBOX_TEAM_MEMBERS production
```

## ✅ Verification

After adding the environment variables and deploying:

1. Visit: `https://your-app.vercel.app/api/dropbox/test-team`
2. You should see all team members successfully connected

## 🔄 Redeployment Required

After adding environment variables, trigger a new deployment:

```bash
vercel --prod
# Or via dashboard: Deployments → Redeploy
```

## 🔐 Security Notes

- ✅ Never commit actual tokens to Git
- ✅ Refresh token auto-renews access tokens
- ✅ All values are encrypted by Vercel
- ⚠️ Rotate tokens if they're ever exposed

## 📊 Environment Variables Summary

| Variable Name | Description | Required |
|---------------|-------------|----------|
| DROPBOX_REFRESH_TOKEN | OAuth refresh token | ✅ Yes |
| DROPBOX_APP_KEY | Dropbox app key | ✅ Yes |
| DROPBOX_APP_SECRET | Dropbox app secret | ✅ Yes |
| DROPBOX_TEAM_ID | Team ID from Dropbox | ✅ Yes |
| DROPBOX_ROOT_NAMESPACE_ID | Root namespace ID | ✅ Yes |
| DROPBOX_API_SELECT_USER | Default member ID | ✅ Yes |
| DROPBOX_TEAM_MEMBERS | JSON array of team members | ✅ Yes |

## 🆘 Troubleshooting

### Issue: Test endpoint returns 401 errors

**Solution**: 
- Check that refresh token is correctly set
- Verify app key and secret match your Dropbox app

### Issue: Changes not reflected

**Solution**:
- Trigger a new deployment after adding environment variables
- Environment variables only apply to new deployments

## 📞 Getting Your Tokens

1. **Refresh Token**: Get from Dropbox OAuth flow or app console
2. **App Key/Secret**: From Dropbox App Console → Settings
3. **Team ID**: From Dropbox Business admin or API
4. **Namespace ID**: From team folder API or admin console
5. **Member IDs**: From team member management API

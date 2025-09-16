# 🚀 Dropbox Integration Setup Guide

This guide will help you set up Dropbox cloud storage for your interior design application.

## 📋 Prerequisites

- A Dropbox account (personal or business)
- Node.js and npm installed
- Access to your application's environment variables

## 🔧 Step-by-Step Setup

### 1. Create a Dropbox App

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Click **"Create app"**
3. Choose **"Scoped access"** (recommended)
4. Choose **"App folder"** or **"Full Dropbox"** based on your needs:
   - **App folder**: Files stored in `/Apps/YourAppName/` (more secure)
   - **Full Dropbox**: Access to entire Dropbox (more flexible)
5. Name your app (e.g., "Interior Design Files", "ResidentOne Storage")
6. Click **"Create app"**

### 2. Configure App Permissions

In your app settings, go to the **Permissions** tab and enable:

- ✅ `files.metadata.write`
- ✅ `files.metadata.read`  
- ✅ `files.content.write`
- ✅ `files.content.read`
- ✅ `sharing.write`
- ✅ `sharing.read`

Click **"Submit"** to save changes.

### 3. Generate Access Token

1. In the **Settings** tab, scroll to **"OAuth 2"**
2. Under **"Generated access token"**, click **"Generate"**
3. Copy the access token (starts with `sl.` or similar)
4. ⚠️ **Keep this token secure** - it provides full access to your Dropbox

### 4. Get App Credentials

From the **Settings** tab, copy:
- **App key**
- **App secret**

### 5. Configure Environment Variables

Create or update your `.env` file:

```env
# Dropbox Configuration
DROPBOX_ACCESS_TOKEN="sl.your-very-long-access-token-here"
DROPBOX_APP_KEY="your-app-key-here"
DROPBOX_APP_SECRET="your-app-secret-here"
```

### 6. Test Your Configuration

Run the test script to verify everything works:

```bash
node test-dropbox.js
```

You should see:
```
🧪 Testing Dropbox Integration...

📋 Configuration Status: ✅ Configured
✅ Dropbox storage initialized successfully

🔍 Testing account connection...
👤 Account: Your Name
📧 Email: your.email@example.com
💾 Storage: 2.5 GB used of 2000 GB

📁 Testing project structure creation...
✅ Created project structure for: test-project-1726496234567

📂 Testing file listing...
📊 Found 1 items in /interior-design directory

🎉 All Dropbox tests passed! Your integration is working correctly.
```

## 📁 File Organization

Your files will be automatically organized in Dropbox as:

```
/interior-design/
├── project-123/
│   ├── rooms/
│   │   ├── living-room/
│   │   │   └── sections/
│   │   │       └── inspiration/
│   │   └── bedroom/
│   ├── inspiration/
│   ├── documents/
│   └── presentations/
└── project-456/
    └── ...
```

## 🔒 Security Best Practices

1. **Rotate Access Tokens**: Generate new tokens periodically
2. **Use App Folders**: Limit access to your app's folder only
3. **Environment Variables**: Never commit tokens to version control
4. **Business Accounts**: Use Dropbox Business for team features
5. **Monitor Usage**: Set up alerts for storage quotas

## 🚀 Production Deployment

For production environments:

1. **Use Dropbox Business**: Better security and team management
2. **Set up Team Folders**: Organize by clients or projects
3. **Configure Webhooks**: Get notified of file changes
4. **Enable Version History**: Track file modifications
5. **Set up Backup**: Regular backups of critical files

## 📊 Storage Limits

| Plan | Storage | File Upload Limit |
|------|---------|------------------|
| Basic | 2 GB | 50 MB |
| Plus | 2 TB | 50 MB |
| Family | 2 TB | 50 MB |
| Professional | 3 TB | 100 GB |
| Business | 5 TB+ | 100 GB |

## 🔧 Troubleshooting

### Common Issues:

**❌ "Invalid access token"**
- Regenerate your access token
- Check for extra spaces in `.env` file
- Ensure token hasn't expired

**❌ "Permission denied"**
- Check app permissions in Dropbox console
- Resubmit permissions after changes
- Use correct scope (App folder vs Full Dropbox)

**❌ "Network error"**
- Check internet connection
- Verify Dropbox API status
- Check firewall settings

**❌ "File upload fails"**
- Check file size limits
- Verify available storage space
- Ensure file type is allowed

## 📞 Support

- [Dropbox Developer Documentation](https://www.dropbox.com/developers/documentation)
- [Dropbox API Status](https://status.dropbox.com/)
- [Community Forum](https://www.dropboxforum.com/developers)

## 🎯 Next Steps

After setup:

1. Test file uploads through your application UI
2. Verify files appear in your Dropbox
3. Check file sharing and download links work
4. Set up monitoring and alerts
5. Configure backup strategies

---

✅ **Setup Complete!** Your interior design application now uses Dropbox for secure, scalable file storage.
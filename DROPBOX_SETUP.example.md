# Dropbox Team Integration Setup

## Overview
This guide explains how to set up Dropbox Team integration with proper member access control.

## Prerequisites

1. Dropbox Business account
2. Dropbox app created in App Console
3. OAuth tokens generated
4. Team member IDs from Dropbox admin

## Local Development Setup

### 1. Copy Environment Template
```bash
cp .env.local.template .env.local
```

### 2. Configure Environment Variables

Edit `.env.local` and add your Dropbox credentials:

```env
# Dropbox Authentication
DROPBOX_REFRESH_TOKEN=<your-refresh-token>
DROPBOX_APP_KEY=<your-app-key>
DROPBOX_APP_SECRET=<your-app-secret>

# Team Configuration
DROPBOX_TEAM_ID=<your-team-id>
DROPBOX_ROOT_NAMESPACE_ID=<your-namespace-id>
DROPBOX_API_SELECT_USER=<default-member-id>

# Team Members (JSON array)
DROPBOX_TEAM_MEMBERS='[{"name":"Admin","email":"admin@company.com","memberId":"dbmid:AAAA","role":"team_admin"}]'
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Test Configuration
Visit: `http://localhost:3000/api/dropbox/test-team`

## Production Deployment (Vercel)

See `VERCEL_ENV_SETUP.example.md` for detailed Vercel configuration instructions.

## Team Member Configuration

Each team member needs:
- `name`: Display name
- `email`: Email address
- `memberId`: Dropbox member ID (format: `dbmid:XXXXXXXXX`)
- `role`: Either `team_admin` or `member_only`

### Role Differences

**team_admin**:
- Can access team root namespace
- Can see team folders
- Uses `pathRoot` configuration

**member_only**:
- Accesses personal Dropbox space
- Cannot access team root directly
- No `pathRoot` applied

## Service Usage

```typescript
import { dropboxService } from '@/lib/dropbox-service-v2'

// Get team members
const members = dropboxService.getTeamMembers()

// List files for specific member
const member = dropboxService.getTeamMemberByEmail('user@company.com')
const files = await dropboxService.listFolder('/Projects', member?.memberId)

// Download file
const buffer = await dropboxService.downloadFile('/path/file.dwg', memberId)
```

## Security

- ⚠️ Never commit `.env.local` to git
- ⚠️ Never commit files containing actual tokens
- ✅ Use `.env.local.template` as template only
- ✅ Store actual credentials in Vercel dashboard
- ✅ Rotate tokens regularly

## Troubleshooting

### 401 Unauthorized
- Check refresh token is valid
- Verify app key/secret are correct

### 422 Unprocessable Entity  
- Check member role configuration
- Verify namespace ID for team_admin users

### Member not found
- Check DROPBOX_TEAM_MEMBERS JSON is valid
- Verify member IDs are correct

## Documentation Files

- `VERCEL_ENV_SETUP.example.md` - Vercel deployment guide
- `DROPBOX_SETUP.example.md` - This file
- `.env.local.template` - Environment template

**Note**: The `.example` and `.template` files are safe to commit. Never commit files with actual credentials.

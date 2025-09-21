# 🛡️ Production Backup System for Vercel

This system provides **production database backups** that work on Vercel and protect your live ResidentOne data.

## 🚀 How It Works

### **For Production (Vercel):**
- ✅ **API Endpoints** - Create backups via web interface
- ✅ **Download Backups** - JSON files with all your data
- ✅ **Restore Capability** - Upload backup files to restore data
- ✅ **Admin Protection** - Only OWNER/ADMIN can access

### **For Development (Local):**
- ✅ **Local Backup Scripts** - Use the scripts I created earlier
- ✅ **Quick Backups** - `npm run backup:simple` before changes

## 📋 Quick Access

### **Production Backup URL:**
```
https://your-site.vercel.app/api/admin/backup
```

### **Admin UI Location:**
Add the `ProductionBackup` component to your admin/settings page.

## 🔧 Setup Instructions

### 1. **Deploy to Vercel**
Your new API endpoints will automatically work on Vercel:
- `/api/admin/backup` - Create/download backups
- `/api/admin/restore` - Restore from backup files

### 2. **Add to Admin Interface**
Import and use the backup component:

```typescript
import ProductionBackup from '@/components/admin/ProductionBackup'

// In your admin/settings page:
<ProductionBackup />
```

### 3. **Access Requirements**
- **For Backups:** OWNER or ADMIN role required
- **For Restore:** Only OWNER role (more restrictive)

## 💾 Using the Backup System

### **Create Production Backup:**

1. **Via Web Interface:**
   - Go to admin settings in your app
   - Click "Load Stats" to see database info
   - Click "Download Production Backup"
   - File downloads as `residentone-backup-YYYY-MM-DD.json`

2. **Via Direct API:**
   ```bash
   curl -H "Authorization: Bearer YOUR_SESSION" \
        https://your-site.vercel.app/api/admin/backup \
        -o backup.json
   ```

### **Restore from Backup:**

1. **Via Web Interface:**
   - Go to admin settings
   - Upload your backup JSON file
   - Confirm the destructive operation
   - Database is replaced with backup data

2. **Security Features:**
   - Only OWNER can restore
   - Confirmation dialog required
   - Transaction-based (atomic operation)

## 📊 What Gets Backed Up

### **Included Data:**
✅ Organizations, Users (no passwords)  
✅ Clients, Contractors  
✅ Projects, Floors, Rooms  
✅ Stages, Design Sections  
✅ FFE Items, Assets (metadata)  
✅ Client Access Tokens (no actual tokens)  
✅ Access Logs, Comments, Tasks  
✅ Approvals, Notifications  

### **Excluded for Security:**
❌ User password hashes  
❌ Actual client access tokens  
❌ File contents (only metadata)  
❌ Sensitive configuration  

## 🚨 Backup Strategy

### **Regular Schedule:**

#### **Daily (Automated):**
Use the local Windows Task Scheduler:
```powershell
npm run backup:schedule  # Run once to set up
```

#### **Before Major Changes:**
```powershell
# Local development:
npm run backup:simple

# Production (via admin UI):
# Download backup before deploying
```

#### **Weekly/Monthly:**
- Download production backup via admin UI
- Store backup files in secure location (OneDrive, etc.)
- Test restore process with old backup

## 🔄 Deployment Workflow

### **Safe Deployment Process:**

1. **Before Deployment:**
   ```powershell
   # Local backup
   npm run backup:simple
   
   # Test build
   npm run build:full
   ```

2. **Download Production Backup:**
   - Visit your live site admin panel
   - Download current production backup
   - Store safely on your computer

3. **Deploy:**
   ```powershell
   git push origin main  # Auto-deploys to Vercel
   ```

4. **If Something Goes Wrong:**
   - Visit admin panel on live site
   - Upload backup file to restore previous state

## 📁 File Management

### **Backup File Format:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0",
  "type": "production",
  "environment": "vercel",
  "created_by": {
    "id": "user-id",
    "email": "admin@example.com",
    "role": "OWNER"
  },
  "data": {
    "organizations": [...],
    "users": [...],
    "projects": [...],
    // ... all your data
  },
  "statistics": {
    "total_records": 1250,
    "backup_size_estimate": "2.5 MB"
  }
}
```

### **Storage Recommendations:**
- **Local:** Store in secure folder (not in Git)
- **Cloud:** Upload to OneDrive/Google Drive
- **Email:** Send to yourself for extra safety
- **External:** Copy to USB drive monthly

## ⚡ Quick Commands

### **Production (via Admin UI):**
- **Create Backup:** Admin Panel → Download Production Backup
- **Restore Backup:** Admin Panel → Upload JSON → Confirm
- **Check Status:** Admin Panel → Refresh Stats

### **Development (via NPM):**
```powershell
npm run backup:simple       # Quick config backup
npm run backup:full         # Full local DB backup (server stopped)
npm run backup:restore      # Interactive restore menu
npm run backup:list         # List available backups
```

## 🛠️ Advanced Usage

### **Automated Production Backups:**
Create a scheduled function (if needed):

```typescript
// api/cron/daily-backup.ts
export async function GET() {
  // Create backup
  // Store in external service
  // Send notification
}
```

### **Multiple Environment Backups:**
- **Development:** Local NPM scripts
- **Staging:** API endpoints (if you have staging)
- **Production:** API endpoints + manual downloads

## 🚨 Emergency Recovery

### **If Production Data is Lost:**

1. **Check Recent Backups:**
   - Look in your downloads folder
   - Check OneDrive/cloud storage
   - Check email attachments

2. **Restore Process:**
   - Access your Vercel admin panel
   - Upload most recent backup JSON
   - Confirm restore operation
   - Verify data integrity

3. **If No Backups Available:**
   - Check Vercel deployment history
   - Contact your database provider (they may have backups)
   - Roll back to previous Vercel deployment

## 📞 Troubleshooting

### **"Unauthorized" Error:**
- Ensure you're logged in as OWNER/ADMIN
- Check your user role in database

### **"Backup Failed" Error:**
- Check Vercel function logs
- Ensure database is accessible
- Verify Prisma client is working

### **Large Backup Files:**
- Backups with many assets may be large
- Consider excluding asset metadata if needed
- Split backups by date range if necessary

### **Restore Failed:**
- Verify backup file format
- Check you're OWNER role for restore
- Ensure backup is valid JSON

---

## 🎯 Summary

You now have **complete backup protection** for your ResidentOne system:

### **Local Development:**
- Fast config backups before changes
- Full database backups when needed
- Automated daily backups (optional)

### **Production (Vercel):**
- Web-based backup creation
- Download complete database as JSON
- Restore capability via admin interface
- Role-based access protection

### **Security:**
- Passwords and tokens excluded from backups
- Admin-only access to backup functions
- Confirmation required for destructive operations

**Your production data is now fully protected!** 🛡️
# Storage and Backup System

## 📁 Storage Architecture

### What's Stored Where

#### **Prisma Database (PostgreSQL)**
All text and metadata:
- User accounts, organizations, teams
- Project information, timelines, statuses
- Room and rendering version data
- Chat messages and comments
- Activity logs and notifications
- Asset metadata (filenames, sizes, URLs)

**Size:** Typically < 100 MB (just text/numbers)

#### **Dropbox Storage**
All file assets:
- Rendering images (3D visualizations)
- PDFs and documents
- CAD files and drawings
- Any uploaded files

**Size:** Can be GBs of data

---

## 🔄 Current Storage Strategy

### **Primary Storage: Dropbox**

All rendering images are now uploaded **only to Dropbox**, organized in project folders:

```
/Meisner Interiors Team Folder/
├── {Project Name}/
│   ├── 1-CAD/
│   ├── 2-MAX/
│   ├── 3-RENDERING/
│   │   ├── {Room Name}/
│   │   │   ├── V1/
│   │   │   │   ├── image1.jpg
│   │   │   │   └── image2.jpg
│   │   │   └── V2/
│   │   │       └── image3.jpg
│   ├── 4-SENT/
│   ├── 5-RECIEVED/
│   ├── 6-SHOPPING/
│   └── 7-SOURCES/
```

### **Why Dropbox Only?**

1. ✅ **No Vercel Blob quota issues** (was hitting 1GB limit)
2. ✅ **Better organization** (structured folders per project)
3. ✅ **Easy access** (team can browse files in Dropbox)
4. ✅ **More storage** (2GB free, scalable with paid plans)

---

## 💾 Database Backup System

### Automatic Daily Backups

**Schedule:** Every day at 2:00 AM UTC

**Location:** `/DATABASE-BACKUPS/` folder in Dropbox root

**Filename Format:** `database-backup-YYYY-MM-DD.json.gz`

### What's Backed Up

The backup includes **all** database tables:
- Organizations
- Users
- Projects
- Rooms
- Stages
- Rendering Versions
- Assets (metadata, not the files themselves)
- Activities
- Notifications
- Comments
- Messages

### Backup Format

**Compressed JSON file** (gzipped) containing:
```json
{
  "metadata": {
    "timestamp": "2025-01-02T02:00:00.000Z",
    "version": "1.0",
    "description": "Meisner Interiors Workflow daily backup"
  },
  "data": {
    "organizations": [...],
    "users": [...],
    "projects": [...],
    ...
  }
}
```

---

## 🔧 Manual Backup

### Trigger Manual Backup (Admin Only)

**Option 1: Via Cron Endpoint**
```bash
curl https://your-domain.vercel.app/api/cron/daily-backup?secret=YOUR_CRON_SECRET
```

**Option 2: Via Backup API (requires admin login)**
```bash
curl -X POST https://your-domain.vercel.app/api/backup/database \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

---

## 📊 Backup Storage

### Retention Policy

- **Daily backups** overwrite the same-day backup
- **One backup per day** is kept
- **Manual cleanup** recommended for old backups (keep last 30-60 days)

### Backup Size

Typical backup size: **1-5 MB** (compressed)

For a database with:
- 100 projects
- 500 rooms
- 2,000 rendering versions
- 10,000 assets

The compressed backup is approximately **2-3 MB**.

---

## 🚨 Disaster Recovery

### Restoring from Backup

1. Download backup file from Dropbox `/DATABASE-BACKUPS/`
2. Decompress: `gunzip database-backup-YYYY-MM-DD.json.gz`
3. Review JSON data
4. Manually import data using Prisma or SQL scripts

### Verifying Backups

Check Dropbox folder regularly to ensure backups are running:
```
/DATABASE-BACKUPS/
├── database-backup-2025-01-01.json.gz
├── database-backup-2025-01-02.json.gz
└── database-backup-2025-01-03.json.gz
```

---

## ⚙️ Configuration

### Required Environment Variables

```bash
# Dropbox API
DROPBOX_APP_KEY="your-key"
DROPBOX_APP_SECRET="your-secret"
DROPBOX_REFRESH_TOKEN="your-refresh-token"
DROPBOX_API_SELECT_USER="team-member-id"
DROPBOX_ROOT_NAMESPACE_ID="namespace-id"

# Cron Security
CRON_SECRET="random-secure-string"
```

### Vercel Cron Configuration

In `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-backup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

Schedule format: `minute hour day month dayOfWeek`
- `0 2 * * *` = Every day at 2:00 AM UTC

---

## 📈 Monitoring

### Check Backup Status

1. **Vercel Logs:** Check deployment logs for backup messages
2. **Dropbox:** Verify new backup files appear daily
3. **File Size:** Ensure backups are growing with data

### Backup Success Indicators

Look for these log messages:
```
🔄 Starting daily backup...
📊 Exported X records from Y tables
✅ Backup completed in Xms
📁 File: database-backup-2025-01-02.json.gz (2.5 MB)
📂 Path: /DATABASE-BACKUPS/database-backup-2025-01-02.json.gz
```

---

## 🔐 Security

### Access Control

- **Backups:** Admin/Owner roles only
- **Dropbox:** Team members with folder access
- **Cron:** Protected with `CRON_SECRET`

### Best Practices

1. ✅ Keep `CRON_SECRET` secure and unique
2. ✅ Regularly rotate Dropbox refresh tokens
3. ✅ Monitor backup file sizes for anomalies
4. ✅ Test restore process quarterly
5. ✅ Keep local copies of critical backups

---

## 📞 Support

For issues with:
- **Storage:** Check Dropbox integration and project settings
- **Backups:** Review cron logs in Vercel dashboard
- **Restores:** Contact system administrator

---

**Last Updated:** January 2025  
**Version:** 1.0

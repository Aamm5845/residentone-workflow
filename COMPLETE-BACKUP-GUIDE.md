# Complete Backup & Recovery System - Usage Guide

## 🎯 Overview

Your ResidentOne workflow now has a comprehensive backup system that ensures your project and team member data are always protected, even with frequent software updates.

## 🔄 Two Types of Backups

### 1. Safe Backup (Recommended for Regular Use)
- **What it includes**: All projects, users, rooms, assets, comments, etc.
- **What it excludes**: Passwords, authentication tokens, actual file content
- **File size**: Small (< 1MB typically)
- **Use cases**: Regular backups, data migration, development
- **Security**: Safe to store and share (no sensitive data)

### 2. Complete Backup (Disaster Recovery Only)
- **What it includes**: EVERYTHING including passwords, sessions, embedded files
- **File size**: Very large (can be 100+ MB with files)
- **Use cases**: Full disaster recovery, complete system restoration
- **Security**: ⚠️ Contains sensitive data - store securely
- **Access**: Owner role only

## 📍 How to Access

1. **Navigate to Team Management**:
   - Go to your dashboard
   - Click "Team" in the navigation
   - Scroll down to "Production Database Backup" section

2. **For Owner users**: You'll see both Safe and Complete backup options
3. **For Admin users**: You'll see Safe backup only

## 🚀 Using the Backup System

### Creating Backups via Web Interface

#### Safe Backup (Blue Button)
1. Click "Download Safe Backup"
2. System creates JSON file with all project data
3. File downloads automatically (e.g., `residentone-backup-2024-01-15.json`)
4. Store this file safely - it's your data insurance

#### Complete Backup (Orange Button)
1. Click "Download Complete Backup"
2. Confirm you want to include sensitive data
3. System creates large JSON file with everything
4. File downloads automatically (e.g., `residentone-complete-backup-2024-01-15.json`)
5. ⚠️ Store securely - contains passwords and files

### Restoring from Backups

#### Via Web Interface
1. In the same backup section, find "Restore from Backup"
2. Click "Select Backup File" and choose your .json backup
3. System detects backup type automatically:
   - Orange warning for complete backups
   - Standard warning for safe backups
4. Click "Restore Database" or "Restore Complete Backup"
5. Confirm the destructive operation
6. ⚠️ This replaces ALL current data

#### Via Command Line
```bash
# For safe backups
npm run backup:restore

# The system will prompt you to select a backup file
```

## 📅 Recommended Schedule

### Daily (Automated)
```bash
# Set up automated daily safe backups at 2 AM
npm run backup:schedule
```

### Weekly (Manual)
- Create a complete backup every Sunday
- Store it in a secure location off-site
- Test one restore per month

### Before Updates
- Always create a complete backup before updating the software
- This ensures you can rollback if something goes wrong

## 🛠️ Command Line Options

```bash
# Create immediate safe backup
npm run backup

# Schedule automated daily backups
npm run backup:schedule

# List all available backups
npm run backup:list

# Interactive restore
npm run backup:restore

# Run development with automatic backup
npm run dev:safe

# Test the backup system
node test-complete-backup.js
```

## 🔒 Security Best Practices

### Safe Backups
- ✅ Can be stored in cloud storage
- ✅ Can be shared with team members
- ✅ Safe to commit to private repos (if needed)
- ✅ Good for regular automated backups

### Complete Backups
- ⚠️ Never store in cloud storage without encryption
- ⚠️ Never share via email or messaging
- ⚠️ Never commit to version control
- ⚠️ Use encrypted storage or secure physical media
- ✅ Store offline/air-gapped for disaster recovery

## 🚨 Emergency Recovery Scenarios

### Scenario 1: Software Update Gone Wrong
```
1. Stop the application
2. Go to Team page → Production Database Backup
3. Upload your last safe backup file
4. Click "Restore Database" and confirm
5. Restart application
6. All project data restored (users may need to reset passwords)
```

### Scenario 2: Complete System Failure
```
1. Set up new system/server
2. Deploy fresh ResidentOne installation
3. Go to Team page → Production Database Backup
4. Upload your complete backup file
5. Click "Restore Complete Backup" and confirm
6. All users, passwords, and files restored
```

### Scenario 3: Data Corruption
```
1. Create backup of corrupted data (for analysis)
2. Restore from your last known good backup
3. Manually re-enter any work done since backup
```

## 📊 Monitoring & Validation

### Check Backup Health
1. Go to Team page → Production Database Backup
2. Click "Refresh Stats" to see current database information
3. Review total records and data breakdown
4. This helps you understand what will be backed up

### Test Restores (Monthly)
1. Create test environment
2. Restore your latest backup
3. Verify all data is intact
4. Confirm user logins work (for complete backups)
5. Check file uploads/downloads

## 💡 Pro Tips

1. **Name your backups**: Manually rename downloaded files with context
   - `residentone-complete-before-v2-upgrade-2024-01-15.json`
   - `residentone-safe-end-of-january-2024-01-31.json`

2. **Store multiple versions**: Don't overwrite old backups
   - Keep last 10 safe backups
   - Keep last 3 complete backups

3. **Document your backups**: Keep a log of when/why you created them

4. **Test before trusting**: Always test a restore in development first

5. **Use the right backup type**:
   - Daily/weekly routine: Safe backups
   - Before major updates: Complete backups
   - Disaster recovery: Complete backups

## ❓ Troubleshooting

### Backup Creation Fails
- Check you have Owner role for complete backups
- Ensure database connection is working
- Check browser console for error messages
- Try refreshing the page and trying again

### Restore Fails
- Verify backup file format (must be valid JSON)
- Check you have Owner role for complete restores
- Ensure file isn't corrupted (try opening in text editor)
- Check server logs for detailed error messages

### Large Backup Files
- Complete backups can be 100+ MB with many files
- Be patient during creation (can take several minutes)
- Ensure adequate disk space
- Your browser may warn about large download

### Permission Issues
- Only Owner role can create/restore complete backups
- Admin and Owner can create/restore safe backups
- Other roles cannot access backup functionality

## 📦 What's Included in Each Backup Type

### Safe Backup Contains
- ✅ All project data and metadata
- ✅ User accounts (without passwords)
- ✅ Room configurations and stages
- ✅ Asset metadata and file URLs
- ✅ Comments and collaboration data
- ✅ Organization settings
- ✅ Client and contractor information
- ❌ Password hashes (excluded for security)
- ❌ Session tokens (regenerated on restore)
- ❌ Actual file content (just URLs)

### Complete Backup Contains
- ✅ Everything from Safe Backup PLUS:
- ✅ Password hashes and authentication data
- ✅ Session tokens and user sessions
- ✅ Embedded file content (base64 encoded)
- ✅ Client access tokens
- ✅ Password reset tokens
- ✅ All sensitive authentication data

## 🌐 API Endpoints (for Advanced Users)

### Backup Creation
- `GET /api/admin/backup` - Create safe backup
- `GET /api/admin/backup-complete` - Create complete backup (Owner only)
- `POST /api/admin/backup` - Get backup statistics

### Backup Restoration
- `POST /api/admin/restore` - Restore from safe backup
- `POST /api/admin/restore-complete` - Restore from complete backup (Owner only)

### Example API Usage
```bash
# Get backup statistics
curl -X POST http://localhost:3000/api/admin/backup

# Create safe backup
curl http://localhost:3000/api/admin/backup > backup.json

# Restore from backup (replace with actual backup data)
curl -X POST http://localhost:3000/api/admin/restore \
  -H "Content-Type: application/json" \
  -d '{"backup_data": {...}, "confirm_restore": true}'
```

---

## 🎉 You're Protected!

With this system in place, your ResidentOne data is now protected against:
- Software updates that go wrong ✅
- Database corruption ✅
- Accidental data deletion ✅
- Server failures ✅
- User errors ✅
- Complete system disasters ✅

### Quick Reference Commands
```bash
# Daily workflow
npm run backup                 # Create safe backup
npm run dev:safe              # Backup then start dev

# Emergency recovery
npm run backup:restore         # Interactive restore

# System administration
npm run backup:schedule        # Set up daily automation
npm run backup:list           # View available backups
node test-complete-backup.js   # Test system health
```

**Remember: A backup is only as good as your last restore test!**

## 🚦 Getting Started Checklist

1. ✅ **Test the system now**: 
   - Go to Team page
   - Create a safe backup
   - Verify the file downloads

2. ✅ **Set up automation**:
   ```bash
   npm run backup:schedule
   ```

3. ✅ **Create your first complete backup**:
   - Use before any major changes
   - Store securely offline

4. ✅ **Test a restore**:
   - In a development environment
   - Verify all data comes back correctly

5. ✅ **Document your process**:
   - Note where you store backups
   - Set calendar reminders for manual backups

You're now fully protected against data loss! 🛡️
# FFE Two-Department System - Deployment Guide

This guide provides step-by-step instructions for deploying the new FFE two-department system to production.

## Overview

The FFE system has been redesigned into two distinct departments:
- **Settings Department**: Configuration and management (Admin/Designer only)  
- **Workspace Department**: Task execution and progress tracking (all authorized users)

## Pre-Deployment Checklist

### ✅ Database Requirements
- [ ] PostgreSQL 14+ or compatible database
- [ ] Database backup created and verified
- [ ] Database migration permissions confirmed

### ✅ Environment Setup
- [ ] Node.js 18+ installed
- [ ] npm/yarn package manager available
- [ ] Environment variables configured (see [Environment Variables](#environment-variables))
- [ ] Build tools and dependencies installed

### ✅ Access Control
- [ ] User roles properly configured in database
- [ ] Admin/Designer users identified for Settings access
- [ ] Workflow permissions validated

## Deployment Steps

### 1. Database Migration

**⚠️ Important**: Always backup your database before running migrations.

```bash
# Create backup
pg_dump your_database > backup_$(date +%Y%m%d_%H%M%S).sql

# Run Prisma migration
npx prisma migrate deploy

# Verify migration
npx prisma db push --accept-data-loss=false
```

**Expected Changes**:
- New `visibility` enum field added to `RoomFFEItem` table
- Performance indexes created: `(roomId, visibility)`
- Default value `VISIBLE` set for existing records

### 2. Data Migration

Run the visibility migration script to ensure backward compatibility:

```bash
# Dry run (recommended first)
node scripts/migrate-ffe-visibility.js --dry-run

# Actual migration
node scripts/migrate-ffe-visibility.js

# Verify results
node scripts/migrate-ffe-visibility.js --dry-run
```

**Expected Results**:
- All existing FFE items set to `visibility: 'VISIBLE'`
- Backup file created with timestamp
- No data loss or corruption

### 3. Frontend Build & Deploy

```bash
# Install dependencies
npm ci

# Build application
npm run build

# Deploy to your hosting platform
# (specific commands depend on your deployment method)
```

### 4. API Endpoint Validation

Test the new endpoints to ensure they're working:

```bash
# Test visibility endpoint
curl -X GET "https://your-app.com/api/ffe/v2/rooms/ROOM_ID?onlyVisible=true" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test visibility update
curl -X PATCH "https://your-app.com/api/ffe/v2/rooms/ROOM_ID/items/ITEM_ID/visibility" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"visibility": "HIDDEN"}'
```

### 5. Route Configuration

Ensure your web server/CDN is configured for the new routes:

```nginx
# Example Nginx configuration
location /ffe {
  try_files $uri $uri/ /index.html;
}

# Specific routes for departments
location /ffe/*/settings {
  try_files $uri $uri/ /index.html;
}

location /ffe/*/workspace {
  try_files $uri $uri/ /index.html;
}
```

## Environment Variables

Add these to your environment configuration:

```env
# FFE Feature Flags
ENABLE_FFE_TWO_DEPARTMENT=true
FFE_MIGRATION_BATCH_SIZE=100

# Access Control
FFE_ADMIN_ROLES=admin,designer
FFE_WORKSPACE_ROLES=admin,designer,ffe,ffe_specialist

# Performance
FFE_QUERY_TIMEOUT=30000
FFE_MAX_ITEMS_PER_ROOM=1000
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check database connection
curl -X GET "https://your-app.com/api/health"

# Verify FFE endpoints
curl -X GET "https://your-app.com/api/ffe/health"
```

### 2. User Access Testing

Test with different user roles:

```bash
# Admin user - should access both departments
curl -X GET "https://your-app.com/ffe/room-123/settings" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# FFE specialist - should redirect to workspace
curl -X GET "https://your-app.com/ffe/room-123/settings" \
  -H "Authorization: Bearer FFE_TOKEN"
```

### 3. Functional Testing

Perform these tests in the UI:

**Settings Department (Admin/Designer)**:
- [ ] Can access settings page
- [ ] Can view all items (visible and hidden)
- [ ] "Use"/"Remove" buttons work correctly
- [ ] Can add sections and items
- [ ] Can import templates
- [ ] Bulk visibility operations work

**Workspace Department (All authorized users)**:
- [ ] Can access workspace page
- [ ] Only sees visible items
- [ ] Cannot see add/delete/import controls
- [ ] Can change item states (Pending → Undecided → Completed)
- [ ] Notes persist across state changes
- [ ] Progress tracking updates correctly

**Cross-Department Integration**:
- [ ] Hiding item in Settings removes it from Workspace
- [ ] Making item visible in Settings shows it in Workspace
- [ ] Notes persist when switching visibility
- [ ] User can switch between departments seamlessly

## Performance Monitoring

Monitor these metrics after deployment:

### Database Performance
```sql
-- Query performance for visibility filtering
EXPLAIN ANALYZE 
SELECT * FROM "RoomFFEItem" 
WHERE "roomId" = 'room-123' AND "visibility" = 'VISIBLE';

-- Index usage verification
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE tablename = 'RoomFFEItem' AND attname IN ('roomId', 'visibility');
```

### Application Metrics
- Response times for FFE API endpoints
- Memory usage during large dataset operations
- User session patterns between departments

### Error Monitoring
Watch for these potential issues:
- 403 errors (access control problems)
- 404 errors (routing issues)
- 500 errors (API failures)
- Database timeout errors
- Notes persistence failures

## Rollback Plan

If issues occur, follow this rollback procedure:

### 1. Immediate Rollback (Frontend Only)
```bash
# Deploy previous version
git checkout previous-stable-tag
npm run build
# Deploy to hosting platform
```

### 2. Database Rollback (If Required)
```bash
# Stop application
# Restore from backup
psql your_database < backup_file.sql

# Rollback Prisma migrations
npx prisma migrate reset --force
```

### 3. Feature Flag Rollback
```env
# Disable two-department system
ENABLE_FFE_TWO_DEPARTMENT=false

# Fallback to legacy FFE system
ENABLE_LEGACY_FFE=true
```

## Troubleshooting

### Common Issues

#### Users Cannot Access Settings
**Symptoms**: 403 errors or redirect to workspace
**Solution**: 
1. Check user roles in database
2. Verify `FFE_ADMIN_ROLES` environment variable
3. Clear user session cache

#### Items Not Appearing in Workspace
**Symptoms**: Empty workspace or missing items
**Solution**:
1. Check item visibility in database: `SELECT * FROM "RoomFFEItem" WHERE "visibility" = 'HIDDEN'`
2. Run migration script again if needed
3. Verify API filtering logic

#### Notes Not Persisting
**Symptoms**: Notes lost after state changes
**Solution**:
1. Check API endpoint logs for errors
2. Verify database field updates
3. Run notes persistence tests

#### Performance Issues
**Symptoms**: Slow page loads or timeouts
**Solution**:
1. Check database indexes: `EXPLAIN ANALYZE` on slow queries
2. Monitor memory usage
3. Consider pagination for large datasets

### Debug Commands

```bash
# Check migration status
npx prisma migrate status

# Verify data integrity
npm run test:integration

# Check API health
curl -X GET "https://your-app.com/api/ffe/health"

# Database query debugging
psql your_database -c "SELECT COUNT(*), visibility FROM \"RoomFFEItem\" GROUP BY visibility;"
```

## Support Contacts

- **Technical Issues**: devops@residentone.com
- **User Access Problems**: admin@residentone.com  
- **Emergency Rollback**: emergency@residentone.com (24/7)

---

## Deployment Completion Checklist

Once deployment is complete, verify:

- [ ] Database migration successful
- [ ] All existing data preserved
- [ ] New routes accessible
- [ ] User permissions working correctly
- [ ] Performance within acceptable limits
- [ ] Error monitoring active
- [ ] Documentation updated
- [ ] User training materials distributed
- [ ] Rollback plan tested and ready

---

**Last Updated**: 2024-10-10  
**Version**: 1.0  
**Author**: ResidentOne Development Team
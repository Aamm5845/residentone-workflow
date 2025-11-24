const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreDatabase() {
  const backupPath = path.join(__dirname, 'backups', 'residentone-complete-backup-2025-11-04T21-10-06-919Z.json');
  
  console.log('📂 Reading backup file...');
  const backupFile = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const backup = backupFile.data;
  
  console.log('\n📊 Backup info:');
  console.log(`  - Created: ${backupFile.timestamp}`);
  console.log(`  - Type: ${backupFile.type}`);
  console.log(`  - By: ${backupFile.created_by.email}`);
  
  console.log('\n📊 Backup contains:');
  for (const [table, data] of Object.entries(backup)) {
    if (Array.isArray(data)) {
      console.log(`  - ${table}: ${data.length} records`);
    }
  }
  
  console.log('\n🔄 Starting restoration...\n');
  
  try {
    // Order matters due to foreign key constraints
    const restoreOrder = [
      'organizations', 'users', 'clients', 'contractors', 'projects', 'projectContractors',
      'roomSections', 'rooms', 'stages', 'designSections', 'tags', 'assets',
      'checklistItems', 'comments', 'chatMessages', 'chatMentions', 'chatMessageReactions',
      'activityLogs', 'approvals', 'ffeItems', 'ffeItemStatuses',
      'renderingVersions', 'renderingNotes', 'clientApprovalVersions',
      'floorplanApprovalVersions', 'issues', 'issueComments'
    ];
    
    for (const tableName of restoreOrder) {
      if (backup[tableName] && backup[tableName].length > 0) {
        console.log(`📥 Restoring ${tableName}...`);
        
        // Convert plural to singular for Prisma model name
        let modelName = tableName;
        if (modelName.endsWith('s') && !modelName.endsWith('ss')) {
          modelName = modelName.slice(0, -1);
        }
        
        try {
          for (const record of backup[tableName]) {
            await prisma[modelName].create({ data: record });
          }
          console.log(`  ✅ Restored ${backup[tableName].length} ${tableName} records`);
        } catch (error) {
          console.error(`  ⚠️  Error restoring ${tableName}:`, error.message);
        }
      }
    }
    
    console.log('\n✅ Restoration complete! Verifying...\n');
    
    // Verify restoration
    const userCount = await prisma.user.count();
    const projectCount = await prisma.project.count();
    const roomCount = await prisma.room.count();
    
    console.log('📊 Database verification:');
    console.log(`  - Users: ${userCount}`);
    console.log(`  - Projects: ${projectCount}`);
    console.log(`  - Rooms: ${roomCount}`);
    
    if (userCount > 0) {
      console.log('\n✅ SUCCESS! Database restored successfully! 🎉');
    } else {
      console.log('\n⚠️  Warning: User count is still 0');
    }
    
  } catch (error) {
    console.error('\n❌ Restoration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreDatabase();

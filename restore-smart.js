const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Clean record by removing nested arrays and fixing field names
function cleanRecord(tableName, record) {
  const cleaned = { ...record };
  
  // Remove nested arrays (relations that shouldn't be in create)
  for (const key of Object.keys(cleaned)) {
    if (Array.isArray(cleaned[key])) {
      delete cleaned[key];
    }
  }
  
  // Fix Asset model - add missing required fields
  if (tableName === 'assets') {
    if (!cleaned.title) {
      cleaned.title = cleaned.filename || 'Untitled';
    }
    if (!cleaned.roomId && !cleaned.stageId && !cleaned.sectionId) {
      // Skip assets without any parent relation
      return null;
    }
  }
  
  return cleaned;
}

async function restoreDatabase() {
  const backupPath = path.join(__dirname, 'backups', 'residentone-complete-backup-2025-11-04T21-10-06-919Z.json');
  
  console.log('📂 Reading backup file...');
  const backupFile = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const backup = backupFile.data;
  
  console.log('\n📊 Backup info:');
  console.log(`  - Created: ${backupFile.timestamp}`);
  console.log(`  - Type: ${backupFile.type}`);
  console.log(`  - By: ${backupFile.created_by.email}`);
  
  console.log('\n📊 Will restore:');
  const counts = {};
  for (const [table, data] of Object.entries(backup)) {
    if (Array.isArray(data) && data.length > 0) {
      counts[table] = data.length;
      console.log(`  - ${table}: ${data.length} records`);
    }
  }
  
  console.log('\n🔄 Starting restoration...\n');
  
  try {
    // Critical order due to foreign key constraints
    const restoreOrder = [
      'organizations',
      'users',
      'clients',
      'contractors',
      'projects',
      'projectContractors',
      'roomSections',
      'rooms',
      'stages',
      'designSections',
      'assets',
      'clientAccessTokens',
      'clientAccessLogs',
      'comments',
      'chatMessages',
      'chatMentions',
      'chatMessageReactions',
      'notifications',
      'activityLogs',
      'activities',
      'ffeChangeLogs',
      'renderingVersions',
      'renderingNotes',
      'issues',
      'issueComments',
      'ffeTemplates',
      'ffeTemplateSections',
      'ffeTemplateItems',
      'roomFfeInstances',
      'roomFfeSections',
      'roomFfeItems',
      'ffeSectionLibrary',
      'drawingChecklistItems',
      'specBooks',
      'specBookSections',
      'specBookGenerations',
      'dropboxFileLinks',
      'clientApprovalAssets'
    ];
    
    const stats = {
      success: 0,
      skipped: 0,
      failed: 0
    };
    
    for (const tableName of restoreOrder) {
      if (backup[tableName] && backup[tableName].length > 0) {
        console.log(`📥 Restoring ${tableName}...`);
        
        // Convert plural to singular for Prisma model name
        let modelName = tableName;
        if (modelName.endsWith('ies')) {
          modelName = modelName.slice(0, -3) + 'y';
        } else if (modelName.endsWith('s') && !modelName.endsWith('ss')) {
          modelName = modelName.slice(0, -1);
        }
        
        let successCount = 0;
        let skipCount = 0;
        let failCount = 0;
        
        for (const record of backup[tableName]) {
          try {
            const cleaned = cleanRecord(tableName, record);
            if (cleaned === null) {
              skipCount++;
              continue;
            }
            
            await prisma[modelName].create({ data: cleaned });
            successCount++;
          } catch (error) {
            failCount++;
            if (failCount === 1) {
              // Only show first error for each table
              console.log(`  ⚠️  First error: ${error.message.split('\\n')[0]}`);
            }
          }
        }
        
        if (successCount > 0) {
          console.log(`  ✅ Restored ${successCount}/${backup[tableName].length} ${tableName} records`);
        }
        if (skipCount > 0) {
          console.log(`  ⏭️  Skipped ${skipCount} invalid records`);
        }
        if (failCount > 0) {
          console.log(`  ⚠️  Failed ${failCount} records`);
        }
        
        stats.success += successCount;
        stats.skipped += skipCount;
        stats.failed += failCount;
      }
    }
    
    console.log('\n✅ Restoration complete! Verifying...\n');
    
    // Verify restoration
    const userCount = await prisma.user.count();
    const projectCount = await prisma.project.count();
    const roomCount = await prisma.room.count();
    const clientCount = await prisma.client.count();
    
    console.log('📊 Database verification:');
    console.log(`  - Organizations: ${await prisma.organization.count()}`);
    console.log(`  - Users: ${userCount}`);
    console.log(`  - Clients: ${clientCount}`);
    console.log(`  - Projects: ${projectCount}`);
    console.log(`  - Rooms: ${roomCount}`);
    console.log(`  - Stages: ${await prisma.stage.count()}`);
    console.log(`  - Design Sections: ${await prisma.designSection.count()}`);
    console.log(`  - Assets: ${await prisma.asset.count()}`);
    
    console.log(`\n📊 Overall stats:`);
    console.log(`  - Success: ${stats.success}`);
    console.log(`  - Skipped: ${stats.skipped}`);
    console.log(`  - Failed: ${stats.failed}`);
    
    if (userCount > 0 && projectCount > 0) {
      console.log('\n✅ SUCCESS! Database restored! 🎉');
      console.log('\n🔄 Now run: npx prisma generate');
    } else {
      console.log('\n⚠️  Partial restoration - some core data missing');
    }
    
  } catch (error) {
    console.error('\n❌ Restoration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreDatabase();

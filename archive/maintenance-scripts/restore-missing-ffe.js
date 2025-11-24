const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreMissingFFE() {
  const backupPath = path.join(__dirname, 'backups', 'residentone-complete-backup-2025-10-30T17-24-37-688Z.json');
  
  console.log('🔄 Restoring missing FFE data...');
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  
  try {
    // FFE Section Library (skip duplicates)
    console.log('\n📚 Restoring FFE Section Library...');
    let libCount = 0;
    for (const lib of backup.data.ffeSectionLibrary || []) {
      try {
        await prisma.fFESectionLibrary.create({ data: lib });
        libCount++;
      } catch (e) {
        if (e.code !== 'P2002') throw e; // Throw if NOT a duplicate error
      }
    }
    console.log(`✅ Added ${libCount} new FFE section library items`);
    
    // Room FFE Instances
    console.log('\n🏠 Restoring Room FFE Instances...');
    for (const instance of backup.data.roomFfeInstances || []) {
      try {
        await prisma.roomFFEInstance.create({ data: instance });
      } catch (e) {
        if (e.code !== 'P2002') throw e;
      }
    }
    console.log(`✅ Restored ${backup.data.roomFfeInstances?.length || 0} room FFE instances`);
    
    // Room FFE Sections
    console.log('\n📋 Restoring Room FFE Sections...');
    for (const section of backup.data.roomFfeSections || []) {
      try {
        await prisma.roomFFESection.create({ data: section });
      } catch (e) {
        if (e.code !== 'P2002') throw e;
      }
    }
    console.log(`✅ Restored ${backup.data.roomFfeSections?.length || 0} room FFE sections`);
    
    // Room FFE Items - THE CRITICAL ONES
    console.log('\n🔨 Restoring Room FFE Items...');
    let roomItemCount = 0;
    for (const item of backup.data.roomFfeItems || []) {
      try {
        await prisma.roomFFEItem.create({ data: item });
        roomItemCount++;
      } catch (e) {
        if (e.code !== 'P2002') {
          console.error(`Error with item:`, e.message);
        }
      }
    }
    console.log(`✅ Restored ${roomItemCount} room FFE items`);
    
    // FFE Change Logs
    console.log('\n📝 Restoring FFE Change Logs...');
    for (const log of backup.data.ffeChangeLogs || []) {
      try {
        await prisma.fFEChangeLog.create({ data: log });
      } catch (e) {
        if (e.code !== 'P2002') throw e;
      }
    }
    console.log(`✅ Restored ${backup.data.ffeChangeLogs?.length || 0} FFE change logs`);
    
    console.log('\n🎉 MISSING FFE DATA RESTORED!');
    console.log('\nPlease check the FFE management section now.');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

restoreMissingFFE()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

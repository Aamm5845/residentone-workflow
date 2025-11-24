const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreDatabase() {
  const backupPath = path.join(__dirname, 'backups', 'residentone-complete-backup-2025-10-30T17-24-37-688Z.json');
  
  console.log('🔄 Starting database restoration...');
  console.log(`📁 Reading backup from: ${backupPath}`);
  
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  
  console.log('📊 Backup contains:');
  console.log(`  - ${backup.data.organizations?.length || 0} organizations`);
  console.log(`  - ${backup.data.users?.length || 0} users`);
  console.log(`  - ${backup.data.clients?.length || 0} clients`);
  console.log(`  - ${backup.data.projects?.length || 0} projects`);
  console.log(`  - ${backup.data.rooms?.length || 0} rooms`);
  console.log(`  - ${backup.data.stages?.length || 0} stages`);
  
  try {
    // Restore in correct order (respecting foreign keys)
    
    // 1. Organizations
    console.log('\n📦 Restoring organizations...');
    for (const org of backup.data.organizations || []) {
      await prisma.organization.create({ data: org });
    }
    console.log(`✅ Restored ${backup.data.organizations?.length || 0} organizations`);
    
    // 2. Users
    console.log('\n👥 Restoring users...');
    for (const user of backup.data.users || []) {
      const { accounts, sessions, ...userData } = user;
      await prisma.user.create({ data: userData });
    }
    console.log(`✅ Restored ${backup.data.users?.length || 0} users`);
    
    // 3. Clients
    console.log('\n🤝 Restoring clients...');
    for (const client of backup.data.clients || []) {
      await prisma.client.create({ data: client });
    }
    console.log(`✅ Restored ${backup.data.clients?.length || 0} clients`);
    
    // 4. Contractors
    console.log('\n🔨 Restoring contractors...');
    for (const contractor of backup.data.contractors || []) {
      await prisma.contractor.create({ data: contractor });
    }
    console.log(`✅ Restored ${backup.data.contractors?.length || 0} contractors`);
    
    // 5. Projects
    console.log('\n📋 Restoring projects...');
    for (const project of backup.data.projects || []) {
      await prisma.project.create({ data: project });
    }
    console.log(`✅ Restored ${backup.data.projects?.length || 0} projects`);
    
    // 6. Room Sections
    if (backup.data.roomSections) {
      console.log('\n📑 Restoring room sections...');
      for (const section of backup.data.roomSections) {
        await prisma.roomSection.create({ data: section });
      }
      console.log(`✅ Restored ${backup.data.roomSections?.length || 0} room sections`);
    }
    
    // 7. Rooms
    console.log('\n🏠 Restoring rooms...');
    for (const room of backup.data.rooms || []) {
      await prisma.room.create({ data: room });
    }
    console.log(`✅ Restored ${backup.data.rooms?.length || 0} rooms`);
    
    // 8. Stages
    console.log('\n⚡ Restoring stages...');
    for (const stage of backup.data.stages || []) {
      await prisma.stage.create({ data: stage });
    }
    console.log(`✅ Restored ${backup.data.stages?.length || 0} stages`);
    
    console.log('\n🎉 DATABASE RESTORATION COMPLETE!');
    console.log('\n✅ All your data has been restored successfully!');
    
  } catch (error) {
    console.error('\n❌ Error during restoration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

restoreDatabase()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

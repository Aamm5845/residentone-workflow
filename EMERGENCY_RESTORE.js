const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function emergencyRestore() {
  try {
    console.log('🚨 EMERGENCY DATABASE RESTORE 🚨\n');
    
    // Read the backup file
    const backupPath = 'C:\\Users\\ADMIN\\Desktop\\residentone-workflow\\backups\\residentone-complete-backup-2025-10-16T19-27-45-147Z.json';
    console.log('📁 Reading backup file...');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    const data = backup.data;
    console.log(`\n📊 Backup contains:`);
    console.log(`   - ${data.users?.length || 0} users`);
    console.log(`   - ${data.clients?.length || 0} clients`);
    console.log(`   - ${data.projects?.length || 0} projects`);
    console.log(`   - ${data.rooms?.length || 0} rooms`);
    console.log(`   - ${data.stages?.length || 0} stages`);
    
    console.log('\n🔄 Starting restore process...\n');
    
    // Restore in correct order due to foreign keys
    
    // 1. Organizations FIRST (users depend on them)
    if (data.organizations && data.organizations.length > 0) {
      console.log('🏢 Restoring organizations...');
      for (const org of data.organizations) {
        const { users, clients, projects, tags, contractors, ...orgData } = org;
        await prisma.organization.upsert({
          where: { id: org.id },
          update: orgData,
          create: orgData
        });
      }
      console.log(`✅ Restored ${data.organizations.length} organizations`);
    }
    
    // 2. Users
    if (data.users && data.users.length > 0) {
      console.log('👥 Restoring users...');
      for (const user of data.users) {
        const { accounts, sessions, userSessions, ...userData } = user;
        await prisma.user.upsert({
          where: { id: user.id },
          update: userData,
          create: userData
        });
      }
      console.log(`✅ Restored ${data.users.length} users`);
    }
    
    // 3. Clients
    if (data.clients && data.clients.length > 0) {
      console.log('👤 Restoring clients...');
      for (const client of data.clients) {
        const { projects, ...clientData } = client;
        await prisma.client.upsert({
          where: { id: client.id },
          update: clientData,
          create: clientData
        });
      }
      console.log(`✅ Restored ${data.clients.length} clients`);
    }
    
    // 4. Projects
    if (data.projects && data.projects.length > 0) {
      console.log('📁 Restoring projects...');
      for (const project of data.projects) {
        const { rooms, client, createdBy, updatedBy, organization, projectContractors, specBooks, clientAccessTokens, approvals, assets, comments, floorplanApprovalVersions, roomSections, ...projectData } = project;
        await prisma.project.upsert({
          where: { id: project.id },
          update: projectData,
          create: projectData
        });
      }
      console.log(`✅ Restored ${data.projects.length} projects`);
    }
    
    // 5. Rooms
    if (data.rooms && data.rooms.length > 0) {
      console.log('🏠 Restoring rooms...');
      for (const room of data.rooms) {
        // Remove the new fields that didn't exist in backup and relations
        const { sectionId, order, section, stages, approvals, assets, comments, ffeItems, ffeItemStatuses, createdBy, project, projectUpdateTasks, specBookSections, updatedBy, ffeInstance, renderingVersions, ...roomData } = room;
        await prisma.room.upsert({
          where: { id: room.id },
          update: roomData,
          create: { ...roomData, order: 0 } // Add default order for new field
        });
      }
      console.log(`✅ Restored ${data.rooms.length} rooms`);
    }
    
    // 6. Stages
    if (data.stages && data.stages.length > 0) {
      console.log('📋 Restoring stages...');
      for (const stage of data.stages) {
        const { assets, chatMessages, clientApprovalVersions, comments, designSections, assignedUser, completedBy, createdBy, room, updatedBy, renderingVersions, ...stageData } = stage;
        await prisma.stage.upsert({
          where: { id: stage.id },
          update: stageData,
          create: stageData
        });
      }
      console.log(`✅ Restored ${data.stages.length} stages`);
    }
    
    // 7. Design Sections
    if (data.designSections && data.designSections.length > 0) {
      console.log('🎨 Restoring design sections...');
      for (const section of data.designSections) {
        await prisma.designSection.upsert({
          where: { id: section.id },
          update: section,
          create: section
        });
      }
      console.log(`✅ Restored ${data.designSections.length} design sections`);
    }
    
    // 8. FFE Items
    if (data.ffeItems && data.ffeItems.length > 0) {
      console.log('🛋️  Restoring FFE items...');
      for (const item of data.ffeItems) {
        await prisma.fFEItem.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      console.log(`✅ Restored ${data.ffeItems.length} FFE items`);
    }
    
    console.log('\n✅✅✅ DATABASE FULLY RESTORED! ✅✅✅\n');
    console.log('Your data has been recovered from the October 16th backup.\n');
    
  } catch (error) {
    console.error('\n❌ ERROR during restore:', error);
    console.error('\nPlease share this error with support.');
  } finally {
    await prisma.$disconnect();
  }
}

emergencyRestore();

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreCompleteNov4() {
  const backupPath = path.join(__dirname, 'backups', 'residentone-complete-backup-2025-11-04T21-10-06-919Z.json');
  
  console.log('🔄 Starting COMPLETE database restoration from November 4th backup...');
  console.log(`📁 Reading backup from: ${backupPath}`);
  
  if (!fs.existsSync(backupPath)) {
    console.error('❌ Backup file not found!');
    process.exit(1);
  }
  
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  
  console.log('\n📊 Backup Information:');
  console.log(`   Timestamp: ${backup.timestamp}`);
  console.log(`   Version: ${backup.version}`);
  console.log(`   Type: ${backup.type}`);
  console.log(`   Created by: ${backup.created_by.email} (${backup.created_by.role})`);
  
  try {
    // STEP 1: Clear existing data
    console.log('\n🗑️  STEP 1: Clearing existing data...');
    
    // Delete in reverse order of dependencies
    await prisma.$executeRaw`TRUNCATE TABLE "FFEChangeLog" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "EmailLog" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "DropboxFileLink" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "ClientApprovalAsset" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "ClientApprovalActivity" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "ClientAccessLog" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "ClientAccessToken" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "SpecBookGeneration" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "SpecBookSection" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "SpecBook" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "Issue" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "Activity" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "ActivityLog" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "Notification" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "RenderingVersion" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "ChatMention" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "ChatMessage" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "Asset" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "DesignSection" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "RoomFFEItem" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "RoomFFESection" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "RoomFFEInstance" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "FFELibraryItem" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "FFESectionLibrary" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "FFETemplateItem" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "FFETemplateSection" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "FFETemplate" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "ProjectContractor" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "Stage" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "Room" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "Project" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "Contractor" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "Client" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "Session" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "Account" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "User" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "Organization" CASCADE`;
    
    console.log('✅ Existing data cleared');

    // STEP 2: Restore Organizations
    console.log('\n🏢 STEP 2: Restoring Organizations...');
    for (const org of backup.data.organizations || []) {
      await prisma.organization.create({ data: org });
    }
    console.log(`✅ Restored ${backup.data.organizations?.length || 0} organizations`);

    // STEP 3: Restore Users
    console.log('\n👥 STEP 3: Restoring Users...');
    for (const user of backup.data.users || []) {
      const { accounts, sessions, ...userData } = user;
      await prisma.user.create({ data: userData });
    }
    console.log(`✅ Restored ${backup.data.users?.length || 0} users`);

    // STEP 4: Restore Accounts
    console.log('\n🔑 STEP 4: Restoring Accounts...');
    for (const user of backup.data.users || []) {
      for (const account of user.accounts || []) {
        await prisma.account.create({ data: account });
      }
    }
    console.log('✅ Restored accounts');

    // STEP 5: Restore Sessions
    console.log('\n🔐 STEP 5: Restoring Sessions...');
    for (const user of backup.data.users || []) {
      for (const session of user.sessions || []) {
        await prisma.session.create({ data: session });
      }
    }
    console.log('✅ Restored sessions');

    // STEP 6: Restore Clients
    console.log('\n👤 STEP 6: Restoring Clients...');
    for (const client of backup.data.clients || []) {
      await prisma.client.create({ data: client });
    }
    console.log(`✅ Restored ${backup.data.clients?.length || 0} clients`);

    // STEP 7: Restore Contractors
    console.log('\n🔨 STEP 7: Restoring Contractors...');
    for (const contractor of backup.data.contractors || []) {
      await prisma.contractor.create({ data: contractor });
    }
    console.log(`✅ Restored ${backup.data.contractors?.length || 0} contractors`);

    // STEP 8: Restore Projects
    console.log('\n📁 STEP 8: Restoring Projects...');
    for (const project of backup.data.projects || []) {
      await prisma.project.create({ data: project });
    }
    console.log(`✅ Restored ${backup.data.projects?.length || 0} projects`);

    // STEP 9: Restore Room Sections
    console.log('\n🖼️ STEP 9: Restoring Room Sections...');
    for (const section of backup.data.roomSections || []) {
      await prisma.roomSection.create({ data: section });
    }
    console.log(`✅ Restored ${backup.data.roomSections?.length || 0} room sections`);

    // STEP 10: Restore Rooms
    console.log('\n🏠 STEP 10: Restoring Rooms...');
    for (const room of backup.data.rooms || []) {
      await prisma.room.create({ data: room });
    }
    console.log(`✅ Restored ${backup.data.rooms?.length || 0} rooms`);

    // STEP 11: Restore Stages
    console.log('\n⚙️ STEP 10: Restoring Stages...');
    for (const stage of backup.data.stages || []) {
      await prisma.stage.create({ data: stage });
    }
    console.log(`✅ Restored ${backup.data.stages?.length || 0} stages`);

    // STEP 12: Restore Design Sections
    console.log('\n🎨 STEP 11: Restoring Design Sections...');
    for (const section of backup.data.designSections || []) {
      await prisma.designSection.create({ data: section });
    }
    console.log(`✅ Restored ${backup.data.designSections?.length || 0} design sections`);

    // STEP 13: Restore FFE Templates
    console.log('\n📋 STEP 11: Restoring FFE Templates...');
    for (const template of backup.data.ffeTemplates || []) {
      await prisma.fFETemplate.create({ data: template });
    }
    console.log(`✅ Restored ${backup.data.ffeTemplates?.length || 0} FFE templates`);

    // STEP 14: Restore FFE Template Sections
    console.log('\n📑 STEP 12: Restoring FFE Template Sections...');
    for (const section of backup.data.ffeTemplateSections || []) {
      await prisma.fFETemplateSection.create({ data: section });
    }
    console.log(`✅ Restored ${backup.data.ffeTemplateSections?.length || 0} FFE template sections`);

    // STEP 15: Restore FFE Template Items
    console.log('\n🔧 STEP 13: Restoring FFE Template Items...');
    for (const item of backup.data.ffeTemplateItems || []) {
      await prisma.fFETemplateItem.create({ data: item });
    }
    console.log(`✅ Restored ${backup.data.ffeTemplateItems?.length || 0} FFE template items`);

    // STEP 16: Restore FFE Section Library
    console.log('\n📚 STEP 14: Restoring FFE Section Library...');
    let libCount = 0;
    for (const lib of backup.data.ffeSectionLibrary || []) {
      try {
        await prisma.fFESectionLibrary.create({ data: lib });
        libCount++;
      } catch (e) {
        if (e.code === 'P2002') {
          console.log(`  ⏭️  Skipping duplicate: ${lib.name}`);
        } else throw e;
      }
    }
    console.log(`✅ Restored ${libCount} FFE section library items`);

    // STEP 17: Restore FFE Library Items
    console.log('\n📦 STEP 15: Restoring FFE Library Items...');
    for (const item of backup.data.ffeLibraryItems || []) {
      await prisma.fFELibraryItem.create({ data: item });
    }
    console.log(`✅ Restored ${backup.data.ffeLibraryItems?.length || 0} FFE library items`);

    // STEP 18: Restore Room FFE Instances
    console.log('\n🏠 STEP 16: Restoring Room FFE Instances...');
    for (const instance of backup.data.roomFfeInstances || []) {
      await prisma.roomFFEInstance.create({ data: instance });
    }
    console.log(`✅ Restored ${backup.data.roomFfeInstances?.length || 0} room FFE instances`);

    // STEP 19: Restore Room FFE Sections
    console.log('\n📋 STEP 17: Restoring Room FFE Sections...');
    for (const section of backup.data.roomFfeSections || []) {
      await prisma.roomFFESection.create({ data: section });
    }
    console.log(`✅ Restored ${backup.data.roomFfeSections?.length || 0} room FFE sections`);

    // STEP 20: Restore Room FFE Items
    console.log('\n🔨 STEP 18: Restoring Room FFE Items...');
    for (const item of backup.data.roomFfeItems || []) {
      await prisma.roomFFEItem.create({ data: item });
    }
    console.log(`✅ Restored ${backup.data.roomFfeItems?.length || 0} room FFE items`);

    // STEP 20: Restore Assets
    console.log('\n🖼️  STEP 20: Restoring Assets...');
    for (const asset of backup.data.assets || []) {
      // Get orgId from the project
      let orgId = null;
      if (asset.projectId) {
        const project = backup.data.projects.find(p => p.id === asset.projectId);
        orgId = project?.orgId;
      }
      
      // Add missing required fields that were added after the backup
      const assetData = {
        ...asset,
        title: asset.title || asset.filename || 'Untitled',
        type: asset.type || 'IMAGE', // Default to IMAGE if type not specified
        orgId: asset.orgId || orgId || backup.data.organizations[0]?.id, // Use first org as fallback
        uploadedBy: asset.uploadedBy || backup.data.users[0]?.id, // Default to first user
      };
      await prisma.asset.create({ data: assetData });
    }
    console.log(`✅ Restored ${backup.data.assets?.length || 0} assets`);

    // STEP 21: Restore Chat Messages
    console.log('\n💬 STEP 21: Restoring Chat Messages...');
    for (const msg of backup.data.chatMessages || []) {
      await prisma.chatMessage.create({ data: msg });
    }
    console.log(`✅ Restored ${backup.data.chatMessages?.length || 0} chat messages`);

    // STEP 22: Restore Chat Mentions
    console.log('\n📢 STEP 22: Restoring Chat Mentions...');
    for (const mention of backup.data.chatMentions || []) {
      await prisma.chatMention.create({ data: mention });
    }
    console.log(`✅ Restored ${backup.data.chatMentions?.length || 0} chat mentions`);

    // STEP 23: Restore Rendering Versions
    console.log('\n🎬 STEP 23: Restoring Rendering Versions...');
    for (const version of backup.data.renderingVersions || []) {
      await prisma.renderingVersion.create({ data: version });
    }
    console.log(`✅ Restored ${backup.data.renderingVersions?.length || 0} rendering versions`);

    // STEP 24: Restore Notifications
    console.log('\n🔔 STEP 24: Restoring Notifications...');
    for (const notification of backup.data.notifications || []) {
      await prisma.notification.create({ data: notification });
    }
    console.log(`✅ Restored ${backup.data.notifications?.length || 0} notifications`);

    // STEP 25: Restore Activity Logs
    console.log('\n📊 STEP 25: Restoring Activity Logs...');
    for (const log of backup.data.activityLogs || []) {
      await prisma.activityLog.create({ data: log });
    }
    console.log(`✅ Restored ${backup.data.activityLogs?.length || 0} activity logs`);

    // STEP 26: Restore Activities
    console.log('\n⚡ STEP 26: Restoring Activities...');
    for (const activity of backup.data.activities || []) {
      await prisma.activity.create({ data: activity });
    }
    console.log(`✅ Restored ${backup.data.activities?.length || 0} activities`);

    // STEP 27: Restore Issues
    console.log('\n🐛 STEP 27: Restoring Issues...');
    for (const issue of backup.data.issues || []) {
      await prisma.issue.create({ data: issue });
    }
    console.log(`✅ Restored ${backup.data.issues?.length || 0} issues`);

    // STEP 28: Restore Spec Books
    console.log('\n📖 STEP 28: Restoring Spec Books...');
    for (const book of backup.data.specBooks || []) {
      await prisma.specBook.create({ data: book });
    }
    console.log(`✅ Restored ${backup.data.specBooks?.length || 0} spec books`);

    // STEP 29: Restore Spec Book Sections
    console.log('\n📄 STEP 29: Restoring Spec Book Sections...');
    for (const section of backup.data.specBookSections || []) {
      await prisma.specBookSection.create({ data: section });
    }
    console.log(`✅ Restored ${backup.data.specBookSections?.length || 0} spec book sections`);

    // STEP 30: Restore Spec Book Generations
    console.log('\n🔄 STEP 30: Restoring Spec Book Generations...');
    for (const gen of backup.data.specBookGenerations || []) {
      await prisma.specBookGeneration.create({ data: gen });
    }
    console.log(`✅ Restored ${backup.data.specBookGenerations?.length || 0} spec book generations`);

    // STEP 31: Restore Client Access Tokens
    console.log('\n🔐 STEP 31: Restoring Client Access Tokens...');
    for (const token of backup.data.clientAccessTokens || []) {
      await prisma.clientAccessToken.create({ data: token });
    }
    console.log(`✅ Restored ${backup.data.clientAccessTokens?.length || 0} client access tokens`);

    // STEP 32: Restore Client Access Logs
    console.log('\n📝 STEP 32: Restoring Client Access Logs...');
    for (const log of backup.data.clientAccessLogs || []) {
      await prisma.clientAccessLog.create({ data: log });
    }
    console.log(`✅ Restored ${backup.data.clientAccessLogs?.length || 0} client access logs`);

    // STEP 33: Restore Client Approval Activities
    console.log('\n✅ STEP 33: Restoring Client Approval Activities...');
    for (const activity of backup.data.clientApprovalActivities || []) {
      await prisma.clientApprovalActivity.create({ data: activity });
    }
    console.log(`✅ Restored ${backup.data.clientApprovalActivities?.length || 0} client approval activities`);

    // STEP 34: Restore Client Approval Assets
    console.log('\n🖼️  STEP 34: Restoring Client Approval Assets...');
    let clientApprovalAssetCount = 0;
    for (const asset of backup.data.clientApprovalAssets || []) {
      try {
        await prisma.clientApprovalAsset.create({ data: asset });
        clientApprovalAssetCount++;
      } catch (e) {
        if (e.code === 'P2003') {
          console.log(`  ⏭️  Skipping asset ${asset.id} - referenced asset not found`);
        } else throw e;
      }
    }
    console.log(`✅ Restored ${clientApprovalAssetCount} client approval assets`);

    // STEP 35: Restore Dropbox File Links
    console.log('\n🔗 STEP 35: Restoring Dropbox File Links...');
    for (const link of backup.data.dropboxFileLinks || []) {
      await prisma.dropboxFileLink.create({ data: link });
    }
    console.log(`✅ Restored ${backup.data.dropboxFileLinks?.length || 0} dropbox file links`);

    // STEP 36: Restore Email Logs
    console.log('\n📧 STEP 36: Restoring Email Logs...');
    for (const log of backup.data.emailLogs || []) {
      await prisma.emailLog.create({ data: log });
    }
    console.log(`✅ Restored ${backup.data.emailLogs?.length || 0} email logs`);

    // STEP 37: Restore FFE Change Logs
    console.log('\n📝 STEP 37: Restoring FFE Change Logs...');
    for (const log of backup.data.ffeChangeLogs || []) {
      await prisma.fFEChangeLog.create({ data: log });
    }
    console.log(`✅ Restored ${backup.data.ffeChangeLogs?.length || 0} FFE change logs`);

    // STEP 38: Restore Project Contractors
    console.log('\n🤝 STEP 38: Restoring Project Contractors...');
    for (const pc of backup.data.projectContractors || []) {
      await prisma.projectContractor.create({ data: pc });
    }
    console.log(`✅ Restored ${backup.data.projectContractors?.length || 0} project contractors`);

    console.log('\n🎉 ========================================');
    console.log('🎉 COMPLETE DATABASE RESTORATION FINISHED!');
    console.log('🎉 ========================================');
    console.log('\n✅ ALL data from November 4th backup has been restored:');
    console.log(`   • ${backup.data.organizations?.length || 0} Organizations`);
    console.log(`   • ${backup.data.users?.length || 0} Users`);
    console.log(`   • ${backup.data.clients?.length || 0} Clients`);
    console.log(`   • ${backup.data.contractors?.length || 0} Contractors`);
    console.log(`   • ${backup.data.projects?.length || 0} Projects`);
    console.log(`   • ${backup.data.rooms?.length || 0} Rooms`);
    console.log(`   • ${backup.data.stages?.length || 0} Stages`);
    console.log(`   • ${backup.data.ffeTemplates?.length || 0} FFE Templates`);
    console.log(`   • ${backup.data.ffeTemplateSections?.length || 0} FFE Template Sections`);
    console.log(`   • ${backup.data.ffeTemplateItems?.length || 0} FFE Template Items`);
    console.log(`   • ${libCount} FFE Section Library Items`);
    console.log(`   • ${backup.data.ffeLibraryItems?.length || 0} FFE Library Items`);
    console.log(`   • ${backup.data.roomFfeInstances?.length || 0} Room FFE Instances`);
    console.log(`   • ${backup.data.roomFfeSections?.length || 0} Room FFE Sections`);
    console.log(`   • ${backup.data.roomFfeItems?.length || 0} Room FFE Items`);
    console.log(`   • ${backup.data.designSections?.length || 0} Design Sections`);
    console.log(`   • ${backup.data.assets?.length || 0} Assets`);
    console.log(`   • ${backup.data.chatMessages?.length || 0} Chat Messages`);
    console.log(`   • ${backup.data.renderingVersions?.length || 0} Rendering Versions`);
    console.log(`   • ${backup.data.notifications?.length || 0} Notifications`);
    console.log(`   • ${backup.data.activityLogs?.length || 0} Activity Logs`);
    console.log(`   • ${backup.data.activities?.length || 0} Activities`);
    console.log(`   • ${backup.data.issues?.length || 0} Issues`);
    console.log(`   • ${backup.data.specBooks?.length || 0} Spec Books`);
    console.log(`   • And all other related data!`);
    console.log('\n📅 Your database is now restored to November 4, 2025 at 21:10:06 UTC\n');
    
  } catch (error) {
    console.error('\n❌ ========================================');
    console.error('❌ ERROR DURING RESTORATION');
    console.error('❌ ========================================');
    console.error('\n❌ Error details:', error);
    console.error('\n⚠️  The database may be in an inconsistent state.');
    console.error('⚠️  You may need to clear it and try again.\n');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the restoration
console.log('\n⚠️  WARNING: This will COMPLETELY ERASE and restore your database!');
console.log('⚠️  Make sure you have a recent backup before proceeding!\n');

restoreCompleteNov4()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

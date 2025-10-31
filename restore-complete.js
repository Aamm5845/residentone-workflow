const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreComplete() {
  const backupPath = path.join(__dirname, 'backups', 'residentone-complete-backup-2025-10-30T17-24-37-688Z.json');
  
  console.log('🔄 Starting COMPLETE database restoration...');
  console.log(`📁 Reading backup from: ${backupPath}`);
  
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  
  try {
    // FFE Templates
    console.log('\n📋 Restoring FFE Templates...');
    for (const template of backup.data.ffeTemplates || []) {
      await prisma.fFETemplate.create({ data: template });
    }
    console.log(`✅ Restored ${backup.data.ffeTemplates?.length || 0} FFE templates`);
    
    // FFE Template Sections
    console.log('\n📑 Restoring FFE Template Sections...');
    for (const section of backup.data.ffeTemplateSections || []) {
      await prisma.fFETemplateSection.create({ data: section });
    }
    console.log(`✅ Restored ${backup.data.ffeTemplateSections?.length || 0} FFE template sections`);
    
    // FFE Template Items
    console.log('\n🔧 Restoring FFE Template Items...');
    for (const item of backup.data.ffeTemplateItems || []) {
      await prisma.fFETemplateItem.create({ data: item });
    }
    console.log(`✅ Restored ${backup.data.ffeTemplateItems?.length || 0} FFE template items`);
    
    // FFE Section Library
    console.log('\n📚 Restoring FFE Section Library...');
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
    
    // FFE Library Items
    console.log('\n📦 Restoring FFE Library Items...');
    for (const item of backup.data.ffeLibraryItems || []) {
      await prisma.fFELibraryItem.create({ data: item });
    }
    console.log(`✅ Restored ${backup.data.ffeLibraryItems?.length || 0} FFE library items`);
    
    // Room FFE Instances
    console.log('\n🏠 Restoring Room FFE Instances...');
    for (const instance of backup.data.roomFfeInstances || []) {
      await prisma.roomFFEInstance.create({ data: instance });
    }
    console.log(`✅ Restored ${backup.data.roomFfeInstances?.length || 0} room FFE instances`);
    
    // Room FFE Sections
    console.log('\n📋 Restoring Room FFE Sections...');
    for (const section of backup.data.roomFfeSections || []) {
      await prisma.roomFFESection.create({ data: section });
    }
    console.log(`✅ Restored ${backup.data.roomFfeSections?.length || 0} room FFE sections`);
    
    // Room FFE Items
    console.log('\n🔨 Restoring Room FFE Items...');
    for (const item of backup.data.roomFfeItems || []) {
      await prisma.roomFFEItem.create({ data: item });
    }
    console.log(`✅ Restored ${backup.data.roomFfeItems?.length || 0} room FFE items`);
    
    // Design Sections
    console.log('\n🎨 Restoring Design Sections...');
    for (const section of backup.data.designSections || []) {
      await prisma.designSection.create({ data: section });
    }
    console.log(`✅ Restored ${backup.data.designSections?.length || 0} design sections`);
    
    // Assets
    console.log('\n🖼️  Restoring Assets...');
    for (const asset of backup.data.assets || []) {
      await prisma.asset.create({ data: asset });
    }
    console.log(`✅ Restored ${backup.data.assets?.length || 0} assets`);
    
    // Chat Messages
    console.log('\n💬 Restoring Chat Messages...');
    for (const msg of backup.data.chatMessages || []) {
      await prisma.chatMessage.create({ data: msg });
    }
    console.log(`✅ Restored ${backup.data.chatMessages?.length || 0} chat messages`);
    
    // Chat Mentions
    console.log('\n📢 Restoring Chat Mentions...');
    for (const mention of backup.data.chatMentions || []) {
      await prisma.chatMention.create({ data: mention });
    }
    console.log(`✅ Restored ${backup.data.chatMentions?.length || 0} chat mentions`);
    
    // Rendering Versions
    console.log('\n🎬 Restoring Rendering Versions...');
    for (const version of backup.data.renderingVersions || []) {
      await prisma.renderingVersion.create({ data: version });
    }
    console.log(`✅ Restored ${backup.data.renderingVersions?.length || 0} rendering versions`);
    
    // Notifications
    console.log('\n🔔 Restoring Notifications...');
    for (const notification of backup.data.notifications || []) {
      await prisma.notification.create({ data: notification });
    }
    console.log(`✅ Restored ${backup.data.notifications?.length || 0} notifications`);
    
    // Activity Logs
    console.log('\n📊 Restoring Activity Logs...');
    for (const log of backup.data.activityLogs || []) {
      await prisma.activityLog.create({ data: log });
    }
    console.log(`✅ Restored ${backup.data.activityLogs?.length || 0} activity logs`);
    
    // Activities
    console.log('\n⚡ Restoring Activities...');
    for (const activity of backup.data.activities || []) {
      await prisma.activity.create({ data: activity });
    }
    console.log(`✅ Restored ${backup.data.activities?.length || 0} activities`);
    
    // Issues
    console.log('\n🐛 Restoring Issues...');
    for (const issue of backup.data.issues || []) {
      await prisma.issue.create({ data: issue });
    }
    console.log(`✅ Restored ${backup.data.issues?.length || 0} issues`);
    
    // Spec Books
    console.log('\n📖 Restoring Spec Books...');
    for (const book of backup.data.specBooks || []) {
      await prisma.specBook.create({ data: book });
    }
    console.log(`✅ Restored ${backup.data.specBooks?.length || 0} spec books`);
    
    // Spec Book Sections
    console.log('\n📄 Restoring Spec Book Sections...');
    for (const section of backup.data.specBookSections || []) {
      await prisma.specBookSection.create({ data: section });
    }
    console.log(`✅ Restored ${backup.data.specBookSections?.length || 0} spec book sections`);
    
    // Spec Book Generations
    console.log('\n🔄 Restoring Spec Book Generations...');
    for (const gen of backup.data.specBookGenerations || []) {
      await prisma.specBookGeneration.create({ data: gen });
    }
    console.log(`✅ Restored ${backup.data.specBookGenerations?.length || 0} spec book generations`);
    
    // Client Access Tokens
    console.log('\n🔐 Restoring Client Access Tokens...');
    for (const token of backup.data.clientAccessTokens || []) {
      await prisma.clientAccessToken.create({ data: token });
    }
    console.log(`✅ Restored ${backup.data.clientAccessTokens?.length || 0} client access tokens`);
    
    // Client Access Logs
    console.log('\n📝 Restoring Client Access Logs...');
    for (const log of backup.data.clientAccessLogs || []) {
      await prisma.clientAccessLog.create({ data: log });
    }
    console.log(`✅ Restored ${backup.data.clientAccessLogs?.length || 0} client access logs`);
    
    // Client Approval Activities
    console.log('\n✅ Restoring Client Approval Activities...');
    for (const activity of backup.data.clientApprovalActivities || []) {
      await prisma.clientApprovalActivity.create({ data: activity });
    }
    console.log(`✅ Restored ${backup.data.clientApprovalActivities?.length || 0} client approval activities`);
    
    // Client Approval Assets
    console.log('\n🖼️  Restoring Client Approval Assets...');
    for (const asset of backup.data.clientApprovalAssets || []) {
      await prisma.clientApprovalAsset.create({ data: asset });
    }
    console.log(`✅ Restored ${backup.data.clientApprovalAssets?.length || 0} client approval assets`);
    
    // Dropbox File Links
    console.log('\n🔗 Restoring Dropbox File Links...');
    for (const link of backup.data.dropboxFileLinks || []) {
      await prisma.dropboxFileLink.create({ data: link });
    }
    console.log(`✅ Restored ${backup.data.dropboxFileLinks?.length || 0} dropbox file links`);
    
    // Email Logs
    console.log('\n📧 Restoring Email Logs...');
    for (const log of backup.data.emailLogs || []) {
      await prisma.emailLog.create({ data: log });
    }
    console.log(`✅ Restored ${backup.data.emailLogs?.length || 0} email logs`);
    
    // FFE Change Logs
    console.log('\n📝 Restoring FFE Change Logs...');
    for (const log of backup.data.ffeChangeLogs || []) {
      await prisma.fFEChangeLog.create({ data: log });
    }
    console.log(`✅ Restored ${backup.data.ffeChangeLogs?.length || 0} FFE change logs`);
    
    // Project Contractors
    console.log('\n🤝 Restoring Project Contractors...');
    for (const pc of backup.data.projectContractors || []) {
      await prisma.projectContractor.create({ data: pc });
    }
    console.log(`✅ Restored ${backup.data.projectContractors?.length || 0} project contractors`);
    
    console.log('\n🎉 COMPLETE DATABASE RESTORATION FINISHED!');
    console.log('\n✅ All FFE templates, items, and settings have been restored!');
    
  } catch (error) {
    console.error('\n❌ Error during restoration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

restoreComplete()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

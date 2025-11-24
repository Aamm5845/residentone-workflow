const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Complete model mapping for ALL tables
const MODEL_MAP = {
  'organizations': 'organization',
  'users': 'user',
  'clients': 'client',
  'contractors': 'contractor',
  'projects': 'project',
  'projectContractors': 'projectContractor',
  'roomSections': 'roomSection',
  'rooms': 'room',
  'stages': 'stage',
  'designSections': 'designSection',
  'assets': 'asset',
  'assetPins': 'assetPin',
  'assetTags': 'assetTag',
  'clientAccessTokens': 'clientAccessToken',
  'clientAccessLogs': 'clientAccessLog',
  'comments': 'comment',
  'commentLikes': 'commentLike',
  'commentPins': 'commentPin',
  'commentTags': 'commentTag',
  'chatMessages': 'chatMessage',
  'chatMentions': 'chatMention',
  'chatMessageReactions': 'chatMessageReaction',
  'notifications': 'notification',
  'notificationSends': 'notificationSend',
  'activityLogs': 'activityLog',
  'activities': 'activity',
  'ffeChangeLogs': 'fFEChangeLog',
  'ffeTemplates': 'fFETemplate',
  'ffeTemplateSections': 'fFETemplateSection',
  'ffeTemplateItems': 'fFETemplateItem',
  'ffeItems': 'fFEItem',
  'ffeAuditLogs': 'fFEAuditLog',
  'ffeBathroomStates': 'fFEBathroomState',
  'ffeGeneralSettings': 'fFEGeneralSettings',
  'ffeLibraryItems': 'fFELibraryItem',
  'ffeSectionLibrary': 'fFESectionLibrary',
  'roomFfeInstances': 'roomFFEInstance',
  'roomFfeSections': 'roomFFESection',
  'roomFfeItems': 'roomFFEItem',
  'renderingVersions': 'renderingVersion',
  'renderingNotes': 'renderingNote',
  'issues': 'issue',
  'issueComments': 'issueComment',
  'drawingChecklistItems': 'drawingChecklistItem',
  'specBooks': 'specBook',
  'specBookSections': 'specBookSection',
  'specBookGenerations': 'specBookGeneration',
  'dropboxFileLinks': 'dropboxFileLink',
  'clientApprovals': 'clientApproval',
  'clientApprovalAssets': 'clientApprovalAsset',
  'clientApprovalActivities': 'clientApprovalActivity',
  'clientApprovalEmailLogs': 'clientApprovalEmailLog',
  'floorplanApprovalVersions': 'floorplanApprovalVersion',
  'floorplanApprovalAssets': 'floorplanApprovalAsset',
  'floorplanApprovalActivities': 'floorplanApprovalActivity',
  'floorplanApprovalEmailLogs': 'floorplanApprovalEmailLog',
  'emailLogs': 'emailLog',
  'approvals': 'approval',
  'checklistItems': 'checklistItem',
  'tags': 'tag',
  'tasks': 'task',
  'projectUpdates': 'projectUpdate',
  'projectUpdateTasks': 'projectUpdateTask',
  'projectUpdatePhotos': 'projectUpdatePhoto',
  'projectUpdateDocuments': 'projectUpdateDocument',
  'projectUpdateMessages': 'projectUpdateMessage',
  'projectUpdateActivities': 'projectUpdateActivity',
  'projectMilestones': 'projectMilestone',
  'contractorAssignments': 'contractorAssignment',
  'smsConversations': 'smsConversation',
  'roomPresets': 'roomPreset',
  'cadPreferences': 'cADPreference',
  'projectCadDefaults': 'projectCADDefault',
  'cadLayoutCache': 'cADLayoutCache',
  'accounts': 'account',
  'sessions': 'session',
  'verificationTokens': 'verificationToken',
  'passwordResetTokens': 'passwordResetToken',
  'userSessions': 'userSession',
  'phaseAccessTokens': 'phaseAccessToken',
  'phaseAccessLogs': 'phaseAccessLog'
};

// Clean record by removing nested arrays
function cleanRecord(tableName, record) {
  const cleaned = { ...record };
  
  // Remove nested arrays (relations)
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
    // Add missing required fields
    if (!cleaned.type) {
      // Infer type from mimeType or filename
      if (cleaned.mimeType) {
        if (cleaned.mimeType.includes('image')) cleaned.type = 'IMAGE';
        else if (cleaned.mimeType.includes('pdf')) cleaned.type = 'PDF';
        else cleaned.type = 'DOCUMENT';
      } else {
        cleaned.type = 'IMAGE';
      }
    }
    if (!cleaned.uploadedBy) {
      // Use first user from backup as uploader
      cleaned.uploadedBy = 'cmg02ida100023kfkm5lhsjyv'; // Aaron's ID
    }
    if (!cleaned.orgId) {
      cleaned.orgId = 'cmg02icv200003kfkqs2jizja'; // Meisner Interiors
    }
    if (!cleaned.updatedAt) {
      cleaned.updatedAt = cleaned.createdAt || new Date().toISOString();
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
  console.log(`  - By: ${backupFile.created_by.email}`);
  
  console.log('\n🔄 Starting COMPLETE restoration...\n');
  
  try {
    const restoreOrder = Object.keys(MODEL_MAP);
    
    const stats = {
      success: 0,
      skipped: 0,
      duplicates: 0
    };
    
    for (const tableName of restoreOrder) {
      if (backup[tableName] && backup[tableName].length > 0) {
        const modelName = MODEL_MAP[tableName];
        console.log(`📥 ${tableName} (${backup[tableName].length})...`);
        
        let successCount = 0;
        let skipCount = 0;
        let dupCount = 0;
        
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
            if (error.message.includes('Unique constraint')) {
              dupCount++;
            } else {
              if (successCount === 0 && dupCount === 0 && skipCount === 0) {
                console.log(`  ⚠️  ${error.message.split('\\n')[0]}`);
              }
            }
          }
        }
        
        if (successCount > 0) console.log(`  ✅ ${successCount} new`);
        if (dupCount > 0) console.log(`  ⏭️  ${dupCount} already exist`);
        if (skipCount > 0) console.log(`  ⏭️  ${skipCount} skipped`);
        
        stats.success += successCount;
        stats.skipped += skipCount;
        stats.duplicates += dupCount;
      }
    }
    
    console.log('\\n✅ Restoration complete! Verifying...\\n');
    
    // Comprehensive verification
    const counts = {
      organizations: await prisma.organization.count(),
      users: await prisma.user.count(),
      clients: await prisma.client.count(),
      contractors: await prisma.contractor.count(),
      projects: await prisma.project.count(),
      rooms: await prisma.room.count(),
      stages: await prisma.stage.count(),
      designSections: await prisma.designSection.count(),
      assets: await prisma.asset.count(),
      ffeTemplates: await prisma.fFETemplate.count(),
      ffeTemplateSections: await prisma.fFETemplateSection.count(),
      ffeTemplateItems: await prisma.fFETemplateItem.count(),
      roomFfeInstances: await prisma.roomFFEInstance.count(),
      roomFfeSections: await prisma.roomFFESection.count(),
      roomFfeItems: await prisma.roomFFEItem.count(),
      ffeChangeLogs: await prisma.fFEChangeLog.count(),
      chatMessages: await prisma.chatMessage.count(),
      activityLogs: await prisma.activityLog.count(),
      activities: await prisma.activity.count(),
      renderingVersions: await prisma.renderingVersion.count(),
      specBooks: await prisma.specBook.count(),
      specBookSections: await prisma.specBookSection.count(),
      specBookGenerations: await prisma.specBookGeneration.count(),
      issues: await prisma.issue.count(),
      dropboxFileLinks: await prisma.dropboxFileLink.count(),
      emailLogs: await prisma.emailLog.count(),
      clientApprovalActivities: await prisma.clientApprovalActivity.count(),
      clientApprovalAssets: await prisma.clientApprovalAsset.count()
    };
    
    console.log('📊 Complete Database Status:\\n');
    for (const [key, value] of Object.entries(counts)) {
      console.log(`  ${key}: ${value}`);
    }
    
    console.log(`\\n📊 Restore Summary:`);
    console.log(`  - New records added: ${stats.success}`);
    console.log(`  - Already existed: ${stats.duplicates}`);
    console.log(`  - Skipped: ${stats.skipped}`);
    
    console.log('\\n✅ DATABASE FULLY RESTORED! 🎉\\n');
    
  } catch (error) {
    console.error('\\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreDatabase();

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function finalCheck() {
  try {
    // Read backup file
    const backupPath = 'C:\\Users\\ADMIN\\Desktop\\residentone-workflow\\backups\\residentone-complete-backup-2025-10-30T17-24-37-688Z.json';
    const backupFile = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const backup = backupFile.data || backupFile;

    console.log('\n📊 FINAL DATABASE RESTORATION CHECK\n');
    console.log('='.repeat(60) + '\n');

    let totalInBackup = 0;
    let totalInDb = 0;
    let mismatches = [];

    // All Prisma models
    const models = [
      'activities',
      'activityLogs',
      'assets',
      'chatMentions',
      'chatMessages',
      'clients',
      'clientAccessLogs',
      'clientAccessTokens',
      'clientApprovalActivities',
      'clientApprovalAssets',
      'contractors',
      'designSections',
      'dropboxFileLinks',
      'emailLogs',
      'ffeChangeLogs',
      'ffeSectionLibrary',
      'ffeTemplateItems',
      'ffeTemplateSections',
      'ffeTemplates',
      'issues',
      'notifications',
      'organizations',
      'projectContractors',
      'projects',
      'renderingVersions',
      'roomFfeInstances',
      'roomFfeItems',
      'roomFfeSections',
      'roomSections',
      'rooms',
      'specBookGenerations',
      'specBookSections',
      'specBooks',
      'stages',
      'users',
    ];

    for (const model of models) {
      const backupCount = backup[model]?.length || 0;
      
      if (backupCount === 0) continue;

      try {
        const dbCount = await prisma[model].count();
        totalInBackup += backupCount;
        totalInDb += dbCount;

        const match = dbCount === backupCount;
        const icon = match ? '✅' : '❌';
        
        console.log(`${icon} ${model.padEnd(30)} ${dbCount.toString().padStart(4)}/${backupCount.toString().padStart(4)}`);

        if (!match) {
          mismatches.push({ model, backupCount, dbCount, missing: backupCount - dbCount });
        }
      } catch (error) {
        console.log(`⚠️  ${model.padEnd(30)} ERROR: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\nTotal records in backup: ${totalInBackup}`);
    console.log(`Total records in database: ${totalInDb}`);

    if (mismatches.length === 0) {
      console.log('\n🎉 ✨ ALL DATA FULLY RESTORED! ✨ 🎉\n');
    } else {
      console.log('\n❌ MISMATCHES FOUND:\n');
      mismatches.forEach(m => {
        console.log(`  - ${m.model}: Missing ${m.missing} records (${m.dbCount}/${m.backupCount})`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

finalCheck();

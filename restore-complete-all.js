const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function restoreComplete() {
  try {
    // Read backup file
    const backupPath = 'C:\\Users\\ADMIN\\Desktop\\residentone-workflow\\backups\\residentone-complete-backup-2025-10-30T17-24-37-688Z.json';
    const backupFile = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const backup = backupFile.data;

    console.log('\n🔄 Restoring ALL missing data...\n');

    // Map of backup keys to Prisma model names
    const tableMap = {
      'assets': 'asset',
      'chatMessages': 'chatMessage',
      'chatMentions': 'chatMention',
      'notifications': 'notification',
      'issues': 'issue',
      'activities': 'activity',
      'activityLogs': 'activityLog',
      'renderingVersions': 'renderingVersion',
      'specBooks': 'specBook',
      'specBookSections': 'specBookSection',
      'specBookGenerations': 'specBookGeneration',
      'designSections': 'designSection',
      'dropboxFileLinks': 'dropboxFileLink',
      'emailLogs': 'emailLog',
      'projectContractors': 'projectContractor',
      'clientAccessTokens': 'clientAccessToken',
      'clientAccessLogs': 'clientAccessLog',
      'clientApprovalActivities': 'clientApprovalActivity',
      'clientApprovalAssets': 'clientApprovalAsset',
    };

    for (const [backupKey, modelName] of Object.entries(tableMap)) {
      const records = backup[backupKey];
      
      if (!records || records.length === 0) {
        console.log(`⏭️  Skipping ${backupKey} (no records in backup)`);
        continue;
      }

      try {
        // Check current count
        const currentCount = await prisma[modelName].count();
        
        if (currentCount === records.length) {
          console.log(`✅ ${backupKey}: Already restored (${currentCount}/${records.length})`);
          continue;
        }

        // Restore records
        let added = 0;
        let skipped = 0;
        let errors = 0;

        for (const record of records) {
          try {
            // Remove nested relations from users records if present
            const cleanRecord = { ...record };
            if (cleanRecord.accounts) delete cleanRecord.accounts;
            if (cleanRecord.sessions) delete cleanRecord.sessions;
            
            await prisma[modelName].create({
              data: cleanRecord
            });
            added++;
          } catch (error) {
            // Skip duplicates
            if (error.code === 'P2002') {
              skipped++;
            } else {
              errors++;
              if (errors <= 3) {
                console.log(`  ⚠️  Error adding ${backupKey} record:`, error.message.substring(0, 100));
              }
            }
          }
        }

        const finalCount = await prisma[modelName].count();
        const icon = finalCount === records.length ? '✅' : '⚠️';
        console.log(`${icon} ${backupKey}: Added ${added}, Skipped ${skipped}, Errors ${errors} | Total: ${finalCount}/${records.length}`);

      } catch (error) {
        console.log(`❌ ${backupKey}: Error - ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 RESTORATION COMPLETE!\n');
    console.log('Run "node quick-db-check.js" to verify all data.\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreComplete();

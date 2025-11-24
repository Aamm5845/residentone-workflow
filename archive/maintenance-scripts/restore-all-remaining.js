const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function restoreAllRemaining() {
  try {
    // Read backup file
    const backupPath = 'C:\\Users\\ADMIN\\Desktop\\residentone-workflow\\backups\\residentone-complete-backup-2025-10-30T17-24-37-688Z.json';
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    console.log('\n🔄 Restoring all remaining tables...\n');

    // List of tables to restore (all tables with data in backup)
    const tablesToRestore = [
      'activities',
      'activityLogs',
      'assets',
      'chatMentions',
      'chatMessages',
      'clientAccessLogs',
      'clientAccessTokens',
      'clientApprovalActivities',
      'clientApprovalAssets',
      'designSections',
      'dropboxFileLinks',
      'emailLogs',
      'issues',
      'notifications',
      'projectContractors',
      'renderingVersions',
      'specBookGenerations',
      'specBookSections',
      'specBooks',
    ];

    for (const table of tablesToRestore) {
      const records = backup[table];
      
      if (!records || records.length === 0) {
        console.log(`⏭️  Skipping ${table} (no records)`);
        continue;
      }

      try {
        // Check current count
        const currentCount = await prisma[table].count();
        
        if (currentCount === records.length) {
          console.log(`✅ ${table}: Already restored (${currentCount})`);
          continue;
        }

        // Restore records
        let added = 0;
        let skipped = 0;

        for (const record of records) {
          try {
            await prisma[table].create({
              data: record
            });
            added++;
          } catch (error) {
            // Skip duplicates
            if (error.code === 'P2002') {
              skipped++;
            } else {
              console.log(`  ⚠️  Error adding ${table} record:`, error.message);
            }
          }
        }

        console.log(`✅ ${table}: Added ${added}, Skipped ${skipped}, Total now: ${await prisma[table].count()}/${records.length}`);

      } catch (error) {
        console.log(`❌ ${table}: Error - ${error.message}`);
      }
    }

    console.log('\n🎉 RESTORATION COMPLETE!\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreAllRemaining();

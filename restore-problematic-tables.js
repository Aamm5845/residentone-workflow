const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function restoreProblematic() {
  try {
    // Read backup file
    const backupPath = 'C:\\Users\\ADMIN\\Desktop\\residentone-workflow\\backups\\residentone-complete-backup-2025-10-30T17-24-37-688Z.json';
    const backupFile = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const backup = backupFile.data;

    console.log('\n🔄 Restoring problematic tables with field mapping...\n');

    // Get the first user as fallback uploadedBy
    const firstUser = await prisma.user.findFirst();
    const firstOrg = await prisma.organization.findFirst();

    // Restore assets
    console.log('📸 Restoring assets...');
    let assetsAdded = 0;
    let assetsSkipped = 0;
    let assetsErrors = 0;

    for (const asset of backup.assets || []) {
      try {
        await prisma.asset.create({
          data: {
            id: asset.id,
            title: asset.filename || 'Untitled',
            filename: asset.filename,
            url: asset.url,
            type: 'IMAGE', // Assuming all are images based on mimeType
            size: asset.size,
            mimeType: asset.mimeType,
            uploadedBy: firstUser.id,
            orgId: firstOrg.id,
            projectId: asset.projectId,
            createdAt: asset.createdAt,
          }
        });
        assetsAdded++;
      } catch (error) {
        if (error.code === 'P2002') {
          assetsSkipped++;
        } else {
          assetsErrors++;
          if (assetsErrors <= 2) {
            console.log(`  ⚠️  Error:`, error.message.substring(0, 100));
          }
        }
      }
    }

    console.log(`✅ Assets: Added ${assetsAdded}, Skipped ${assetsSkipped}, Errors ${assetsErrors} | Total: ${await prisma.asset.count()}/10`);

    // Restore email logs
    console.log('\n📧 Restoring email logs...');
    let emailsAdded = 0;
    let emailsSkipped = 0;
    let emailsErrors = 0;

    for (const email of backup.emailLogs || []) {
      try {
        // EmailLog requires versionId - check if that renderingVersion exists
        const versionExists = await prisma.renderingVersion.findUnique({
          where: { id: email.versionId }
        });

        if (!versionExists) {
          emailsSkipped++;
          continue;
        }

        await prisma.emailLog.create({
          data: email
        });
        emailsAdded++;
      } catch (error) {
        if (error.code === 'P2002') {
          emailsSkipped++;
        } else {
          emailsErrors++;
          if (emailsErrors <= 2) {
            console.log(`  ⚠️  Error:`, error.message.substring(0, 100));
          }
        }
      }
    }

    console.log(`✅ Email Logs: Added ${emailsAdded}, Skipped ${emailsSkipped}, Errors ${emailsErrors} | Total: ${await prisma.emailLog.count()}/2`);

    // Restore client approval activities
    console.log('\n👤 Restoring client approval activities...');
    let activitiesAdded = 0;
    let activitiesSkipped = 0;
    let activitiesErrors = 0;

    for (const activity of backup.clientApprovalActivities || []) {
      try {
        // Check if related clientAccessToken exists
        const tokenExists = await prisma.clientAccessToken.findUnique({
          where: { id: activity.accessTokenId }
        });

        if (!tokenExists) {
          activitiesSkipped++;
          continue;
        }

        await prisma.clientApprovalActivity.create({
          data: activity
        });
        activitiesAdded++;
      } catch (error) {
        if (error.code === 'P2002') {
          activitiesSkipped++;
        } else {
          activitiesErrors++;
          if (activitiesErrors <= 2) {
            console.log(`  ⚠️  Error:`, error.message.substring(0, 100));
          }
        }
      }
    }

    console.log(`✅ Client Approval Activities: Added ${activitiesAdded}, Skipped ${activitiesSkipped}, Errors ${activitiesErrors} | Total: ${await prisma.clientApprovalActivity.count()}/1`);

    // Restore client approval assets
    console.log('\n🖼️  Restoring client approval assets...');
    let assetsActivityAdded = 0;
    let assetsActivitySkipped = 0;
    let assetsActivityErrors = 0;

    for (const assetActivity of backup.clientApprovalAssets || []) {
      try {
        // Check if related asset and activity exist
        const assetExists = await prisma.asset.findUnique({
          where: { id: assetActivity.assetId }
        });
        const activityExists = await prisma.clientApprovalActivity.findUnique({
          where: { id: assetActivity.activityId }
        });

        if (!assetExists || !activityExists) {
          assetsActivitySkipped++;
          continue;
        }

        await prisma.clientApprovalAsset.create({
          data: assetActivity
        });
        assetsActivityAdded++;
      } catch (error) {
        if (error.code === 'P2002') {
          assetsActivitySkipped++;
        } else {
          assetsActivityErrors++;
          if (assetsActivityErrors <= 2) {
            console.log(`  ⚠️  Error:`, error.message.substring(0, 100));
          }
        }
      }
    }

    console.log(`✅ Client Approval Assets: Added ${assetsActivityAdded}, Skipped ${assetsActivitySkipped}, Errors ${assetsActivityErrors} | Total: ${await prisma.clientApprovalAsset.count()}/1`);

    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 PROBLEMATIC TABLES RESTORED!\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreProblematic();

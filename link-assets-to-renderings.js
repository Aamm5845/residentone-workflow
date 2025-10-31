const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function linkAssets() {
  try {
    console.log('\n🔗 Linking assets to rendering versions...\n');

    // Get all rendering versions with their stage info
    const versions = await prisma.renderingVersion.findMany({
      include: {
        stage: {
          include: {
            room: {
              select: {
                id: true,
                name: true,
                type: true
              }
            }
          }
        }
      }
    });

    // Get all assets
    const assets = await prisma.asset.findMany({
      where: {
        renderingVersionId: null
      }
    });

    console.log(`Found ${versions.length} rendering versions`);
    console.log(`Found ${assets.length} unlinked assets\n`);

    const updates = [];

    // Match assets to versions based on filename patterns
    for (const asset of assets) {
      const filename = asset.filename?.toUpperCase() || '';
      
      let matchedVersion = null;

      // Match by room name in filename
      for (const version of versions) {
        const roomType = version.stage?.room?.type || '';
        const roomName = version.stage?.room?.name || '';
        
        // Check if filename contains room identifiers
        if (filename.includes('KITCHEN') && roomType === 'KITCHEN') {
          matchedVersion = version;
          break;
        } else if (filename.includes('DINING') && roomType === 'DINING_ROOM') {
          matchedVersion = version;
          break;
        } else if (filename.includes('ENTRANCE') && roomType === 'ENTRANCE') {
          matchedVersion = version;
          break;
        } else if (filename.includes('MASTER_BATHROOM') && roomType === 'MASTER_BATHROOM') {
          matchedVersion = version;
          break;
        } else if (filename.includes('GIRLS') && roomName.includes('Girls')) {
          matchedVersion = version;
          break;
        } else if (filename.includes('GUEST') && roomName.includes('Guest')) {
          matchedVersion = version;
          break;
        } else if (filename.includes('POWDER') && roomType === 'POWDER_ROOM') {
          matchedVersion = version;
          break;
        }
      }

      if (matchedVersion) {
        updates.push({
          assetId: asset.id,
          assetFilename: asset.filename,
          versionId: matchedVersion.id,
          roomName: matchedVersion.stage?.room?.name,
          roomType: matchedVersion.stage?.room?.type,
          stageId: matchedVersion.stageId
        });
      } else {
        console.log(`⚠️  No match found for: ${asset.filename}`);
      }
    }

    console.log(`\n📊 Matched ${updates.length} assets to rendering versions\n`);

    // Apply updates
    for (const update of updates) {
      await prisma.asset.update({
        where: { id: update.assetId },
        data: {
          renderingVersionId: update.versionId,
          stageId: update.stageId,
          roomId: update.stageId ? (await prisma.stage.findUnique({ 
            where: { id: update.stageId },
            select: { roomId: true }
          }))?.roomId : null
        }
      });

      console.log(`✅ ${update.assetFilename}`);
      console.log(`   → ${update.roomName || update.roomType}`);
    }

    console.log(`\n🎉 Successfully linked ${updates.length} assets!\n`);

    // Verify
    const linkedCount = await prisma.asset.count({
      where: {
        renderingVersionId: { not: null }
      }
    });

    console.log(`Total assets with renderingVersionId: ${linkedCount}\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

linkAssets();

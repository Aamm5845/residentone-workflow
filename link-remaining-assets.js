const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function linkRemaining() {
  try {
    console.log('\n🔗 Linking remaining assets...\n');

    // Get unlinked assets
    const unlinkedAssets = await prisma.asset.findMany({
      where: {
        renderingVersionId: null
      }
    });

    console.log('Unlinked assets:');
    unlinkedAssets.forEach(a => {
      console.log(`  - ${a.filename} (ID: ${a.id})`);
    });

    // Get Kitchen rendering version
    const kitchenVersion = await prisma.renderingVersion.findFirst({
      where: {
        stage: {
          room: {
            type: 'KITCHEN'
          }
        }
      },
      include: {
        stage: {
          include: {
            room: true
          }
        }
      }
    });

    if (!kitchenVersion) {
      console.log('\n⚠️  No Kitchen rendering version found');
      return;
    }

    console.log(`\n✅ Found Kitchen version for room: ${kitchenVersion.stage.room.name}`);
    console.log(`   Version ID: ${kitchenVersion.id}`);
    console.log(`   Stage ID: ${kitchenVersion.stageId}`);
    console.log(`   Room ID: ${kitchenVersion.stage.roomId}`);

    // Link both assets to Kitchen
    console.log('\nLinking assets to Kitchen...\n');

    for (const asset of unlinkedAssets) {
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          renderingVersionId: kitchenVersion.id,
          stageId: kitchenVersion.stageId,
          roomId: kitchenVersion.stage.roomId
        }
      });

      console.log(`✅ Linked ${asset.filename} to Kitchen`);
    }

    // Verify
    console.log('\n📊 Final counts:');
    const totalLinked = await prisma.asset.count({
      where: {
        renderingVersionId: { not: null }
      }
    });
    console.log(`Total assets with renderingVersionId: ${totalLinked}/10\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

linkRemaining();

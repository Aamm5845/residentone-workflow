const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRenderingAssets() {
  try {
    console.log('\n🎨 Checking Rendering Versions and Assets...\n');

    const versions = await prisma.renderingVersion.findMany({
      include: {
        assets: true,
        stage: {
          include: {
            room: {
              select: {
                name: true,
                type: true,
                project: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log(`Found ${versions.length} rendering versions\n`);

    for (const version of versions) {
      console.log('─'.repeat(60));
      console.log(`Version ${version.version} - ${version.status}`);
      console.log(`Project: ${version.stage?.room?.project?.name || 'N/A'}`);
      console.log(`Room: ${version.stage?.room?.name || 'N/A'}`);
      console.log(`Stage ID: ${version.stageId}`);
      console.log(`Assets linked: ${version.assets?.length || 0}`);
      
      if (version.assets && version.assets.length > 0) {
        console.log('\nAssets:');
        version.assets.forEach((asset, i) => {
          console.log(`  ${i + 1}. ${asset.title || asset.filename || 'Untitled'}`);
          console.log(`     URL: ${asset.url}`);
        });
      } else {
        console.log('⚠️  No assets linked to this version');
      }
      console.log('');
    }

    // Check if there are any assets that should be linked to rendering versions
    console.log('\n📸 Checking all assets...\n');
    const allAssets = await prisma.asset.findMany({
      select: {
        id: true,
        title: true,
        filename: true,
        url: true,
        renderingVersionId: true,
        stageId: true,
        roomId: true,
        projectId: true
      }
    });

    console.log(`Total assets in database: ${allAssets.length}\n`);
    
    const assetsWithRenderingVersion = allAssets.filter(a => a.renderingVersionId);
    const assetsWithoutRenderingVersion = allAssets.filter(a => !a.renderingVersionId);

    console.log(`Assets with renderingVersionId: ${assetsWithRenderingVersion.length}`);
    console.log(`Assets without renderingVersionId: ${assetsWithoutRenderingVersion.length}\n`);

    if (assetsWithoutRenderingVersion.length > 0) {
      console.log('Assets NOT linked to rendering versions:');
      assetsWithoutRenderingVersion.forEach((asset, i) => {
        console.log(`  ${i + 1}. ${asset.filename || 'Untitled'}`);
        console.log(`     ProjectId: ${asset.projectId || 'N/A'}`);
        console.log(`     RoomId: ${asset.roomId || 'N/A'}`);
        console.log(`     StageId: ${asset.stageId || 'N/A'}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRenderingAssets();

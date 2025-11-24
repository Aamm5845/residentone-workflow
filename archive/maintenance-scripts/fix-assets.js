const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAssets() {
  try {
    console.log('🔧 Fixing asset relationships...\n');
    
    const assets = await prisma.asset.findMany();
    
    for (const asset of assets) {
      // Extract roomId from URL
      const roomMatch = asset.url.match(/\/rooms\/([a-z0-9]+)\//);
      const roomId = roomMatch ? roomMatch[1] : null;
      
      if (roomId) {
        // Verify room exists
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        
        if (room) {
          // Find the 3D Rendering stage for this room
          const renderingStage = await prisma.stage.findFirst({
            where: {
              roomId: roomId,
              type: 'THREE_D'
            }
          });
          
          // Find or create rendering version
          let renderingVersion = await prisma.renderingVersion.findFirst({
            where: {
              roomId: roomId,
              stageId: renderingStage?.id
            }
          });
          
          const updates = {
            roomId: roomId
          };
          
          if (renderingStage) {
            updates.stageId = renderingStage.id;
          }
          
          if (renderingVersion) {
            updates.renderingVersionId = renderingVersion.id;
          }
          
          await prisma.asset.update({
            where: { id: asset.id },
            data: updates
          });
          
          console.log(`✅ Fixed: ${asset.filename}`);
          console.log(`   - Room: ${room.name || room.type}`);
          console.log(`   - Stage: ${renderingStage ? 'Found' : 'Not found'}`);
          console.log(`   - RenderingVersion: ${renderingVersion ? renderingVersion.version : 'Not found'}`);
          console.log('');
        } else {
          console.log(`⚠️  Room not found for: ${asset.filename}`);
        }
      } else {
        console.log(`⚠️  No room in URL: ${asset.filename}`);
      }
    }
    
    console.log('\n✅ Asset relationships fixed!');
    
    // Verify
    const fixed = await prisma.asset.count({
      where: { roomId: { not: null } }
    });
    
    console.log(`\n📊 Result: ${fixed}/${assets.length} assets now have room relationships`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixAssets();

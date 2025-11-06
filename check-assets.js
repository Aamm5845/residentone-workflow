const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAssets() {
  try {
    console.log('📷 CHECKING ASSETS...\n');
    
    const assets = await prisma.asset.findMany({
      select: {
        id: true,
        title: true,
        filename: true,
        type: true,
        projectId: true,
        roomId: true,
        stageId: true,
        sectionId: true,
        renderingVersionId: true,
        ffeItemId: true
      }
    });
    
    console.log(`Total assets: ${assets.length}\n`);
    
    assets.forEach((asset, i) => {
      console.log(`${i + 1}. ${asset.filename || asset.title}`);
      console.log(`   - Type: ${asset.type}`);
      console.log(`   - Project: ${asset.projectId || 'NONE'}`);
      console.log(`   - Room: ${asset.roomId || 'NONE'}`);
      console.log(`   - Stage: ${asset.stageId || 'NONE'}`);
      console.log(`   - Section: ${asset.sectionId || 'NONE'}`);
      console.log(`   - RenderingVersion: ${asset.renderingVersionId || 'NONE'}`);
      console.log(`   - FFEItem: ${asset.ffeItemId || 'NONE'}`);
      console.log('');
    });
    
    console.log('\n📊 ASSET RELATIONSHIPS:');
    console.log(`  - With projectId: ${assets.filter(a => a.projectId).length}`);
    console.log(`  - With roomId: ${assets.filter(a => a.roomId).length}`);
    console.log(`  - With stageId: ${assets.filter(a => a.stageId).length}`);
    console.log(`  - With renderingVersionId: ${assets.filter(a => a.renderingVersionId).length}`);
    console.log(`  - With NO relationships: ${assets.filter(a => !a.roomId && !a.stageId && !a.renderingVersionId && !a.sectionId && !a.ffeItemId).length}`);
    
    // Check rendering versions
    console.log('\n\n🎨 CHECKING RENDERING VERSIONS...\n');
    const renderingVersions = await prisma.renderingVersion.findMany({
      include: {
        Asset: true,
        Room: {
          select: {
            name: true,
            type: true
          }
        }
      }
    });
    
    console.log(`Total rendering versions: ${renderingVersions.length}\n`);
    renderingVersions.forEach((rv, i) => {
      console.log(`${i + 1}. Version ${rv.version} - ${rv.Room.name || rv.Room.type}`);
      console.log(`   - Status: ${rv.status}`);
      console.log(`   - Assets: ${rv.Asset.length}`);
      if (rv.Asset.length > 0) {
        rv.Asset.forEach(a => console.log(`     • ${a.filename || a.title}`));
      }
      console.log('');
    });
    
    // Check projects
    console.log('\n🏗️  CHECKING PROJECTS...\n');
    const projects = await prisma.project.findMany({
      include: {
        Asset: true
      }
    });
    
    projects.forEach((proj, i) => {
      console.log(`${i + 1}. ${proj.name}`);
      console.log(`   - Address: ${proj.address || 'N/A'}`);
      console.log(`   - Featured Image: ${proj.featuredImage || 'NONE'}`);
      console.log(`   - Assets linked: ${proj.Asset.length}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAssets();

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkProjectCovers() {
  try {
    console.log('🔍 Checking Project Cover Images\n');
    
    // Get all projects
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        coverImages: true,
        Asset: {
          where: {
            roomId: null,
            stageId: null,
            renderingVersionId: null
          },
          select: {
            id: true,
            filename: true,
            url: true,
            provider: true,
            type: true
          }
        }
      }
    });
    
    console.log(`📊 Found ${projects.length} projects\n`);
    
    projects.forEach((project, i) => {
      console.log(`${i + 1}. ${project.name}`);
      console.log(`   Address: ${project.address || 'N/A'}`);
      
      // Parse coverImages JSON
      let coverImagesArray = [];
      if (project.coverImages) {
        try {
          coverImagesArray = JSON.parse(project.coverImages);
        } catch (e) {
          console.log(`   ⚠️  coverImages field exists but couldn't parse`);
        }
      }
      
      console.log(`   coverImages field: ${coverImagesArray.length > 0 ? `${coverImagesArray.length} URLs` : 'Empty or null'}`);
      
      if (coverImagesArray.length > 0) {
        coverImagesArray.forEach((url, i) => {
          console.log(`     ${i + 1}. ${url.substring(0, 70)}...`);
        });
      }
      
      // Check project-level assets (no room/stage/rendering)
      console.log(`   Project-level Assets: ${project.Asset.length}`);
      if (project.Asset.length > 0) {
        project.Asset.forEach((asset, i) => {
          console.log(`     ${i + 1}. ${asset.filename || 'No filename'}`);
          console.log(`        Provider: ${asset.provider || 'none'}`);
          console.log(`        Type: ${asset.type}`);
          console.log(`        URL: ${asset.url.substring(0, 60)}...`);
        });
      }
      
      console.log('');
    });
    
    // Check all assets without room/stage/rendering links
    console.log('\n📷 All Project-Level Assets (no room/stage/rendering):');
    const projectLevelAssets = await prisma.asset.findMany({
      where: {
        AND: [
          { roomId: null },
          { stageId: null },
          { renderingVersionId: null }
        ]
      },
      select: {
        id: true,
        filename: true,
        url: true,
        provider: true,
        type: true,
        projectId: true,
        Project: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log(`   Found: ${projectLevelAssets.length} assets\n`);
    
    if (projectLevelAssets.length === 0) {
      console.log('   ❌ No project-level assets found!');
      console.log('   This means cover image asset records are missing.\n');
    } else {
      projectLevelAssets.forEach((asset, i) => {
        console.log(`${i + 1}. ${asset.filename || asset.id}`);
        console.log(`   Project: ${asset.Project?.name || 'Unknown'}`);
        console.log(`   Provider: ${asset.provider || 'none'}`);
        console.log(`   Type: ${asset.type}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProjectCovers();

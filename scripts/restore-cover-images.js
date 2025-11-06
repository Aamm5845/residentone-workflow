// Load environment variables from .env file
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreCoverImages() {
  try {
    console.log('🔄 Starting Cover Image Restoration from Backup\n');
    console.log('⚠️  SAFETY MODE: This script will ONLY ADD missing assets, never delete\n');
    
    // Load backup file
    const backupPath = path.join(__dirname, '..', 'backups', 'residentone-complete-backup-2025-11-04T21-10-06-919Z.json');
    
    if (!fs.existsSync(backupPath)) {
      console.error('❌ Backup file not found:', backupPath);
      process.exit(1);
    }
    
    console.log('📂 Reading backup file...');
    const backupFile = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const backup = backupFile.data;
    
    console.log(`✅ Backup loaded: ${backupFile.timestamp}`);
    console.log(`   Created by: ${backupFile.created_by?.email || 'Unknown'}\n`);
    
    // Get current assets to avoid duplicates
    console.log('📊 Checking current database state...');
    const currentAssets = await prisma.asset.findMany({
      select: {
        id: true,
        filename: true,
        url: true
      }
    });
    console.log(`   Current assets in DB: ${currentAssets.length}\n`);
    
    // Filter backup assets: only cover images (no roomId/stageId)
    const coverImagesInBackup = backup.assets.filter(asset => 
      asset.projectId && !asset.roomId && !asset.stageId && !asset.renderingVersionId
    );
    
    console.log(`🖼️  Cover images found in backup: ${coverImagesInBackup.length}\n`);
    
    // Check which ones are missing
    // Note: We need to check specifically for project-level assets (no room/stage)
    // Current assets might have same filename but be different (e.g. rendering assets)
    const currentProjectAssets = await prisma.asset.findMany({
      where: {
        AND: [
          { roomId: null },
          { stageId: null },
          { renderingVersionId: null }
        ]
      },
      select: {
        id: true,
        filename: true
      }
    });
    
    console.log(`   Current project-level assets: ${currentProjectAssets.length}\n`);
    
    const missingAssets = [];
    
    for (const backupAsset of coverImagesInBackup) {
      // Check if this PROJECT-LEVEL asset already exists
      const exists = currentProjectAssets.some(a => 
        a.id === backupAsset.id
      );
      
      if (!exists) {
        missingAssets.push(backupAsset);
      }
    }
    
    console.log(`🔍 Missing cover images to restore: ${missingAssets.length}\n`);
    
    if (missingAssets.length === 0) {
      console.log('✅ All cover images already exist in database!');
      console.log('   Nothing to restore.\n');
      return;
    }
    
    // Display what will be restored
    console.log('📋 Assets that will be restored:\n');
    missingAssets.forEach((asset, i) => {
      console.log(`${i + 1}. ${asset.filename || asset.title}`);
      console.log(`   - ID: ${asset.id}`);
      console.log(`   - Project ID: ${asset.projectId}`);
      console.log(`   - Provider: ${asset.provider || 'vercel-blob'}`);
      console.log(`   - URL: ${asset.url?.substring(0, 60)}...`);
      console.log('');
    });
    
    // Verify projects and users exist
    console.log('🔍 Verifying project IDs exist...\n');
    const projectIds = [...new Set(missingAssets.map(a => a.projectId))];
    const existingProjects = await prisma.project.findMany({
      where: {
        id: { in: projectIds }
      },
      select: {
        id: true,
        name: true,
        orgId: true
      }
    });
    
    // Verify users exist
    const userIds = [...new Set(missingAssets.map(a => a.uploadedBy).filter(Boolean))];
    console.log(`\n🔍 Verifying ${userIds.length} user IDs...`);
    
    const existingUsers = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        email: true
      }
    });
    
    console.log(`   Users found: ${existingUsers.length}/${userIds.length}`);
    
    // If no users found or uploadedBy missing, get first available user
    let defaultUser;
    if (existingUsers.length === 0 || missingAssets.some(a => !a.uploadedBy)) {
      console.log(`   Looking for a default user...`);
      defaultUser = await prisma.user.findFirst({
        select: {
          id: true,
          email: true
        }
      });
      if (defaultUser) {
        console.log(`   ✓ Will use default user: ${defaultUser.email}`);
      }
    }
    
    console.log(`   Projects found: ${existingProjects.length}/${projectIds.length}`);
    existingProjects.forEach(p => {
      console.log(`   ✓ ${p.name} (${p.id})`);
    });
    console.log('');
    
    if (existingProjects.length !== projectIds.length) {
      console.log('⚠️  Warning: Some projects from backup no longer exist.');
      console.log('   Assets for missing projects will be skipped.\n');
    }
    
    const validProjectIds = existingProjects.map(p => p.id);
    const assetsToRestore = missingAssets.filter(a => validProjectIds.includes(a.projectId));
    
    console.log(`✅ Valid assets to restore: ${assetsToRestore.length}\n`);
    
    if (assetsToRestore.length === 0) {
      console.log('❌ No valid assets to restore (projects may have been deleted).\n');
      return;
    }
    
    // Ask for confirmation
    console.log('⚠️  READY TO RESTORE');
    console.log(`   This will ADD ${assetsToRestore.length} asset records to your database.`);
    console.log('   Your existing ${currentAssets.length} assets will NOT be affected.\n');
    console.log('   Note: These assets point to Vercel Blob URLs which may no longer exist.');
    console.log('   You will need to re-upload cover images if Vercel Blob files are gone.\n');
    
    // Restore assets in a transaction
    console.log('🔄 Restoring assets...\n');
    
    let restored = 0;
    let failed = 0;
    
    for (const asset of assetsToRestore) {
      try {
        // Get orgId from project
        const project = existingProjects.find(p => p.id === asset.projectId);
        if (!project) {
          console.error(`❌ Skipping ${asset.filename}: Project not found`);
          failed++;
          continue;
        }
        
        // Get valid uploadedBy user ID
        let uploadedByUserId = asset.uploadedBy;
        
        // Check if user exists
        if (!uploadedByUserId || !existingUsers.some(u => u.id === uploadedByUserId)) {
          if (defaultUser) {
            uploadedByUserId = defaultUser.id;
          } else {
            console.error(`❌ Skipping ${asset.filename}: No valid user found`);
            failed++;
            continue;
          }
        }
        
        // Clean the asset data - remove any nested objects/arrays
        // Note: Generate new ID since backup ID might already exist
        const { nanoid } = await import('nanoid');
        const cleanAsset = {
          id: nanoid(),
          title: asset.title || asset.filename || 'Untitled',
          filename: asset.filename,
          url: asset.url,
          type: asset.type || 'IMAGE',
          size: asset.size,
          mimeType: asset.mimeType,
          provider: asset.provider || 'vercel-blob',
          metadata: asset.metadata,
          description: asset.description,
          userDescription: asset.userDescription,
          uploadedBy: uploadedByUserId,
          orgId: asset.orgId || project.orgId, // Use project's orgId if asset doesn't have one
          projectId: asset.projectId,
          roomId: asset.roomId || null,
          stageId: asset.stageId || null,
          sectionId: asset.sectionId || null,
          ffeItemId: asset.ffeItemId || null,
          approvalId: asset.approvalId || null,
          commentId: asset.commentId || null,
          renderingVersionId: asset.renderingVersionId || null,
          drawingChecklistItemId: asset.drawingChecklistItemId || null,
          createdAt: asset.createdAt ? new Date(asset.createdAt) : new Date(),
          updatedAt: asset.updatedAt ? new Date(asset.updatedAt) : new Date()
        };
        
        await prisma.asset.create({
          data: cleanAsset
        });
        
        console.log(`✅ Restored: ${asset.filename}`);
        restored++;
      } catch (error) {
        console.error(`❌ Failed to restore ${asset.filename}:`, error.message);
        failed++;
      }
    }
    
    console.log(`\n📊 Restoration Summary:`);
    console.log(`   ✅ Successfully restored: ${restored}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📦 Total assets in DB now: ${currentAssets.length + restored}\n`);
    
    // Update project coverImages field
    console.log('🔄 Updating project coverImages fields...\n');
    
    for (const project of existingProjects) {
      const projectAssets = assetsToRestore.filter(a => a.projectId === project.id);
      
      if (projectAssets.length > 0) {
        const coverImageUrls = projectAssets.map(a => a.url);
        
        try {
          await prisma.project.update({
            where: { id: project.id },
            data: {
              coverImages: JSON.stringify(coverImageUrls)
            }
          });
          console.log(`✅ Updated coverImages for: ${project.name}`);
        } catch (error) {
          console.error(`❌ Failed to update coverImages for ${project.name}:`, error.message);
        }
      }
    }
    
    console.log('\n✅ RESTORATION COMPLETE!\n');
    console.log('⚠️  IMPORTANT:');
    console.log('   - Restored assets point to Vercel Blob URLs');
    console.log('   - If Vercel Blob storage was deleted, images won\'t load');
    console.log('   - Next step: Migrate upload system to Dropbox');
    console.log('   - You may need to re-upload project cover images\n');
    
  } catch (error) {
    console.error('\n❌ RESTORATION ERROR:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

restoreCoverImages();

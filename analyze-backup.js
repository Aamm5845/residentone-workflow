const fs = require('fs');
const path = require('path');

async function analyzeBackup() {
  try {
    console.log('📂 Reading backup file...\n');
    
    const backupPath = path.join(__dirname, 'backups', 'residentone-complete-backup-2025-11-04T21-10-06-919Z.json');
    
    if (!fs.existsSync(backupPath)) {
      console.error('❌ Backup file not found:', backupPath);
      process.exit(1);
    }
    
    const backupFile = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const backup = backupFile.data;
    
    console.log('📊 Backup Information:');
    console.log(`  - Created: ${backupFile.timestamp}`);
    console.log(`  - Type: ${backupFile.type}`);
    console.log(`  - Created by: ${backupFile.created_by?.email || 'Unknown'}\n`);
    
    // Analyze assets in backup
    console.log('📷 Assets in Backup:');
    console.log(`  - Total assets: ${backup.assets?.length || 0}\n`);
    
    if (backup.assets && backup.assets.length > 0) {
      // Count by provider
      const byProvider = {};
      const byType = {};
      const projectCoverImages = [];
      
      backup.assets.forEach(asset => {
        // Provider counts
        const provider = asset.provider || 'unknown';
        byProvider[provider] = (byProvider[provider] || 0) + 1;
        
        // Type counts
        const type = asset.type || 'unknown';
        byType[type] = (byType[type] || 0) + 1;
        
        // Check if this might be a project cover image
        // Cover images typically don't have roomId/stageId but have projectId
        if (asset.projectId && !asset.roomId && !asset.stageId && !asset.renderingVersionId) {
          projectCoverImages.push({
            id: asset.id,
            title: asset.title,
            filename: asset.filename,
            url: asset.url,
            provider: asset.provider,
            projectId: asset.projectId
          });
        }
      });
      
      console.log('  By Provider:');
      Object.entries(byProvider).forEach(([provider, count]) => {
        console.log(`    - ${provider}: ${count}`);
      });
      
      console.log('\n  By Type:');
      Object.entries(byType).forEach(([type, count]) => {
        console.log(`    - ${type}: ${count}`);
      });
      
      console.log(`\n  🖼️  Potential Project Cover Images: ${projectCoverImages.length}`);
      if (projectCoverImages.length > 0) {
        console.log('  (Assets with projectId but no room/stage/rendering):\n');
        projectCoverImages.forEach((img, i) => {
          console.log(`  ${i + 1}. ${img.filename || img.title}`);
          console.log(`     - Provider: ${img.provider}`);
          console.log(`     - URL: ${img.url.substring(0, 80)}...`);
          console.log(`     - ProjectID: ${img.projectId}\n`);
        });
      }
    }
    
    // Analyze projects
    console.log('\n🏗️  Projects in Backup:');
    console.log(`  - Total projects: ${backup.projects?.length || 0}\n`);
    
    if (backup.projects && backup.projects.length > 0) {
      backup.projects.forEach((proj, i) => {
        console.log(`  ${i + 1}. ${proj.name}`);
        console.log(`     - ID: ${proj.id}`);
        console.log(`     - Address: ${proj.address || 'N/A'}`);
        
        // Check for cover images field
        if (proj.coverImages) {
          try {
            const coverImages = typeof proj.coverImages === 'string' 
              ? JSON.parse(proj.coverImages) 
              : proj.coverImages;
            console.log(`     - Cover Images: ${Array.isArray(coverImages) ? coverImages.length : 'Invalid format'}`);
          } catch (e) {
            console.log(`     - Cover Images: Error parsing`);
          }
        } else {
          console.log(`     - Cover Images: None`);
        }
        
        if (proj.featuredImage) {
          console.log(`     - Featured Image: ${proj.featuredImage.substring(0, 50)}...`);
        }
        console.log('');
      });
    }
    
    // Analyze rendering versions
    console.log('\n🎨 Rendering Versions in Backup:');
    console.log(`  - Total versions: ${backup.renderingVersions?.length || 0}\n`);
    
    if (backup.renderingVersions && backup.renderingVersions.length > 0) {
      const versionsWithAssets = backup.renderingVersions.filter(rv => {
        const hasAssets = backup.assets?.some(a => a.renderingVersionId === rv.id);
        return hasAssets;
      });
      console.log(`  - Versions with assets: ${versionsWithAssets.length}`);
    }
    
    console.log('\n✅ Backup analysis complete!\n');
    console.log('💡 Next Step: Compare this with current database to identify missing assets.');
    
  } catch (error) {
    console.error('❌ Error analyzing backup:', error.message);
    console.error(error.stack);
  }
}

analyzeBackup();

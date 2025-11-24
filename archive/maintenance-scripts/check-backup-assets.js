const fs = require('fs');

const backup = JSON.parse(fs.readFileSync('C:\\Users\\ADMIN\\Desktop\\residentone-workflow\\backups\\residentone-complete-backup-2025-10-30T17-24-37-688Z.json', 'utf8'));

console.log('\n📸 Assets in backup:\n');

const assets = backup.data.assets;

assets.forEach((a, i) => {
  console.log(`${i+1}. ${a.filename}`);
  console.log(`   ID: ${a.id}`);
  console.log(`   projectId: ${a.projectId || 'N/A'}`);
  console.log(`   roomId: ${a.roomId || 'N/A'}`);
  console.log(`   stageId: ${a.stageId || 'N/A'}`);
  console.log(`   renderingVersionId: ${a.renderingVersionId || 'N/A'}`);
  console.log('');
});

console.log('\n🎨 Rendering versions in backup:\n');

const versions = backup.data.renderingVersions;

versions.forEach((v, i) => {
  console.log(`${i+1}. Version ${v.version} - ${v.status}`);
  console.log(`   ID: ${v.id}`);
  console.log(`   stageId: ${v.stageId}`);
  console.log('');
});

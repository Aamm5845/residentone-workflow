const fs = require('fs');

const backup = JSON.parse(fs.readFileSync('./backups/residentone-complete-backup-2025-10-30T17-24-37-688Z.json', 'utf8'));

console.log('📊 Tables in backup file:\n');
Object.keys(backup.data).sort().forEach(key => {
  const count = Array.isArray(backup.data[key]) ? backup.data[key].length : 'N/A';
  console.log(`  - ${key}: ${count} records`);
});

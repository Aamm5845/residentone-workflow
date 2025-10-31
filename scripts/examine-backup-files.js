const fs = require('fs');

console.log('Reading backup file...');
const backupPath = 'backups/residentone-complete-backup-2025-10-16T19-27-45-147Z.json';
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

console.log('\n=== Backup Structure ===');
console.log('Top-level keys:', Object.keys(backup));

console.log('\n=== Files Property ===');
if (backup.files) {
    console.log('Type of files:', typeof backup.files);
    console.log('Is Array:', Array.isArray(backup.files));
    
    if (typeof backup.files === 'object') {
        const fileIds = Object.keys(backup.files);
        console.log('Number of file entries:', fileIds.length);
        console.log('\nFile IDs:');
        fileIds.forEach((id, index) => {
            console.log(`${index + 1}. ${id}`);
            const fileData = backup.files[id];
            console.log('   Type:', typeof fileData);
            if (typeof fileData === 'string') {
                console.log('   Length:', fileData.length, 'characters');
                console.log('   First 100 chars:', fileData.substring(0, 100));
            }
        });
        
        // Search for "Fried" in the files
        console.log('\n=== Searching for "Fried" in files ===');
        fileIds.forEach(id => {
            const content = backup.files[id];
            if (typeof content === 'string' && content.includes('Fried')) {
                console.log(`\nFound "Fried" in file ID: ${id}`);
                console.log('Content length:', content.length);
                
                // Find the position of "Fried"
                const pos = content.indexOf('Fried');
                console.log('Position:', pos);
                console.log('Context (100 chars before and after):');
                console.log(content.substring(Math.max(0, pos - 100), Math.min(content.length, pos + 100)));
            }
        });
    }
}

console.log('\n=== Data Property ===');
if (backup.data) {
    console.log('Data keys:', Object.keys(backup.data));
    
    // Check each table
    Object.keys(backup.data).forEach(tableName => {
        const records = backup.data[tableName];
        console.log(`\n${tableName}: ${records.length} records`);
        
        // Search for "Fried"
        const friedRecords = records.filter(r => 
            JSON.stringify(r).includes('Fried')
        );
        
        if (friedRecords.length > 0) {
            console.log(`  *** Contains ${friedRecords.length} records with "Fried" ***`);
            friedRecords.forEach((record, i) => {
                console.log(`  Record ${i + 1}:`, JSON.stringify(record).substring(0, 200));
            });
        }
    });
}

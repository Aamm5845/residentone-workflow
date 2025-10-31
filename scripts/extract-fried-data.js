const fs = require('fs');

console.log('Reading backup file...');
const backupPath = 'backups/residentone-complete-backup-2025-10-16T19-27-45-147Z.json';
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

// Find the Fried client, project, rooms, stages
const friedClient = backup.data.clients.find(c => c.name && c.name.includes('Fried'));
console.log('\n=== FRIED CLIENT ===');
console.log(JSON.stringify(friedClient, null, 2));

const friedProject = backup.data.projects.find(p => p.clientId === friedClient.id);
console.log('\n=== FRIED PROJECT ===');
console.log(JSON.stringify(friedProject, null, 2));

const friedRooms = backup.data.rooms.filter(r => r.projectId === friedProject.id);
console.log('\n=== FRIED ROOMS ===');
friedRooms.forEach(room => {
    console.log(JSON.stringify(room, null, 2));
});

const masterBedroomRoom = friedRooms.find(r => r.name === 'Master Bedroom');
console.log('\n=== MASTER BEDROOM ===');
console.log(JSON.stringify(masterBedroomRoom, null, 2));

const masterBedroomStages = backup.data.stages.filter(s => s.roomId === masterBedroomRoom.id);
console.log('\n=== MASTER BEDROOM STAGES ===');
masterBedroomStages.forEach(stage => {
    console.log(`Stage: ${stage.type}, Status: ${stage.status}, ID: ${stage.id}`);
});

const designConceptStage = masterBedroomStages.find(s => s.type === 'DESIGN_CONCEPT');
console.log('\n=== DESIGN CONCEPT STAGE ===');
console.log(JSON.stringify(designConceptStage, null, 2));

// Find design sections for this stage
const designSections = backup.data.designSections.filter(ds => ds.stageId === designConceptStage.id);
console.log('\n=== DESIGN SECTIONS ===');
designSections.forEach(section => {
    console.log(JSON.stringify(section, null, 2));
});

// Find assets
const stageAssets = backup.data.assets.filter(a => a.stageId === designConceptStage.id);
console.log('\n=== STAGE ASSETS ===');
stageAssets.forEach(asset => {
    console.log(JSON.stringify(asset, null, 2));
});

// Find comments
const stageComments = backup.data.comments.filter(c => c.stageId === designConceptStage.id);
console.log('\n=== STAGE COMMENTS ===');
stageComments.forEach(comment => {
    console.log(JSON.stringify(comment, null, 2));
});

// Check for the file asset
const fileId = 'cmgk1akq0006b1nead8w8jdy0';
const assetWithFileId = backup.data.assets.find(a => a.id === fileId);
console.log('\n=== ASSET WITH FILE ===');
console.log(JSON.stringify(assetWithFileId, null, 2));

// Check activity logs for this asset
const assetLogs = backup.data.activityLogs.filter(log => 
    log.entityId === fileId || (log.details && log.details.includes('Fried'))
);
console.log('\n=== ACTIVITY LOGS FOR FRIED ===');
assetLogs.forEach(log => {
    console.log(JSON.stringify(log, null, 2));
});

// Check if file exists
if (backup.files && backup.files[fileId]) {
    const fileData = backup.files[fileId];
    console.log('\n=== FILE DATA ===');
    console.log('File ID:', fileId);
    console.log('Data type:', typeof fileData);
    console.log('Data length:', fileData.length);
    
    // Parse the file metadata
    if (typeof fileData === 'string') {
        try {
            const fileObj = JSON.parse(fileData);
            console.log('File object keys:', Object.keys(fileObj));
            console.log('Content type:', fileObj.contentType);
            console.log('Content length:', fileObj.content ? fileObj.content.length : 'N/A');
        } catch (e) {
            console.log('Could not parse as JSON');
        }
    }
}

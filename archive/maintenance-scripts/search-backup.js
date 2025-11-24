const fs = require('fs')

const backupFile = 'backups/residentone-complete-backup-2025-10-16T19-27-45-147Z.json'

console.log('Reading backup file...\n')

const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'))

console.log('Backup metadata:')
console.log('  Timestamp:', backup.timestamp)
console.log('  Type:', backup.type)
console.log('  Tables:', Object.keys(backup.data).join(', '))
console.log('\n================================\n')

// Search for Fried client
const clients = backup.data.Client || []
const friedClient = clients.find(c => c.name && c.name.includes('Fried'))

if (friedClient) {
  console.log('Found Fried client:')
  console.log('  Name:', friedClient.name)
  console.log('  ID:', friedClient.id)
  console.log('\n')
}

// Search for Fried project
const projects = backup.data.Project || []
const friedProject = projects.find(p => 
  (p.name && p.name.includes('Fried')) || 
  (friedClient && p.clientId === friedClient.id)
)

if (friedProject) {
  console.log('Found Fried project:')
  console.log('  Name:', friedProject.name)
  console.log('  ID:', friedProject.id)
  console.log('  Client ID:', friedProject.clientId)
  console.log('\n')
}

// Search for Master Bedroom room
const rooms = backup.data.Room || []
const masterBedroom = rooms.find(r => 
  friedProject && r.projectId === friedProject.id && 
  (r.name && r.name.includes('Master'))
)

if (masterBedroom) {
  console.log('Found Master Bedroom:')
  console.log('  Name:', masterBedroom.name)
  console.log('  Type:', masterBedroom.type)
  console.log('  ID:', masterBedroom.id)
  console.log('\n')
}

// Search for design concept stage
const stages = backup.data.Stage || []
const designStage = stages.find(s => 
  masterBedroom && s.roomId === masterBedroom.id && s.type === 'DESIGN_CONCEPT'
)

if (designStage) {
  console.log('Found Design Concept stage:')
  console.log('  ID:', designStage.id)
  console.log('  Status:', designStage.status)
  console.log('\n================================\n')
  
  // Search for design sections
  const sections = backup.data.DesignSection || []
  const stagesSections = sections.filter(s => s.stageId === designStage.id)
  
  console.log(`Found ${stagesSections.length} design sections:\n`)
  
  stagesSections.forEach((section, i) => {
    console.log(`${i + 1}. ${section.type}`)
    console.log(`   ID: ${section.id}`)
    console.log(`   Completed: ${section.completed}`)
    console.log(`   Content (${section.content ? section.content.length : 0} chars):`)
    if (section.content) {
      console.log(`   "${section.content.substring(0, 200)}${section.content.length > 200 ? '...' : ''}"`)
    } else {
      console.log(`   (empty)`)
    }
    console.log('')
  })
  
  // Search for assets
  const assets = backup.data.Asset || []
  const stageAssets = assets.filter(a => {
    const section = sections.find(s => s.id === a.sectionId)
    return section && section.stageId === designStage.id
  })
  
  console.log(`\nFound ${stageAssets.length} assets (images):\n`)
  stageAssets.forEach((asset, i) => {
    console.log(`${i + 1}. ${asset.title}`)
    console.log(`   Section ID: ${asset.sectionId}`)
    console.log(`   URL: ${asset.url}`)
    console.log(`   Type: ${asset.type}`)
    if (asset.userDescription) {
      console.log(`   Description: ${asset.userDescription}`)
    }
    console.log('')
  })
  
  // Search for comments
  const comments = backup.data.Comment || []
  const stageComments = comments.filter(c => {
    const section = sections.find(s => s.id === c.sectionId)
    return section && section.stageId === designStage.id
  })
  
  console.log(`\nFound ${stageComments.length} comments:\n`)
  stageComments.forEach((comment, i) => {
    console.log(`${i + 1}. Comment ID: ${comment.id}`)
    console.log(`   Section ID: ${comment.sectionId}`)
    console.log(`   Content: ${comment.content}`)
    console.log('')
  })
} else {
  console.log('⚠️ Design Concept stage not found in backup')
}

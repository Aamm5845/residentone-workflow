const fs = require('fs')

const backupFile = 'backups/residentone-complete-backup-2025-10-16T19-27-45-147Z.json'

console.log('Reading backup file...\n')

const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'))

console.log('Backup timestamp:', backup.timestamp)
console.log('\n================================\n')

// List ALL clients
const clients = backup.data.Client || []
console.log(`Total clients: ${clients.length}`)
clients.forEach((client, i) => {
  console.log(`${i + 1}. ${client.name} (ID: ${client.id})`)
})

console.log('\n================================\n')

// List ALL projects
const projects = backup.data.Project || []
console.log(`Total projects: ${projects.length}`)
projects.forEach((project, i) => {
  const client = clients.find(c => c.id === project.clientId)
  console.log(`${i + 1}. ${project.name} - ${client ? client.name : 'Unknown client'}`)
  console.log(`   ID: ${project.id}`)
})

console.log('\n================================\n')

// Find ALL design sections with content or assets
const sections = backup.data.DesignSection || []
const sectionsWithData = sections.filter(s => 
  (s.content && s.content.trim()) || 
  s.completed
)

console.log(`Design sections with content or completed: ${sectionsWithData.length}\n`)

sectionsWithData.forEach((section, i) => {
  console.log(`${i + 1}. Section ${section.type}`)
  console.log(`   Stage ID: ${section.stageId}`)
  console.log(`   Completed: ${section.completed}`)
  if (section.content) {
    console.log(`   Content: ${section.content.substring(0, 100)}...`)
  }
  console.log('')
})

// Find ALL assets
const assets = backup.data.Asset || []
console.log(`\nTotal assets in backup: ${assets.length}\n`)

if (assets.length > 0) {
  assets.forEach((asset, i) => {
    const section = sections.find(s => s.id === asset.sectionId)
    console.log(`${i + 1}. ${asset.title}`)
    console.log(`   Section ID: ${asset.sectionId}`)
    console.log(`   Section Type: ${section ? section.type : 'Unknown'}`)
    console.log(`   URL: ${asset.url}`)
    if (asset.userDescription) {
      console.log(`   Description: ${asset.userDescription}`)
    }
    console.log('')
  })
}

// Find ALL comments in design sections
const comments = backup.data.Comment || []
const designComments = comments.filter(c => c.sectionId)

console.log(`\nTotal design comments: ${designComments.length}\n`)

if (designComments.length > 0) {
  designComments.forEach((comment, i) => {
    console.log(`${i + 1}. ${comment.content.substring(0, 50)}...`)
    console.log(`   Section ID: ${comment.sectionId}`)
    console.log('')
  })
}

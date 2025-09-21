const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const prisma = new PrismaClient()

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// Get backups directory
const backupsDir = path.join(__dirname, '..', 'backups')

function listAvailableBackups() {
  console.log('\n📋 Available backups:')
  
  if (!fs.existsSync(backupsDir)) {
    console.log('❌ No backups directory found. Please create a backup first.')
    process.exit(1)
  }
  
  const backupFiles = fs.readdirSync(backupsDir)
    .filter(file => file.startsWith('database-backup-') && file.endsWith('.json'))
    .map(file => {
      const filePath = path.join(backupsDir, file)
      const stats = fs.statSync(filePath)
      return {
        name: file,
        path: filePath,
        size: stats.size,
        mtime: stats.mtime
      }
    })
    .sort((a, b) => b.mtime - a.mtime) // Sort by date, newest first
  
  if (backupFiles.length === 0) {
    console.log('❌ No backup files found. Please create a backup first.')
    process.exit(1)
  }
  
  backupFiles.forEach((file, index) => {
    const size = (file.size / 1024).toFixed(2)
    const date = file.mtime.toLocaleString()
    
    // Try to read backup metadata
    try {
      const backup = JSON.parse(fs.readFileSync(file.path, 'utf8'))
      const recordCount = Object.values(backup.data || {}).reduce((sum, table) => sum + (table?.length || 0), 0)
      
      console.log(`${index + 1}. ${file.name}`)
      console.log(`   📅 Created: ${date}`)
      console.log(`   📊 Size: ${size} KB`)
      console.log(`   📋 Records: ${recordCount}`)
      console.log('')
    } catch (error) {
      console.log(`${index + 1}. ${file.name}`)
      console.log(`   📅 Created: ${date}`)
      console.log(`   📊 Size: ${size} KB`)
      console.log(`   ⚠️ Could not read backup data`)
      console.log('')
    }
  })
  
  return backupFiles
}

function promptForBackupSelection(backupFiles) {
  rl.question('Enter the number of the backup to restore (or "q" to quit): ', (answer) => {
    if (answer.toLowerCase() === 'q') {
      console.log('👋 Restore cancelled.')
      rl.close()
      return
    }
    
    const selection = parseInt(answer)
    if (isNaN(selection) || selection < 1 || selection > backupFiles.length) {
      console.log('❌ Invalid selection. Please try again.')
      promptForBackupSelection(backupFiles)
      return
    }
    
    const selectedBackup = backupFiles[selection - 1]
    confirmRestore(selectedBackup)
  })
}

function confirmRestore(backupFile) {
  console.log(`\n⚠️  WARNING: This will completely replace your current database with the backup data.`)
  console.log(`📁 Selected backup: ${backupFile.name}`)
  console.log(`📅 Backup date: ${backupFile.mtime.toLocaleString()}`)
  
  rl.question('\nAre you sure you want to proceed? (yes/no): ', (answer) => {
    if (answer.toLowerCase() !== 'yes') {
      console.log('👋 Restore cancelled.')
      rl.close()
      return
    }
    
    performRestore(backupFile)
  })
}

async function performRestore(backupFile) {
  console.log('\n🔄 Starting database restore...')
  console.log(`📁 Restoring from: ${backupFile.path}`)
  
  try {
    // Read backup file
    const backupData = JSON.parse(fs.readFileSync(backupFile.path, 'utf8'))
    
    if (!backupData.data) {
      throw new Error('Invalid backup file format - no data section found')
    }
    
    console.log('🗑️ Clearing existing data...')
    
    // Clear existing data in reverse dependency order
    await prisma.clientAccessLog.deleteMany({})
    await prisma.clientAccessToken.deleteMany({})
    await prisma.asset.deleteMany({})
    await prisma.designSection.deleteMany({})
    await prisma.fFEItem.deleteMany({})
    await prisma.stage.deleteMany({})
    await prisma.room.deleteMany({})
    await prisma.floor.deleteMany({})
    await prisma.project.deleteMany({})
    await prisma.contractor.deleteMany({})
    await prisma.client.deleteMany({})
    await prisma.user.deleteMany({})
    await prisma.organization.deleteMany({})
    
    console.log('📦 Restoring data...')
    
    // Restore data in correct dependency order
    const { data } = backupData
    
    if (data.organizations?.length > 0) {
      await prisma.organization.createMany({ data: data.organizations })
      console.log(`✅ Restored ${data.organizations.length} organizations`)
    }
    
    if (data.users?.length > 0) {
      await prisma.user.createMany({ data: data.users })
      console.log(`✅ Restored ${data.users.length} users`)
    }
    
    if (data.clients?.length > 0) {
      await prisma.client.createMany({ data: data.clients })
      console.log(`✅ Restored ${data.clients.length} clients`)
    }
    
    if (data.contractors?.length > 0) {
      await prisma.contractor.createMany({ data: data.contractors })
      console.log(`✅ Restored ${data.contractors.length} contractors`)
    }
    
    if (data.projects?.length > 0) {
      await prisma.project.createMany({ data: data.projects })
      console.log(`✅ Restored ${data.projects.length} projects`)
    }
    
    if (data.floors?.length > 0) {
      await prisma.floor.createMany({ data: data.floors })
      console.log(`✅ Restored ${data.floors.length} floors`)
    }
    
    if (data.rooms?.length > 0) {
      await prisma.room.createMany({ data: data.rooms })
      console.log(`✅ Restored ${data.rooms.length} rooms`)
    }
    
    if (data.stages?.length > 0) {
      await prisma.stage.createMany({ data: data.stages })
      console.log(`✅ Restored ${data.stages.length} stages`)
    }
    
    if (data.designSections?.length > 0) {
      await prisma.designSection.createMany({ data: data.designSections })
      console.log(`✅ Restored ${data.designSections.length} design sections`)
    }
    
    if (data.ffeItems?.length > 0) {
      await prisma.fFEItem.createMany({ data: data.ffeItems })
      console.log(`✅ Restored ${data.ffeItems.length} FFE items`)
    }
    
    if (data.assets?.length > 0) {
      await prisma.asset.createMany({ data: data.assets })
      console.log(`✅ Restored ${data.assets.length} assets`)
    }
    
    if (data.clientAccessTokens?.length > 0) {
      await prisma.clientAccessToken.createMany({ data: data.clientAccessTokens })
      console.log(`✅ Restored ${data.clientAccessTokens.length} client access tokens`)
    }
    
    if (data.clientAccessLogs?.length > 0) {
      await prisma.clientAccessLog.createMany({ data: data.clientAccessLogs })
      console.log(`✅ Restored ${data.clientAccessLogs.length} client access logs`)
    }
    
    console.log('\n✅ Database restored successfully!')
    console.log('🎉 All data has been restored from backup!')
    console.log('💡 You may want to restart your development server')
    
  } catch (error) {
    console.error('❌ Restore failed:', error.message)
    console.log('💡 Your database may be in an inconsistent state. Try restoring from a different backup.')
  } finally {
    await prisma.$disconnect()
    rl.close()
  }
}

// Main execution
console.log('🔧 ResidentOne Database Restore Utility (Prisma)')
console.log('==============================================')

const availableBackups = listAvailableBackups()
promptForBackupSelection(availableBackups)
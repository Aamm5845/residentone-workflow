import fs from 'fs'

async function restoreBackup() {
  try {
    // Read the backup file
    const backupPath = 'backups/full-backup-2025-09-26T00-28-06-573Z.json'
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
    
    // Transform to expected format for the restore API
    const restoreData = {
      version: "1.0",
      type: "production",
      timestamp: backupData.metadata.timestamp,
      data: backupData.data
    }
    
    console.log('🔄 Starting database restore...')
    console.log(`📅 Backup from: ${backupData.metadata.timestamp}`)
    
    const response = await fetch('http://localhost:3000/api/admin/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': process.env.AUTH_COOKIE || '' // You'll need to get this from browser
      },
      body: JSON.stringify({
        backup_data: restoreData,
        confirm_restore: true
      })
    })
    
    const result = await response.json()
    
    if (response.ok) {
      console.log('✅ Database restored successfully!')
      console.log('📊 Restored data:')
      if (restoreData.data.projects) console.log(`   - ${restoreData.data.projects.length} projects`)
      if (restoreData.data.clients) console.log(`   - ${restoreData.data.clients.length} clients`)
      if (restoreData.data.stages) console.log(`   - ${restoreData.data.stages.length} stages`)
      if (restoreData.data.rooms) console.log(`   - ${restoreData.data.rooms.length} rooms`)
    } else {
      console.error('❌ Restore failed:', result.error)
      console.error('Details:', result.details)
    }
    
  } catch (error) {
    console.error('❌ Script error:', error)
  }
}

restoreBackup()
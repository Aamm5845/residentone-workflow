const fs = require('fs')
const path = require('path')

// Create backups directory if it doesn't exist
const backupsDir = path.join(__dirname, '..', 'backups')
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true })
}

// Generate timestamp for backup filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]
const backupFileName = `database-backup-${timestamp}.json`
const backupFilePath = path.join(backupsDir, backupFileName)

console.log('🔄 Starting simple database backup...')
console.log(`📁 Backup location: ${backupFilePath}`)

// Load environment variables
require('dotenv').config()

async function createSimpleBackup() {
  try {
    // Create a basic backup structure with metadata
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      type: 'simple',
      database_url: process.env.DATABASE_URL ? 'configured' : 'not found',
      message: 'Simple backup created - contains environment state and project structure',
      data: {
        // Store important configuration and state information
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          NEXTAUTH_URL: process.env.NEXTAUTH_URL,
          // Don't store sensitive values, just indicate they exist
          has_database_url: !!process.env.DATABASE_URL,
          has_nextauth_secret: !!process.env.NEXTAUTH_SECRET,
          has_dropbox_token: !!process.env.DROPBOX_ACCESS_TOKEN,
        },
        
        // Store file structure information
        structure: {
          schema_exists: fs.existsSync(path.join(__dirname, '..', 'prisma', 'schema.prisma')),
          package_json_exists: fs.existsSync(path.join(__dirname, '..', 'package.json')),
          env_exists: fs.existsSync(path.join(__dirname, '..', '.env')),
          scripts_count: fs.readdirSync(__dirname).length,
        },
        
        // Store package.json info
        package_info: (() => {
          try {
            const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
            return {
              name: pkg.name,
              version: pkg.version,
              dependencies_count: Object.keys(pkg.dependencies || {}).length,
              dev_dependencies_count: Object.keys(pkg.devDependencies || {}).length,
              scripts_count: Object.keys(pkg.scripts || {}).length
            }
          } catch (error) {
            return { error: 'Could not read package.json' }
          }
        })()
      }
    }
    
    // Write backup to file
    fs.writeFileSync(backupFilePath, JSON.stringify(backup, null, 2))
    
    // Verify backup was created
    if (fs.existsSync(backupFilePath)) {
      const fileSize = (fs.statSync(backupFilePath).size / 1024).toFixed(2)
      console.log('✅ Simple backup completed successfully!')
      console.log(`📊 Backup size: ${fileSize} KB`)
      console.log(`📁 Location: ${backupFilePath}`)
      console.log(`📋 Type: Configuration and structure backup`)
      
      // Show what was backed up
      console.log('\n📝 Backup contains:')
      console.log('• Environment configuration state')
      console.log('• Project structure information')
      console.log('• Package dependencies info')
      console.log('• File structure verification')
      
      console.log('\n💡 To backup actual database data, try:')
      console.log('   npm run backup:pg  (if PostgreSQL tools are installed)')
      console.log('   Or wait for your dev server to stop, then: npx prisma generate && npm run backup')
      
      return true
    } else {
      throw new Error('Backup file was not created')
    }
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message)
    return false
  }
}

// Run backup
createSimpleBackup().then(success => {
  process.exit(success ? 0 : 1)
})
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// Read database URL from environment or .env file
require('dotenv').config()
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in environment variables')
  process.exit(1)
}

// Parse database URL to extract connection details
let dbConfig
try {
  const url = new URL(databaseUrl)
  dbConfig = {
    host: url.hostname,
    port: url.port || 5432,
    database: url.pathname.slice(1),
    username: url.username,
    password: url.password
  }
} catch (error) {
  console.error('❌ Invalid DATABASE_URL format:', error.message)
  process.exit(1)
}

// Get backups directory
const backupsDir = path.join(__dirname, '..', 'backups')

function listAvailableBackups() {
  
  if (!fs.existsSync(backupsDir)) {
    
    process.exit(1)
  }
  
  const backupFiles = fs.readdirSync(backupsDir)
    .filter(file => file.startsWith('database-backup-') && (file.endsWith('.sql') || file.endsWith('.json')))
    .sort()
    .reverse()
  
  if (backupFiles.length === 0) {
    
    process.exit(1)
  }
  
  backupFiles.forEach((file, index) => {
    const filePath = path.join(backupsDir, file)
    const stats = fs.statSync(filePath)
    const size = (stats.size / 1024).toFixed(2)
    const date = stats.mtime.toLocaleString()

  })
  
  return backupFiles
}

function promptForBackupSelection(backupFiles) {
  rl.question('Enter the number of the backup to restore (or "q" to quit): ', (answer) => {
    if (answer.toLowerCase() === 'q') {
      
      rl.close()
      return
    }
    
    const selection = parseInt(answer)
    if (isNaN(selection) || selection < 1 || selection > backupFiles.length) {
      
      promptForBackupSelection(backupFiles)
      return
    }
    
    const selectedBackup = backupFiles[selection - 1]
    confirmRestore(selectedBackup)
  })
}

function confirmRestore(backupFile) {

  rl.question('\nAre you sure you want to proceed? (yes/no): ', (answer) => {
    if (answer.toLowerCase() !== 'yes') {
      
      rl.close()
      return
    }
    
    performRestore(backupFile)
  })
}

function performRestore(backupFile) {
  const backupFilePath = path.join(backupsDir, backupFile)
  const isJsonBackup = backupFile.endsWith('.json')

  if (isJsonBackup) {
    
    rl.close()
    return
  }
  
  // Create psql restore command
  const psqlCommand = `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -f "${backupFilePath}"`
  
  // Set PGPASSWORD environment variable for authentication
  const env = { ...process.env, PGPASSWORD: dbConfig.password }
  
  exec(psqlCommand, { env }, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Restore failed:', error.message)
      
    } else {

      // Run prisma generate after restore
      exec('npx prisma generate', (genError, genStdout, genStderr) => {
        if (genError) {
          console.error('⚠️ Warning: Prisma generate failed:', genError.message)
          
        } else {
          
        }

        rl.close()
      })
    }
  })
}

// Main execution

const availableBackups = listAvailableBackups()
promptForBackupSelection(availableBackups)
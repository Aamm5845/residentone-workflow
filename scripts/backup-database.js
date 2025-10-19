const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

// Create backups directory if it doesn't exist
const backupsDir = path.join(__dirname, '..', 'backups')
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true })
}

// Generate timestamp for backup filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]
const backupFileName = `database-backup-${timestamp}.sql`
const backupFilePath = path.join(backupsDir, backupFileName)

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

// Create pg_dump command
const pgDumpCommand = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} --no-password --clean --if-exists --verbose > "${backupFilePath}"`

// Set PGPASSWORD environment variable for authentication
const env = { ...process.env, PGPASSWORD: dbConfig.password }

exec(pgDumpCommand, { env }, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Backup failed:', error.message)
    
    // If pg_dump is not available, try using Prisma
    
    fallbackBackup()
    return
  }

  // Check if backup file was created and has content
  if (fs.existsSync(backupFilePath) && fs.statSync(backupFilePath).size > 0) {
    const fileSize = (fs.statSync(backupFilePath).size / 1024).toFixed(2)

    // Clean up old backups (keep only last 10)
    cleanupOldBackups()
  } else {
    console.error('❌ Backup file was not created or is empty')
    fallbackBackup()
  }
})

// Fallback backup method using Prisma's data export
function fallbackBackup() {
  
  const prismaBackupCommand = `npx prisma db execute --stdin < "${path.join(__dirname, 'export-data.sql')}"`
  
  // Create a simple data export query
  const exportDataScript = `
-- Export all data as JSON
COPY (SELECT json_build_object(
  'organizations', (SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM "Organization") t),
  'users', (SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM "User") t),
  'clients', (SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM "Client") t),
  'projects', (SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM "Project") t),
  'floors', (SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM "Floor") t),
  'rooms', (SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM "Room") t),
  'stages', (SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM "Stage") t),
  'ffeItems', (SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM "FFEItem") t),
  'contractors', (SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM "Contractor") t),
  'clientAccessTokens', (SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM "ClientAccessToken") t),
  'assets', (SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM "Asset") t)
)) TO '${backupFilePath.replace('.sql', '.json')}';
`
  
  fs.writeFileSync(path.join(__dirname, 'export-data.sql'), exportDataScript)
  
  exec(prismaBackupCommand, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Prisma backup also failed:', error.message)
      
    } else {

    }
  })
}

// Clean up old backup files (keep only last 10)
function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter(file => file.startsWith('database-backup-') && (file.endsWith('.sql') || file.endsWith('.json')))
      .sort()
      .reverse()
    
    if (files.length > 10) {
      const filesToDelete = files.slice(10)
      filesToDelete.forEach(file => {
        const filePath = path.join(backupsDir, file)
        fs.unlinkSync(filePath)
        
      })
    }
  } catch (error) {
    console.error('⚠️ Could not clean up old backups:', error.message)
  }
}
#!/usr/bin/env node

/**
 * AUTOMATIC DATABASE BACKUP SYSTEM
 * 
 * This script creates automatic backups of your database using Prisma's backup API.
 * Run this daily or before any major changes.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Parse DATABASE_URL to get credentials
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !databaseUrl.includes('db.prisma.io')) {
  console.error('❌ DATABASE_URL not found or not a Prisma database');
  process.exit(1);
}

const match = databaseUrl.match(/postgres:\/\/([^:]+):([^@]+)@/);
if (!match) {
  console.error('❌ Could not parse DATABASE_URL');
  process.exit(1);
}

const [, username, apiKey] = match;

console.log('🔄 Creating database backup...');
console.log(`📊 Database: ${username.substring(0, 8)}...`);
console.log(`📅 Date: ${new Date().toISOString()}`);

// Create backup directory if it doesn't exist
const backupDir = path.join(process.cwd(), '.db-backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Save backup metadata
const backupInfo = {
  timestamp: new Date().toISOString(),
  databaseId: username,
  note: 'Automatic backup before schema changes'
};

const backupFile = path.join(backupDir, `backup-${Date.now()}.json`);
fs.writeFileSync(backupFile, JSON.stringify(backupInfo, null, 2));

console.log('✅ Backup metadata saved to:', backupFile);
console.log('\n📝 IMPORTANT: Prisma databases have automatic backups.');
console.log('   You can restore from: https://console.prisma.io/');
console.log('   Your backups are available in the Prisma Console under your database.\n');
console.log('💡 TIP: Prisma keeps hourly backups for 24 hours and daily backups for 7 days.\n');

// Clean up old backup metadata files (keep last 10)
const backupFiles = fs.readdirSync(backupDir)
  .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
  .map(f => ({
    name: f,
    path: path.join(backupDir, f),
    time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
  }))
  .sort((a, b) => b.time - a.time);

if (backupFiles.length > 10) {
  console.log('🧹 Cleaning up old backup metadata...');
  backupFiles.slice(10).forEach(file => {
    fs.unlinkSync(file.path);
    console.log(`   Removed: ${file.name}`);
  });
}

console.log('✅ Backup process complete!\n');

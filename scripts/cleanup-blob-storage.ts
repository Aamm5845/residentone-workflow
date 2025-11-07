import { list, del } from '@vercel/blob'

async function listBlobFiles() {
  try {
    console.log('📦 Fetching all files from Vercel Blob...\n')
    
    const { blobs } = await list()
    
    if (blobs.length === 0) {
      console.log('No files found in Blob storage.')
      return
    }

    // Group by folder/type
    const byFolder: Record<string, any[]> = {}
    let totalSize = 0

    for (const blob of blobs) {
      const folder = blob.pathname.split('/')[0] || 'root'
      if (!byFolder[folder]) {
        byFolder[folder] = []
      }
      byFolder[folder].push(blob)
      totalSize += blob.size
    }

    console.log(`📊 Total files: ${blobs.length}`)
    console.log(`💾 Total size: ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB\n`)

    // Show breakdown by folder
    console.log('📁 Breakdown by folder:\n')
    for (const [folder, files] of Object.entries(byFolder)) {
      const folderSize = files.reduce((sum, f) => sum + f.size, 0)
      const sizeMB = (folderSize / 1024 / 1024).toFixed(2)
      const sizeGB = (folderSize / 1024 / 1024 / 1024).toFixed(2)
      
      console.log(`  ${folder}/`)
      console.log(`    Files: ${files.length}`)
      console.log(`    Size: ${parseFloat(sizeGB) >= 0.1 ? `${sizeGB} GB` : `${sizeMB} MB`}`)
      
      // Show first few files as examples
      if (files.length > 0) {
        console.log(`    Examples:`)
        files.slice(0, 3).forEach(f => {
          const date = new Date(f.uploadedAt).toLocaleDateString()
          console.log(`      - ${f.pathname} (${(f.size / 1024 / 1024).toFixed(2)} MB, ${date})`)
        })
      }
      console.log()
    }

    // Identify candidates for deletion
    console.log('🧹 Cleanup recommendations:\n')
    
    // Check for backup files
    const backupFiles = blobs.filter(b => 
      b.pathname.includes('backup') || 
      b.pathname.includes('Backup') ||
      b.pathname.includes('.json') ||
      b.pathname.includes('.sql')
    )
    
    if (backupFiles.length > 0) {
      const backupSize = backupFiles.reduce((sum, f) => sum + f.size, 0)
      console.log(`  ⚠️  Backup files: ${backupFiles.length} files, ${(backupSize / 1024 / 1024 / 1024).toFixed(2)} GB`)
      console.log(`     These should be in Dropbox instead. Safe to delete.`)
    }

    // Check for old orgs files (if present)
    const oldOrgFiles = blobs.filter(b => b.pathname.startsWith('orgs/'))
    if (oldOrgFiles.length > 0) {
      const oldSize = oldOrgFiles.reduce((sum, f) => sum + f.size, 0)
      console.log(`  📦 Old org files: ${oldOrgFiles.length} files, ${(oldSize / 1024 / 1024 / 1024).toFixed(2)} GB`)
    }

    console.log('\n💡 To delete files, uncomment the cleanup section in this script.')
    console.log('   Then run: npx tsx scripts/cleanup-blob-storage.ts --delete\n')

  } catch (error) {
    console.error('Error:', error)
  }
}

async function cleanupBackups() {
  try {
    console.log('🧹 Starting cleanup of backup files...\n')
    
    const { blobs } = await list()
    
    // Find all backup files
    const backupFiles = blobs.filter(b => 
      b.pathname.includes('backup') || 
      b.pathname.includes('Backup') ||
      b.pathname.endsWith('.json') ||
      b.pathname.endsWith('.sql')
    )

    if (backupFiles.length === 0) {
      console.log('No backup files found to delete.')
      return
    }

    console.log(`Found ${backupFiles.length} backup files to delete:\n`)
    
    let deletedCount = 0
    let freedSpace = 0

    for (const file of backupFiles) {
      console.log(`  Deleting: ${file.pathname} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)
      try {
        await del(file.url)
        deletedCount++
        freedSpace += file.size
      } catch (error) {
        console.error(`    ❌ Failed to delete: ${error}`)
      }
    }

    console.log(`\n✅ Deleted ${deletedCount} files`)
    console.log(`💾 Freed ${(freedSpace / 1024 / 1024 / 1024).toFixed(2)} GB\n`)

  } catch (error) {
    console.error('Error during cleanup:', error)
  }
}

// Main
const shouldDelete = process.argv.includes('--delete')

if (shouldDelete) {
  console.log('⚠️  DELETE MODE ENABLED\n')
  cleanupBackups()
} else {
  listBlobFiles()
}

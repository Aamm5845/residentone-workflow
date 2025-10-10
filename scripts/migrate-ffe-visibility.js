#!/usr/bin/env node

/**
 * FFE Visibility Migration Script
 * 
 * This script sets the default visibility to 'VISIBLE' for all existing FFE items
 * to ensure backward compatibility after deploying the two-department FFE system.
 * 
 * Usage:
 *   node scripts/migrate-ffe-visibility.js [--dry-run] [--batch-size=100]
 * 
 * Options:
 *   --dry-run      Show what would be updated without making changes
 *   --batch-size   Number of items to process in each batch (default: 100)
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Parse command line arguments
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='))
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 100

async function migrateFFEVisibility() {
  console.log('🔄 Starting FFE Visibility Migration...')
  console.log(`📊 Mode: ${isDryRun ? 'DRY RUN' : 'LIVE UPDATE'}`)
  console.log(`📦 Batch size: ${batchSize}`)
  console.log()

  try {
    // Get count of items that need migration (where visibility is null)
    const itemsToMigrateCount = await prisma.roomFFEItem.count({
      where: {
        visibility: null
      }
    })

    console.log(`📋 Found ${itemsToMigrateCount} FFE items that need visibility migration`)

    if (itemsToMigrateCount === 0) {
      console.log('✅ No items need migration. All items already have visibility set.')
      return
    }

    if (isDryRun) {
      console.log()
      console.log('📝 DRY RUN: The following items would be updated:')
      
      // Get sample of items that would be updated
      const sampleItems = await prisma.roomFFEItem.findMany({
        where: {
          visibility: null
        },
        take: Math.min(10, itemsToMigrateCount),
        select: {
          id: true,
          name: true,
          roomId: true,
          room: {
            select: {
              name: true
            }
          }
        }
      })

      sampleItems.forEach(item => {
        console.log(`  - ${item.name} (Room: ${item.room.name}, ID: ${item.id})`)
      })

      if (itemsToMigrateCount > 10) {
        console.log(`  ... and ${itemsToMigrateCount - 10} more items`)
      }

      console.log()
      console.log(`🔍 All ${itemsToMigrateCount} items would be set to visibility: 'VISIBLE'`)
      console.log('   To perform the actual migration, run without --dry-run flag')
      
      return
    }

    // Perform the actual migration in batches
    let migratedCount = 0
    let currentBatch = 0

    console.log()
    console.log('🚀 Starting migration...')

    while (migratedCount < itemsToMigrateCount) {
      currentBatch++
      const batchStart = Date.now()

      // Get a batch of items to update
      const itemBatch = await prisma.roomFFEItem.findMany({
        where: {
          visibility: null
        },
        take: batchSize,
        select: {
          id: true
        }
      })

      if (itemBatch.length === 0) {
        break // No more items to process
      }

      // Update the batch
      const result = await prisma.roomFFEItem.updateMany({
        where: {
          id: {
            in: itemBatch.map(item => item.id)
          }
        },
        data: {
          visibility: 'VISIBLE'
        }
      })

      migratedCount += result.count
      const batchTime = Date.now() - batchStart

      console.log(`   Batch ${currentBatch}: Updated ${result.count} items (${batchTime}ms)`)
      console.log(`   Progress: ${migratedCount}/${itemsToMigrateCount} (${Math.round((migratedCount / itemsToMigrateCount) * 100)}%)`)

      // Small delay to prevent overwhelming the database
      if (migratedCount < itemsToMigrateCount) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log()
    console.log('✅ Migration completed successfully!')
    console.log(`📊 Total items updated: ${migratedCount}`)

    // Verify the migration
    const remainingItems = await prisma.roomFFEItem.count({
      where: {
        visibility: null
      }
    })

    if (remainingItems === 0) {
      console.log('🔍 Verification: All FFE items now have visibility set')
    } else {
      console.warn(`⚠️  Warning: ${remainingItems} items still have null visibility`)
    }

    // Show final statistics
    const totalItems = await prisma.roomFFEItem.count()
    const visibleItems = await prisma.roomFFEItem.count({
      where: { visibility: 'VISIBLE' }
    })
    const hiddenItems = await prisma.roomFFEItem.count({
      where: { visibility: 'HIDDEN' }
    })

    console.log()
    console.log('📈 Final FFE visibility statistics:')
    console.log(`   Total items: ${totalItems}`)
    console.log(`   Visible items: ${visibleItems}`)
    console.log(`   Hidden items: ${hiddenItems}`)

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Helper function to create backup
async function createBackup() {
  console.log('💾 Creating backup of current FFE item data...')
  
  try {
    const backupData = await prisma.roomFFEItem.findMany({
      select: {
        id: true,
        name: true,
        visibility: true,
        roomId: true,
        createdAt: true,
        updatedAt: true
      }
    })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFile = `ffe-backup-${timestamp}.json`
    
    require('fs').writeFileSync(
      backupFile, 
      JSON.stringify(backupData, null, 2)
    )
    
    console.log(`✅ Backup created: ${backupFile}`)
    console.log(`   Backed up ${backupData.length} FFE items`)
    console.log()
  } catch (error) {
    console.error('❌ Failed to create backup:', error)
    throw error
  }
}

// Main execution
async function main() {
  console.log('==========================================')
  console.log('  FFE Visibility Migration Script')
  console.log('==========================================')
  console.log()

  if (!isDryRun) {
    await createBackup()
  }

  await migrateFFEVisibility()

  console.log()
  console.log('🎉 Migration script completed')
  console.log('==========================================')
}

// Run the migration
main()
  .catch((error) => {
    console.error('💥 Migration script failed:', error)
    process.exit(1)
  })
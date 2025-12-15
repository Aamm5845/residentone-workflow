/**
 * Script to check where photos are stored for a specific project
 * Run with: npx tsx scripts/check-photo-storage.ts <projectId>
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPhotoStorage(projectId: string) {
  console.log('\n📸 Photo Storage Check for Project:', projectId)
  console.log('='.repeat(60))

  // Get project info
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      dropboxFolder: true
    }
  })

  if (!project) {
    console.log('❌ Project not found!')
    return
  }

  console.log('\n📁 Project:', project.name)
  console.log('📂 Dropbox Folder:', project.dropboxFolder || '❌ NOT CONFIGURED')
  console.log('')

  // Get all assets for this project
  const assets = await prisma.asset.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 50 // Last 50 assets
  })

  console.log(`\n📊 Found ${assets.length} assets for this project:\n`)

  let dropboxCount = 0
  let databaseCount = 0
  let emptyCount = 0

  for (const asset of assets) {
    let metadata: any = {}
    try {
      metadata = asset.metadata ? JSON.parse(asset.metadata as string) : {}
    } catch (e) {}

    const dropboxPath = metadata?.dropboxPath || (asset.url?.startsWith('/') ? asset.url : null)
    const isBase64 = asset.url?.startsWith('data:')
    const isEmpty = !asset.url || asset.url === ''

    let storageLocation = ''
    let icon = ''

    if (dropboxPath) {
      storageLocation = `DROPBOX: ${dropboxPath}`
      icon = '☁️'
      dropboxCount++
    } else if (isBase64) {
      storageLocation = 'DATABASE (base64)'
      icon = '💾'
      databaseCount++
    } else if (isEmpty) {
      storageLocation = 'EMPTY/FAILED'
      icon = '⚠️'
      emptyCount++
    } else {
      storageLocation = `OTHER: ${asset.url?.substring(0, 50)}...`
      icon = '❓'
    }

    console.log(`${icon} ${asset.filename || asset.title || 'Unknown'}`)
    console.log(`   Created: ${asset.createdAt.toISOString()}`)
    console.log(`   Storage: ${storageLocation}`)
    console.log('')
  }

  console.log('='.repeat(60))
  console.log('📊 SUMMARY:')
  console.log(`   ☁️  Dropbox: ${dropboxCount} photos`)
  console.log(`   💾 Database: ${databaseCount} photos`)
  console.log(`   ⚠️  Empty/Failed: ${emptyCount} photos`)
  console.log('')

  if (dropboxCount === 0 && assets.length > 0) {
    console.log('⚠️  WARNING: No photos are in Dropbox!')
    if (!project.dropboxFolder) {
      console.log('   Reason: Project does not have a Dropbox folder configured')
    } else {
      console.log('   Reason: Photos may have been uploaded before Dropbox was configured,')
      console.log('           or there was an error during Dropbox upload.')
    }
  }
}

// Get project ID from command line
const projectId = process.argv[2]

if (!projectId) {
  console.log('Usage: npx tsx scripts/check-photo-storage.ts <projectId>')
  console.log('')
  console.log('To find your project ID:')
  console.log('  - Go to the project in the app')
  console.log('  - Look at the URL: /projects/[PROJECT_ID]/')
  process.exit(1)
}

checkPhotoStorage(projectId)
  .catch(console.error)
  .finally(() => prisma.$disconnect())


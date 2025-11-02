import { prisma } from '../src/lib/prisma'

async function analyzeBlobStorage() {
  console.log('🔍 Analyzing Vercel Blob Storage Usage...\n')

  // Get all assets stored in Vercel Blob
  const blobAssets = await prisma.asset.findMany({
    where: {
      OR: [
        { provider: 'vercel-blob' },
        { url: { startsWith: 'https://blob.vercel' } },
        { url: { contains: '.vercel-storage.com' } }
      ]
    },
    include: {
      project: {
        select: { name: true, id: true }
      },
      room: {
        select: { name: true, type: true }
      },
      renderingVersion: {
        select: { version: true }
      }
    },
    orderBy: {
      size: 'desc'
    }
  })

  console.log(`📊 Total Blob Assets: ${blobAssets.length}`)
  
  // Calculate total size
  const totalSize = blobAssets.reduce((sum, asset) => sum + (asset.size || 0), 0)
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)
  const totalSizeGB = (totalSize / (1024 * 1024 * 1024)).toFixed(3)
  
  console.log(`💾 Total Size: ${totalSizeMB} MB (${totalSizeGB} GB)`)
  console.log(`📈 Quota: 1 GB (${(parseFloat(totalSizeGB) / 1 * 100).toFixed(1)}% used)\n`)

  // Group by type
  console.log('📁 By Asset Type:')
  const byType = blobAssets.reduce((acc, asset) => {
    const type = asset.type || 'UNKNOWN'
    if (!acc[type]) {
      acc[type] = { count: 0, size: 0 }
    }
    acc[type].count++
    acc[type].size += asset.size || 0
    return acc
  }, {} as Record<string, { count: number; size: number }>)

  Object.entries(byType)
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([type, data]) => {
      const sizeMB = (data.size / (1024 * 1024)).toFixed(2)
      const percent = ((data.size / totalSize) * 100).toFixed(1)
      console.log(`  ${type}: ${data.count} files, ${sizeMB} MB (${percent}%)`)
    })

  // Group by project
  console.log('\n🏢 By Project:')
  const byProject = blobAssets.reduce((acc, asset) => {
    const projectName = asset.project?.name || 'Unknown Project'
    const projectId = asset.projectId || 'unknown'
    const key = `${projectName} (${projectId})`
    
    if (!acc[key]) {
      acc[key] = { count: 0, size: 0 }
    }
    acc[key].count++
    acc[key].size += asset.size || 0
    return acc
  }, {} as Record<string, { count: number; size: number }>)

  Object.entries(byProject)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10) // Top 10 projects
    .forEach(([project, data]) => {
      const sizeMB = (data.size / (1024 * 1024)).toFixed(2)
      const percent = ((data.size / totalSize) * 100).toFixed(1)
      console.log(`  ${project}: ${data.count} files, ${sizeMB} MB (${percent}%)`)
    })

  // Group by MIME type
  console.log('\n🖼️  By File Type:')
  const byMimeType = blobAssets.reduce((acc, asset) => {
    const mime = asset.mimeType || 'unknown'
    if (!acc[mime]) {
      acc[mime] = { count: 0, size: 0 }
    }
    acc[mime].count++
    acc[mime].size += asset.size || 0
    return acc
  }, {} as Record<string, { count: number; size: number }>)

  Object.entries(byMimeType)
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([mime, data]) => {
      const sizeMB = (data.size / (1024 * 1024)).toFixed(2)
      const percent = ((data.size / totalSize) * 100).toFixed(1)
      console.log(`  ${mime}: ${data.count} files, ${sizeMB} MB (${percent}%)`)
    })

  // Largest files
  console.log('\n🔝 Top 20 Largest Files:')
  blobAssets.slice(0, 20).forEach((asset, index) => {
    const sizeMB = ((asset.size || 0) / (1024 * 1024)).toFixed(2)
    const projectName = asset.project?.name || 'Unknown'
    const roomInfo = asset.room ? `${asset.room.name || asset.room.type}` : 'N/A'
    const versionInfo = asset.renderingVersion ? `v${asset.renderingVersion.version}` : ''
    console.log(`  ${index + 1}. ${asset.filename} - ${sizeMB} MB`)
    console.log(`     Project: ${projectName} | Room: ${roomInfo} ${versionInfo}`)
    console.log(`     Type: ${asset.type} | Uploaded: ${asset.createdAt.toLocaleDateString()}`)
    console.log(`     URL: ${asset.url.substring(0, 60)}...`)
  })

  // Check for orphaned assets (assets without project/room)
  console.log('\n🗑️  Potential Orphaned Assets:')
  const orphaned = blobAssets.filter(asset => !asset.projectId)
  const orphanedSize = orphaned.reduce((sum, asset) => sum + (asset.size || 0), 0)
  const orphanedSizeMB = (orphanedSize / (1024 * 1024)).toFixed(2)
  
  console.log(`  Found: ${orphaned.length} files, ${orphanedSizeMB} MB`)
  
  if (orphaned.length > 0) {
    orphaned.slice(0, 10).forEach((asset, index) => {
      const sizeMB = ((asset.size || 0) / (1024 * 1024)).toFixed(2)
      console.log(`    ${index + 1}. ${asset.filename} - ${sizeMB} MB (uploaded ${asset.createdAt.toLocaleDateString()})`)
    })
  }

  // Check for old files (older than 90 days)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  
  const oldAssets = blobAssets.filter(asset => asset.createdAt < ninetyDaysAgo)
  const oldSize = oldAssets.reduce((sum, asset) => sum + (asset.size || 0), 0)
  const oldSizeMB = (oldSize / (1024 * 1024)).toFixed(2)
  
  console.log(`\n📅 Files Older than 90 Days:`)
  console.log(`  Found: ${oldAssets.length} files, ${oldSizeMB} MB`)

  console.log('\n✅ Analysis complete!')
  
  await prisma.$disconnect()
}

analyzeBlobStorage().catch(console.error)

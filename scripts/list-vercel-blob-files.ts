import { list } from '@vercel/blob'

async function listAllBlobFiles() {
  console.log('🔍 Listing ALL files in Vercel Blob...\n')

  try {
    const { blobs } = await list()
    
    console.log(`📊 Total files in Vercel Blob: ${blobs.length}`)
    
    const totalSize = blobs.reduce((sum, blob) => sum + blob.size, 0)
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)
    const totalSizeGB = (totalSize / (1024 * 1024 * 1024)).toFixed(3)
    
    console.log(`💾 Total Size: ${totalSizeMB} MB (${totalSizeGB} GB)`)
    console.log(`📈 Quota Used: ${(parseFloat(totalSizeGB) * 100).toFixed(1)}%\n`)

    // Sort by size (largest first)
    const sortedBlobs = [...blobs].sort((a, b) => b.size - a.size)

    console.log('🔝 Top 50 Largest Files:\n')
    sortedBlobs.slice(0, 50).forEach((blob, index) => {
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(2)
      const uploadDate = new Date(blob.uploadedAt).toLocaleDateString()
      console.log(`${index + 1}. ${blob.pathname}`)
      console.log(`   Size: ${sizeMB} MB | Uploaded: ${uploadDate}`)
      console.log(`   URL: ${blob.url}\n`)
    })

    // Group by path prefix
    console.log('\n📁 Files by Path:')
    const byPath = blobs.reduce((acc, blob) => {
      const pathParts = blob.pathname.split('/')
      const prefix = pathParts.length > 1 ? pathParts[0] : 'root'
      
      if (!acc[prefix]) {
        acc[prefix] = { count: 0, size: 0 }
      }
      acc[prefix].count++
      acc[prefix].size += blob.size
      return acc
    }, {} as Record<string, { count: number; size: number }>)

    Object.entries(byPath)
      .sort((a, b) => b[1].size - a[1].size)
      .forEach(([path, data]) => {
        const sizeMB = (data.size / (1024 * 1024)).toFixed(2)
        const percent = ((data.size / totalSize) * 100).toFixed(1)
        console.log(`  ${path}: ${data.count} files, ${sizeMB} MB (${percent}%)`)
      })

  } catch (error) {
    console.error('❌ Error listing Vercel Blob files:', error)
    console.error('\nMake sure BLOB_READ_WRITE_TOKEN is set in your .env file')
  }
}

listAllBlobFiles().catch(console.error)

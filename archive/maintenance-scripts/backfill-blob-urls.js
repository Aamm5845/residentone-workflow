require('dotenv').config({ path: '.env.local' })

// Remove quotes from DATABASE_URL if present
if (process.env.DATABASE_URL?.startsWith('"')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/^"|"$/g, '')
}

const { PrismaClient } = require('@prisma/client')
const { Dropbox } = require('dropbox')
const { put } = require('@vercel/blob')

const prisma = new PrismaClient()

// Dropbox client setup
const dropboxClient = new Dropbox({
  accessToken: process.env.DROPBOX_ACCESS_TOKEN,
  refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
  clientId: process.env.DROPBOX_APP_KEY,
  clientSecret: process.env.DROPBOX_APP_SECRET,
  selectUser: process.env.DROPBOX_API_SELECT_USER,
})

async function backfillBlobUrls() {
  try {
    console.log('🔍 Finding client approval assets without Blob URLs...\n')
    
    // Find all client approval assets that don't have blob URLs
    const assetsWithoutBlob = await prisma.clientApprovalAsset.findMany({
      where: {
        blobUrl: null,
        asset: {
          provider: 'dropbox'
        }
      },
      include: {
        asset: true,
        version: {
          include: {
            stage: {
              include: {
                room: {
                  include: {
                    project: true
                  }
                }
              }
            }
          }
        }
      },
      take: 10 // Process 10 at a time to avoid overwhelming the system
    })
    
    console.log(`Found ${assetsWithoutBlob.length} assets to backfill\n`)
    
    for (const clientAsset of assetsWithoutBlob) {
      try {
        const asset = clientAsset.asset
        console.log(`📦 Processing: ${asset.filename}`)
        console.log(`   Dropbox path: ${asset.url}`)
        
        // Ensure path starts with /
        const dropboxPath = asset.url.startsWith('/') ? asset.url : '/' + asset.url
        
        // Download from Dropbox
        const response = await dropboxClient.filesDownload({ path: dropboxPath })
        const fileBuffer = Buffer.from(response.result.fileBinary)
        
        console.log(`   ✓ Downloaded ${fileBuffer.length} bytes`)
        
        // Generate blob path
        const project = clientAsset.version.stage.room.project
        const blobPath = `orgs/${project.orgId}/projects/${project.id}/client-approval/${clientAsset.versionId}/${asset.filename}`
        
        // Upload to Blob
        const blobResult = await put(blobPath, fileBuffer, {
          access: 'public',
          contentType: asset.mimeType || 'image/jpeg'
        })
        
        console.log(`   ✓ Uploaded to Blob: ${blobResult.url}`)
        
        // Update database
        await prisma.clientApprovalAsset.update({
          where: { id: clientAsset.id },
          data: { blobUrl: blobResult.url }
        })
        
        console.log(`   ✅ Updated database\n`)
        
      } catch (assetError) {
        console.error(`   ❌ Failed to process asset ${clientAsset.asset.filename}:`, assetError.message, '\n')
      }
    }
    
    console.log('\n✅ Backfill complete!')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

backfillBlobUrls()

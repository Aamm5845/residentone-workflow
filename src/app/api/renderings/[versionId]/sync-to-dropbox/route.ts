import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'

export const runtime = 'nodejs'
export const maxDuration = 120 // 2 minutes for syncing multiple files

// POST /api/renderings/[versionId]/sync-to-dropbox - Re-sync rendering assets to Dropbox
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { versionId } = resolvedParams

    // Get rendering version with all related data
    const renderingVersion = await prisma.renderingVersion.findFirst({
      where: { id: versionId },
      include: {
        room: {
          include: {
            project: true
          }
        },
        assets: true
      }
    })

    if (!renderingVersion) {
      return NextResponse.json({ error: 'Rendering version not found' }, { status: 404 })
    }

    // Check if project has Dropbox integration
    if (!renderingVersion.room.project.dropboxFolder) {
      return NextResponse.json({ 
        error: 'Project does not have Dropbox integration enabled' 
      }, { status: 400 })
    }

    // Prepare room folder name
    let roomName = renderingVersion.room.name && renderingVersion.room.name.trim()
    if (!roomName) {
      // Convert enum value to readable format: ENTRANCE -> Entrance
      roomName = renderingVersion.room.type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    }
    
    // Sanitize folder name
    const sanitizedRoomName = roomName
      .replace(/[<>:"\/\\|?*]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\.$/, '')
      .trim()

    const baseFolderPath = `${renderingVersion.room.project.dropboxFolder}/3- RENDERING`
    const roomFolderPath = `${baseFolderPath}/${sanitizedRoomName}`
    const versionFolderPath = `${roomFolderPath}/${renderingVersion.version}`

    console.log(`[Dropbox Sync] Starting sync for ${renderingVersion.assets.length} assets`)
    console.log(`[Dropbox Sync] Target path: ${versionFolderPath}`)

    // Create folder structure
    const foldersCreated = []
    try {
      await dropboxService.createFolder(baseFolderPath)
      foldersCreated.push(baseFolderPath)
      console.log(`[Dropbox Sync] ✅ Created/verified base folder: ${baseFolderPath}`)
    } catch (err: any) {
      if (err?.error?.error?.['.tag'] !== 'path' || err?.error?.error?.path?.['.tag'] !== 'conflict') {
        console.warn(`[Dropbox Sync] Could not create base folder:`, err?.message || err)
      }
    }

    try {
      await dropboxService.createFolder(roomFolderPath)
      foldersCreated.push(roomFolderPath)
      console.log(`[Dropbox Sync] ✅ Created/verified room folder: ${roomFolderPath}`)
    } catch (err: any) {
      if (err?.error?.error?.['.tag'] !== 'path' || err?.error?.error?.path?.['.tag'] !== 'conflict') {
        console.warn(`[Dropbox Sync] Could not create room folder:`, err?.message || err)
      }
    }

    try {
      await dropboxService.createFolder(versionFolderPath)
      foldersCreated.push(versionFolderPath)
      console.log(`[Dropbox Sync] ✅ Created/verified version folder: ${versionFolderPath}`)
    } catch (err: any) {
      if (err?.error?.error?.['.tag'] !== 'path' || err?.error?.error?.path?.['.tag'] !== 'conflict') {
        console.warn(`[Dropbox Sync] Could not create version folder:`, err?.message || err)
      }
    }

    // Process each asset
    const results = {
      synced: [] as string[],
      skipped: [] as string[],
      failed: [] as { filename: string; error: string }[]
    }

    for (const asset of renderingVersion.assets) {
      try {
        // Check if asset is already in Dropbox and has correct path
        const expectedPath = `${versionFolderPath}/${asset.filename}`
        
        if (asset.provider === 'dropbox' && asset.url === expectedPath) {
          // Verify file exists in Dropbox
          try {
            await dropboxService.getFileMetadata(asset.url)
            results.skipped.push(asset.filename)
            console.log(`[Dropbox Sync] ⏭️ Skipped (already exists): ${asset.filename}`)
            continue
          } catch {
            // File doesn't exist at expected path, need to re-upload
            console.log(`[Dropbox Sync] File not found at expected path, will try to recover: ${asset.filename}`)
          }
        }

        // Try to get file from current location (if it's in Dropbox somewhere)
        let fileBuffer: Buffer | null = null
        
        if (asset.provider === 'dropbox' && asset.url) {
          try {
            fileBuffer = await dropboxService.downloadFile(asset.url)
            console.log(`[Dropbox Sync] Downloaded from current location: ${asset.url}`)
          } catch (downloadErr) {
            console.warn(`[Dropbox Sync] Could not download from ${asset.url}:`, downloadErr)
          }
        }

        if (!fileBuffer) {
          // Try to get from blob URL if available
          if (asset.url?.startsWith('http')) {
            try {
              const response = await fetch(asset.url)
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer()
                fileBuffer = Buffer.from(arrayBuffer)
                console.log(`[Dropbox Sync] Downloaded from URL: ${asset.url}`)
              }
            } catch (fetchErr) {
              console.warn(`[Dropbox Sync] Could not fetch from URL:`, fetchErr)
            }
          }
        }

        if (!fileBuffer) {
          results.failed.push({ 
            filename: asset.filename, 
            error: 'Could not retrieve file content from any source' 
          })
          continue
        }

        // Upload to correct location in Dropbox
        const dropboxFilePath = `${versionFolderPath}/${asset.filename}`
        await dropboxService.uploadFile(dropboxFilePath, fileBuffer)
        
        // Update asset record with new path
        await prisma.asset.update({
          where: { id: asset.id },
          data: {
            url: dropboxFilePath,
            provider: 'dropbox'
          }
        })

        results.synced.push(asset.filename)
        console.log(`[Dropbox Sync] ✅ Synced: ${asset.filename} -> ${dropboxFilePath}`)

      } catch (assetError: any) {
        results.failed.push({ 
          filename: asset.filename, 
          error: assetError?.message || 'Unknown error' 
        })
        console.error(`[Dropbox Sync] ❌ Failed to sync ${asset.filename}:`, assetError)
      }
    }

    console.log(`[Dropbox Sync] Complete. Synced: ${results.synced.length}, Skipped: ${results.skipped.length}, Failed: ${results.failed.length}`)

    return NextResponse.json({
      success: true,
      roomName: sanitizedRoomName,
      versionFolder: versionFolderPath,
      results
    })

  } catch (error: any) {
    console.error('[Dropbox Sync] Error:', error)
    return NextResponse.json({ 
      error: error?.message || 'Failed to sync to Dropbox' 
    }, { status: 500 })
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'

export const dynamic = 'force-dynamic'

// POST /api/admin/restore-complete - Restore complete backup with files
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Only allow OWNER to restore complete backups
    if (!session?.user || session.user.role !== 'OWNER') {
      return NextResponse.json({ 
        error: 'Unauthorized - OWNER access required for complete restore' 
      }, { status: 401 })
    }

    const body = await request.json()
    const { backup_data, confirm_restore, restore_files } = body

    if (!confirm_restore) {
      return NextResponse.json({ 
        error: 'Confirmation required - set confirm_restore: true' 
      }, { status: 400 })
    }

    if (!backup_data || !backup_data.data) {
      return NextResponse.json({ 
        error: 'Invalid backup format - missing data section' 
      }, { status: 400 })
    }

    // Validate backup format - support both v2.0 and v3.0
    const isValidVersion = backup_data.version === '2.0' || backup_data.version === '3.0'
    const isValidType = backup_data.type === 'complete' || backup_data.metadata?.includes_files === true
    
    if (!isValidVersion && !isValidType) {
      return NextResponse.json({ 
        error: 'Invalid backup format - expected complete backup v2.0 or v3.0' 
      }, { status: 400 })
    }

    const { data, files } = backup_data
    let restoredFiles = 0
    let failedFiles = 0

    // Clear all data first (in separate transaction to avoid timeout)
    await prisma.$transaction(async (tx) => {
      // Clear all data in reverse dependency order
      await tx.clientAccessLog.deleteMany({})
      await tx.clientAccessToken.deleteMany({})
      await tx.userSession.deleteMany({})
      await tx.passwordResetToken.deleteMany({})
      await tx.verificationToken.deleteMany({})
      await tx.session.deleteMany({})
      await tx.account.deleteMany({})
      await tx.activityLog.deleteMany({})
      await tx.notification.deleteMany({})
      await tx.task.deleteMany({})
      await tx.projectContractor.deleteMany({})
      await tx.comment.deleteMany({})
      await tx.approval.deleteMany({})
      await tx.asset.deleteMany({})
      await tx.designSection.deleteMany({})
      await tx.fFEItem.deleteMany({})
      await tx.stage.deleteMany({})
      await tx.room.deleteMany({})
      await tx.project.deleteMany({})
      await tx.contractor.deleteMany({})
      await tx.client.deleteMany({})
      await tx.user.deleteMany({})
      await tx.organization.deleteMany({})
      await tx.roomPreset.deleteMany({})
    }, {
      timeout: 15000,
    })

    // Restore core data (organizations, users, clients) in first transaction
    await prisma.$transaction(async (tx) => {
      if (data.organizations?.length > 0) {
        await tx.organization.createMany({ data: data.organizations })
      }

      if (data.users?.length > 0) {
        const userData = data.users.map((user: any) => {
          const { accounts, sessions, userSessions, ...userWithoutRelations } = user
          return userWithoutRelations
        })
        await tx.user.createMany({ data: userData })
      }

      if (data.clients?.length > 0) {
        await tx.client.createMany({ data: data.clients })
      }

      if (data.contractors?.length > 0) {
        await tx.contractor.createMany({ data: data.contractors })
      }
    }, {
      timeout: 15000,
    })

    // Restore project data in second transaction
    await prisma.$transaction(async (tx) => {
      if (data.projects?.length > 0) {
        await tx.project.createMany({ data: data.projects })
      }

      if (data.rooms?.length > 0) {
        await tx.room.createMany({ data: data.rooms })
      }

      if (data.stages?.length > 0) {
        await tx.stage.createMany({ data: data.stages })
      }
    }, {
      timeout: 15000,
    })

    // Restore detailed data in third transaction
    await prisma.$transaction(async (tx) => {
      if (data.designSections?.length > 0) {
        await tx.designSection.createMany({ data: data.designSections })
      }

      if (data.ffeItems?.length > 0) {
        await tx.fFEItem.createMany({ data: data.ffeItems })
      }

      if (data.assets?.length > 0) {
        // Find a valid user ID and org ID for assets missing required fields
        const fallbackUserId = data.users?.find(user => user.role === 'OWNER')?.id || 
                               data.users?.[0]?.id || 
                               session.user.id // Use current session user as last resort
        const fallbackOrgId = data.organizations?.[0]?.id || 
                              data.users?.[0]?.orgId || 
                              session.user.orgId // Use org from backup or session
        
        const assetsWithCorrectFields = data.assets.map(asset => {
          // Determine asset type from filename or mimeType
          let assetType = asset.type || 'OTHER'
          if (!asset.type) {
            if (asset.mimeType) {
              if (asset.mimeType.startsWith('image/')) {
                assetType = 'IMAGE'
              } else if (asset.mimeType === 'application/pdf') {
                assetType = 'PDF'
              } else if (asset.mimeType.startsWith('video/')) {
                assetType = 'OTHER'
              } else {
                assetType = 'DOCUMENT'
              }
            } else if (asset.filename) {
              const ext = asset.filename.split('.').pop()?.toLowerCase()
              if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
                assetType = 'IMAGE'
              } else if (ext === 'pdf') {
                assetType = 'PDF'
              } else {
                assetType = 'DOCUMENT'
              }
            }
          }
          
          return {
            ...asset,
            title: asset.title || asset.filename || 'Untitled Asset',
            filename: asset.filename || null,
            type: assetType,
            uploadedBy: asset.uploadedBy || fallbackUserId,
            orgId: asset.orgId || fallbackOrgId
          }
        })
        await tx.asset.createMany({ data: assetsWithCorrectFields })
      }
    }, {
      timeout: 15000,
    })

    // Restore relationships and secondary data in fourth transaction
    await prisma.$transaction(async (tx) => {
      if (data.projectContractors?.length > 0) {
        await tx.projectContractor.createMany({ data: data.projectContractors })
      }

      if (data.approvals?.length > 0) {
        await tx.approval.createMany({ data: data.approvals })
      }

      if (data.comments?.length > 0) {
        await tx.comment.createMany({ data: data.comments })
      }

      if (data.tasks?.length > 0) {
        await tx.task.createMany({ data: data.tasks })
      }
    }, {
      timeout: 15000,
    })

    // Restore system data in fifth transaction
    await prisma.$transaction(async (tx) => {
      if (data.notifications?.length > 0) {
        await tx.notification.createMany({ data: data.notifications })
      }

      if (data.clientAccessTokens?.length > 0) {
        await tx.clientAccessToken.createMany({ data: data.clientAccessTokens })
      }

      if (data.clientAccessLogs?.length > 0) {
        await tx.clientAccessLog.createMany({ data: data.clientAccessLogs })
      }

      if (data.clientAccessLogs?.length > 0) {
        await tx.clientAccessLog.createMany({ data: data.clientAccessLogs })
      }

      if (data.roomPresets?.length > 0) {
        await tx.roomPreset.createMany({ data: data.roomPresets })
      }

      if (data.activityLogs?.length > 0) {
        await tx.activityLog.createMany({ data: data.activityLogs })
      }
    }, {
      timeout: 15000,
    })

    // Restore authentication data in final transaction
    await prisma.$transaction(async (tx) => {
      if (data.accounts?.length > 0) {
        await tx.account.createMany({ data: data.accounts })
      }

      if (data.sessions?.length > 0) {
        await tx.session.createMany({ data: data.sessions })
      }

      if (data.verificationTokens?.length > 0) {
        await tx.verificationToken.createMany({ data: data.verificationTokens })
      }

      if (data.passwordResetTokens?.length > 0) {
        await tx.passwordResetToken.createMany({ data: data.passwordResetTokens })
      }

      if (data.userSessions?.length > 0) {
        await tx.userSession.createMany({ data: data.userSessions })
      }
    }, {
      timeout: 15000,
    })

    // Restore files if requested and available
    if (restore_files && files && Object.keys(files).length > 0) {
      console.log(`💾 Starting file restoration for ${Object.keys(files).length} files...`)
      
      for (const [assetId, fileDataStr] of Object.entries(files)) {
        try {
          const fileData = JSON.parse(fileDataStr as string)
          
          if (fileData.content && fileData.originalUrl) {
            // Decode base64 content back to buffer
            const buffer = Buffer.from(fileData.content, 'base64')
            
            // Re-upload to Dropbox at original path
            try {
              await dropboxService.uploadFile(fileData.originalUrl, buffer, { mode: 'overwrite' })
              
              // Update asset URL in database to confirm it's restored
              await prisma.asset.update({
                where: { id: assetId },
                data: { 
                  url: fileData.originalUrl,
                  size: fileData.size,
                  mimeType: fileData.mimeType
                }
              })
              
              restoredFiles++
              if (restoredFiles % 10 === 0) {
                console.log(`💾 Restored ${restoredFiles}/${Object.keys(files).length} files`)
              }
            } catch (uploadError) {
              console.error(`❌ Failed to upload file ${assetId} to Dropbox:`, uploadError)
              failedFiles++
            }
          } else {
            console.warn(`⚠️ File ${assetId} missing content or URL`)
            failedFiles++
          }
        } catch (error) {
          console.error(`❌ Failed to restore file ${assetId}:`, error)
          failedFiles++
        }
      }
      
      console.log(`✅ File restoration complete: ${restoredFiles} succeeded, ${failedFiles} failed`)
    }

    return NextResponse.json({
      success: true,
      message: 'Complete database restore successful',
      restored_from: backup_data.timestamp,
      restored_by: session.user.email,
      restored_at: new Date().toISOString(),
      restore_type: 'complete',
      includes_passwords: true,
      includes_files: restore_files || false,
      files_restored: restoredFiles,
      files_failed: failedFiles,
      warning: 'All users, passwords, and authentication data have been restored'
    })

  } catch (error) {
    console.error('❌ Complete restore failed:', error)
    return NextResponse.json({ 
      error: 'Complete restore failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      note: 'Database may be in inconsistent state - check data carefully'
    }, { status: 500 })
  }
}

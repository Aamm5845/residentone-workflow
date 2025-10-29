import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

// POST /api/admin/restore - Restore database from backup file
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Only allow OWNER to restore (more restrictive than backup)
    if (!session?.user || session.user.role !== 'OWNER') {
      return NextResponse.json({ 
        error: 'Unauthorized - OWNER access required for restore operations' 
      }, { status: 401 })
    }

    const body = await request.json()
    const { backup_data, confirm_restore } = body

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

    // Validate backup format
    if (backup_data.version !== '1.0' || backup_data.type !== 'production') {
      return NextResponse.json({ 
        error: 'Invalid backup format or version' 
      }, { status: 400 })
    }

    const { data } = backup_data

    // Begin transaction for safe restore with extended timeout
    await prisma.$transaction(async (tx) => {
      
      // Clear data in reverse dependency order to avoid foreign key conflicts
      await tx.clientAccessLog.deleteMany({})
      await tx.clientAccessToken.deleteMany({})
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
      await tx.floor.deleteMany({})
      await tx.project.deleteMany({})
      await tx.contractor.deleteMany({})
      await tx.client.deleteMany({})
      
      // Don't delete users or organizations to preserve authentication
      // await tx.user.deleteMany({})
      // await tx.organization.deleteMany({})

      // Restore data in dependency order
      if (data.organizations?.length > 0) {
        await tx.organization.createMany({ 
          data: data.organizations,
          skipDuplicates: true // In case org already exists
        })
        
      }

      if (data.users?.length > 0) {
        await tx.user.createMany({ 
          data: data.users,
          skipDuplicates: true // In case current user already exists
        })
        
      }

      if (data.clients?.length > 0) {
        await tx.client.createMany({ data: data.clients })
        
      }

      if (data.contractors?.length > 0) {
        await tx.contractor.createMany({ data: data.contractors })
        
      }

      if (data.projects?.length > 0) {
        await tx.project.createMany({ data: data.projects })
        
      }

      if (data.rooms?.length > 0) {
        await tx.room.createMany({ data: data.rooms })
        
      }

      if (data.stages?.length > 0) {
        await tx.stage.createMany({ data: data.stages })
        
      }

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
        
        // Map backup asset fields to Prisma schema fields
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

      if (data.notifications?.length > 0) {
        await tx.notification.createMany({ data: data.notifications })
        
      }

      if (data.clientAccessTokens?.length > 0) {
        // Add back the actual tokens - they were excluded from backup for security
        const tokensWithGenerated = data.clientAccessTokens.map(token => ({
          ...token,
          token: token.id // Use ID as token, or generate new ones
        }))
        await tx.clientAccessToken.createMany({ data: tokensWithGenerated })
        
      }

      if (data.clientAccessLogs?.length > 0) {
        await tx.clientAccessLog.createMany({ data: data.clientAccessLogs })
        
      }
    }, {
      timeout: 15000, // 15 seconds - maximum allowed by Prisma Accelerate
    })

    return NextResponse.json({
      success: true,
      message: 'Database restored successfully',
      restored_from: backup_data.timestamp,
      restored_by: session.user.email,
      restored_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Restore failed:', error)
    return NextResponse.json({ 
      error: 'Restore failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      note: 'Database may be in inconsistent state - check data carefully'
    }, { status: 500 })
  }
}

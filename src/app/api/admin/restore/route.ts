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

    console.log('🔄 Starting production database restore...')
    console.log(`📅 Backup from: ${backup_data.timestamp}`)
    console.log(`👤 Restoring as: ${session.user.email}`)

    // Validate backup format
    if (backup_data.version !== '1.0' || backup_data.type !== 'production') {
      return NextResponse.json({ 
        error: 'Invalid backup format or version' 
      }, { status: 400 })
    }

    const { data } = backup_data

    // Begin transaction for safe restore
    await prisma.$transaction(async (tx) => {
      console.log('🗑️ Clearing existing data...')
      
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

      console.log('📦 Restoring data...')
      
      // Restore data in dependency order
      if (data.organizations?.length > 0) {
        await tx.organization.createMany({ 
          data: data.organizations,
          skipDuplicates: true // In case org already exists
        })
        console.log(`✅ Restored ${data.organizations.length} organizations`)
      }

      if (data.users?.length > 0) {
        await tx.user.createMany({ 
          data: data.users,
          skipDuplicates: true // In case current user already exists
        })
        console.log(`✅ Restored ${data.users.length} users`)
      }

      if (data.clients?.length > 0) {
        await tx.client.createMany({ data: data.clients })
        console.log(`✅ Restored ${data.clients.length} clients`)
      }

      if (data.contractors?.length > 0) {
        await tx.contractor.createMany({ data: data.contractors })
        console.log(`✅ Restored ${data.contractors.length} contractors`)
      }

      if (data.projects?.length > 0) {
        await tx.project.createMany({ data: data.projects })
        console.log(`✅ Restored ${data.projects.length} projects`)
      }

      if (data.floors?.length > 0) {
        await tx.floor.createMany({ data: data.floors })
        console.log(`✅ Restored ${data.floors.length} floors`)
      }

      if (data.rooms?.length > 0) {
        await tx.room.createMany({ data: data.rooms })
        console.log(`✅ Restored ${data.rooms.length} rooms`)
      }

      if (data.stages?.length > 0) {
        await tx.stage.createMany({ data: data.stages })
        console.log(`✅ Restored ${data.stages.length} stages`)
      }

      if (data.designSections?.length > 0) {
        await tx.designSection.createMany({ data: data.designSections })
        console.log(`✅ Restored ${data.designSections.length} design sections`)
      }

      if (data.ffeItems?.length > 0) {
        await tx.fFEItem.createMany({ data: data.ffeItems })
        console.log(`✅ Restored ${data.ffeItems.length} FFE items`)
      }

      if (data.assets?.length > 0) {
        await tx.asset.createMany({ data: data.assets })
        console.log(`✅ Restored ${data.assets.length} assets`)
      }

      if (data.projectContractors?.length > 0) {
        await tx.projectContractor.createMany({ data: data.projectContractors })
        console.log(`✅ Restored ${data.projectContractors.length} project contractors`)
      }

      if (data.approvals?.length > 0) {
        await tx.approval.createMany({ data: data.approvals })
        console.log(`✅ Restored ${data.approvals.length} approvals`)
      }

      if (data.comments?.length > 0) {
        await tx.comment.createMany({ data: data.comments })
        console.log(`✅ Restored ${data.comments.length} comments`)
      }

      if (data.tasks?.length > 0) {
        await tx.task.createMany({ data: data.tasks })
        console.log(`✅ Restored ${data.tasks.length} tasks`)
      }

      if (data.notifications?.length > 0) {
        await tx.notification.createMany({ data: data.notifications })
        console.log(`✅ Restored ${data.notifications.length} notifications`)
      }

      if (data.clientAccessTokens?.length > 0) {
        // Add back the actual tokens - they were excluded from backup for security
        const tokensWithGenerated = data.clientAccessTokens.map(token => ({
          ...token,
          token: token.id // Use ID as token, or generate new ones
        }))
        await tx.clientAccessToken.createMany({ data: tokensWithGenerated })
        console.log(`✅ Restored ${data.clientAccessTokens.length} client access tokens`)
      }

      if (data.clientAccessLogs?.length > 0) {
        await tx.clientAccessLog.createMany({ data: data.clientAccessLogs })
        console.log(`✅ Restored ${data.clientAccessLogs.length} client access logs`)
      }
    })

    console.log('✅ Production database restore completed successfully!')

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
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function completeUserCleanup() {
  try {
    console.log('🧹 Complete user cleanup with foreign key handling...\n')

    // Our 4-person team emails
    const teamEmails = [
      'aaron@meisnerinteriors.com',
      'shaya@meisnerinteriors.com', 
      'sami@meisnerinteriors.com',
      'euvi.3d@gmail.com'
    ]

    // Get current team members
    const currentTeam = await prisma.user.findMany({
      where: {
        email: { in: teamEmails }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })

    const aaron = currentTeam.find(m => m.role === 'OWNER')
    
    // Get old users that still exist
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            createdProjects: true,
            uploadedAssets: true,
            comments: true,
            assignedStages: true
          }
        }
      }
    })

    const oldUsers = allUsers.filter(user => !teamEmails.includes(user.email))
    
    console.log(`Found ${oldUsers.length} old users still in database:`)
    oldUsers.forEach(user => {
      console.log(`   • ${user.name || 'No name'} - ${user.email}`)
      console.log(`     Projects: ${user._count.createdProjects}, Assets: ${user._count.uploadedAssets}, Comments: ${user._count.comments}, Stages: ${user._count.assignedStages}`)
    })

    if (oldUsers.length === 0) {
      console.log('✅ No old users found! Database is clean.')
      return
    }

    console.log('\n🔄 Transferring ownership and cleaning up...')

    for (const oldUser of oldUsers) {
      console.log(`\nProcessing ${oldUser.name || oldUser.email}...`)

      // 1. Transfer project ownership to Aaron
      if (oldUser._count.createdProjects > 0) {
        const projectUpdate = await prisma.project.updateMany({
          where: { createdById: oldUser.id },
          data: { 
            createdById: aaron?.id,
            updatedById: aaron?.id 
          }
        })
        console.log(`   📁 Transferred ${projectUpdate.count} projects to Aaron`)
      }

      // 2. Transfer asset ownership to Aaron
      if (oldUser._count.uploadedAssets > 0) {
        const assetUpdate = await prisma.asset.updateMany({
          where: { uploadedBy: oldUser.id },
          data: { uploadedBy: aaron?.id }
        })
        console.log(`   📎 Transferred ${assetUpdate.count} assets to Aaron`)
      }

      // 3. Transfer any remaining stage assignments
      if (oldUser._count.assignedStages > 0) {
        const stageUpdate = await prisma.stage.updateMany({
          where: { assignedTo: oldUser.id },
          data: { assignedTo: aaron?.id }
        })
        console.log(`   📋 Transferred ${stageUpdate.count} stage assignments to Aaron`)
      }

      // 4. Handle other potential foreign key constraints
      // Transfer comments authorship
      if (oldUser._count.comments > 0) {
        const commentUpdate = await prisma.comment.updateMany({
          where: { authorId: oldUser.id },
          data: { authorId: aaron?.id }
        })
        console.log(`   💬 Transferred ${commentUpdate.count} comments to Aaron`)
      }

      // Handle any other relations that might exist
      await prisma.notification.deleteMany({
        where: { userId: oldUser.id }
      })

      // Handle activity logs
      await prisma.activityLog.updateMany({
        where: { actorId: oldUser.id },
        data: { actorId: aaron?.id }
      })

      // Handle sessions
      await prisma.session.deleteMany({
        where: { userId: oldUser.id }
      })

      // Handle accounts
      await prisma.account.deleteMany({
        where: { userId: oldUser.id }
      })

      // Handle user sessions
      await prisma.userSession.deleteMany({
        where: { userId: oldUser.id }
      })

      // Now try to delete the user
      try {
        await prisma.user.delete({
          where: { id: oldUser.id }
        })
        console.log(`   ✅ Successfully deleted ${oldUser.name || oldUser.email}`)
      } catch (error) {
        console.log(`   ❌ Still couldn't delete ${oldUser.name || oldUser.email}: ${error.message}`)
        
        // If still can't delete, just remove them from org and set email to null
        await prisma.user.update({
          where: { id: oldUser.id },
          data: { 
            orgId: null,
            email: `deleted_${Date.now()}_${oldUser.email}`,
            name: `[DELETED] ${oldUser.name || 'User'}`
          }
        })
        console.log(`   🔒 Marked user as deleted and removed from org`)
      }
    }

    // Final verification
    console.log('\n✅ Final verification...')
    const remainingUsers = await prisma.user.findMany({
      where: {
        email: { 
          notIn: teamEmails.concat([null])
        },
        email: {
          not: {
            startsWith: 'deleted_'
          }
        }
      },
      select: {
        name: true,
        email: true,
        orgId: true
      }
    })

    if (remainingUsers.length === 0) {
      console.log('🎉 Perfect! Only team members remain in the database.')
    } else {
      console.log(`⚠️ ${remainingUsers.length} non-team users still exist:`)
      remainingUsers.forEach(user => {
        console.log(`   • ${user.name} - ${user.email} (orgId: ${user.orgId})`)
      })
    }

    // Show assignment dropdown users
    console.log('\n📋 Users that will appear in assignment dropdowns:')
    const dropdownUsers = await prisma.user.findMany({
      where: {
        OR: [
          { orgId: { not: null } },
          { 
            assignedStages: {
              some: {}
            }
          }
        ]
      },
      select: {
        name: true,
        email: true,
        orgId: true,
        _count: {
          select: {
            assignedStages: true
          }
        }
      }
    })

    dropdownUsers.forEach(user => {
      const status = teamEmails.includes(user.email) ? '✅ Team Member' : '⚠️ Non-team'
      console.log(`   • ${user.name} - ${user.email} [${status}] (${user._count.assignedStages} stages)`)
    })

  } catch (error) {
    console.error('❌ Error during complete cleanup:', error)
  } finally {
    await prisma.$disconnect()
  }
}

completeUserCleanup()
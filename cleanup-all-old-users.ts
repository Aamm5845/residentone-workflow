import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupAllOldUsers() {
  try {
    console.log('🧹 Finding and removing ALL old users...\n')

    // Our 4-person team emails
    const teamEmails = [
      'aaron@meisnerinteriors.com',
      'shaya@meisnerinteriors.com', 
      'sami@meisnerinteriors.com',
      'euvi.3d@gmail.com'
    ]

    // Get all users in the database
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        orgId: true,
        _count: {
          select: {
            assignedStages: true,
            comments: true,
            uploadedAssets: true,
            createdProjects: true
          }
        }
      }
    })

    console.log(`📊 Found ${allUsers.length} total users in database`)

    // Separate current team from old users
    const currentTeam = allUsers.filter(user => teamEmails.includes(user.email))
    const oldUsers = allUsers.filter(user => !teamEmails.includes(user.email))

    console.log(`\n✅ Current team (${currentTeam.length} users):`)
    currentTeam.forEach(user => {
      console.log(`   • ${user.name} (${user.role}) - ${user.email} [${user.orgId ? 'In Org' : 'No Org'}]`)
    })

    console.log(`\n🗑️ Old users to clean up (${oldUsers.length} users):`)
    oldUsers.forEach(user => {
      console.log(`   • ${user.name || 'No name'} (${user.role}) - ${user.email} [${user.orgId ? 'In Org' : 'No Org'}]`)
      console.log(`     Data: ${user._count.assignedStages} stages, ${user._count.comments} comments, ${user._count.uploadedAssets} assets, ${user._count.createdProjects} projects`)
    })

    if (oldUsers.length === 0) {
      console.log('   No old users found to clean up!')
      return
    }

    // First, reassign any stages from old users to current team
    console.log(`\n🔄 Reassigning stages from ${oldUsers.length} old users to current team...`)
    
    const currentTeamMap = {
      'DESIGN_CONCEPT': currentTeam.find(u => u.role === 'OWNER')?.id,
      'CLIENT_APPROVAL': currentTeam.find(u => u.role === 'OWNER')?.id,
      'DESIGN': currentTeam.find(u => u.role === 'OWNER')?.id,
      'THREE_D': currentTeam.find(u => u.role === 'RENDERER')?.id,
      'DRAWINGS': currentTeam.find(u => u.role === 'DRAFTER')?.id,
      'FFE': currentTeam.find(u => u.role === 'FFE')?.id
    }

    let totalReassigned = 0
    for (const [stageType, newAssigneeId] of Object.entries(currentTeamMap)) {
      if (newAssigneeId) {
        const result = await prisma.stage.updateMany({
          where: {
            type: stageType,
            assignedTo: {
              in: oldUsers.map(u => u.id)
            }
          },
          data: {
            assignedTo: newAssigneeId
          }
        })
        if (result.count > 0) {
          const assignee = currentTeam.find(u => u.id === newAssigneeId)
          console.log(`   ✅ Reassigned ${result.count} ${stageType} stages to ${assignee?.name}`)
          totalReassigned += result.count
        }
      }
    }
    console.log(`   📊 Total stages reassigned: ${totalReassigned}`)

    // Remove old users from organization (preserve their data)
    console.log(`\n🗑️ Removing ${oldUsers.length} old users from organization...`)
    const removeResult = await prisma.user.updateMany({
      where: {
        id: {
          in: oldUsers.map(u => u.id)
        }
      },
      data: {
        orgId: null
      }
    })
    console.log(`   ✅ Removed ${removeResult.count} users from organization`)

    // Verify final state
    console.log('\n🔍 Final verification...')
    const finalTeam = await prisma.user.findMany({
      where: {
        orgId: { not: null }
      },
      select: {
        name: true,
        email: true,
        role: true,
        _count: {
          select: {
            assignedStages: true
          }
        }
      }
    })

    console.log(`\n✅ Final team in organization (${finalTeam.length} users):`)
    finalTeam.forEach(user => {
      console.log(`   • ${user.name} (${user.role}) - ${user.email} [${user._count.assignedStages} stages]`)
    })

    // Check if team dropdown should now be clean
    const usersWithStages = await prisma.user.findMany({
      where: {
        assignedStages: {
          some: {}
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        orgId: true
      }
    })

    console.log(`\n📋 Users who appear in assignment dropdowns (${usersWithStages.length} users):`)
    usersWithStages.forEach(user => {
      const status = teamEmails.includes(user.email) ? '✅ Current Team' : '❌ Old User'
      console.log(`   • ${user.name} - ${user.email} [${status}]`)
    })

    console.log('\n🎉 Cleanup completed!')
    console.log('The team assignment dropdown should now only show the 4 current team members.')

  } catch (error) {
    console.error('❌ Error cleaning up old users:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanupAllOldUsers()
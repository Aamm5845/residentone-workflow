import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function reassignStages() {
  try {
    console.log('🔄 Reassigning stages to new team members...')

    // Get our new team members
    const teamMembers = await prisma.user.findMany({
      where: {
        orgId: { not: null },
        email: {
          in: [
            'aaron@meisnerinteriors.com',
            'shata@meisnerinteriors.com', 
            'sami@meisnerinteriors.com',
            'euvi.3d@gmail.com'
          ]
        }
      },
      select: {
        id: true,
        name: true,
        role: true,
        email: true
      }
    })

    console.log('👥 New team members:')
    teamMembers.forEach(member => {
      console.log(`  • ${member.name} (${member.role}) - ${member.email}`)
    })

    // Create role mapping
    const roleToUserMap = new Map()
    teamMembers.forEach(member => {
      if (member.role === 'OWNER') {
        roleToUserMap.set('DESIGN_CONCEPT', member) // OWNER handles design concept
        roleToUserMap.set('CLIENT_APPROVAL', member) // OWNER also handles client approval
      } else if (member.role === 'FFE') {
        roleToUserMap.set('FFE', member)
        // FFE can also handle CLIENT_APPROVAL if OWNER is not available
        if (!roleToUserMap.has('CLIENT_APPROVAL')) {
          roleToUserMap.set('CLIENT_APPROVAL', member)
        }
      } else if (member.role === 'DRAFTER') {
        roleToUserMap.set('DRAWINGS', member)
      } else if (member.role === 'RENDERER') {
        roleToUserMap.set('THREE_D', member)
      } else if (member.role === 'DESIGNER') {
        roleToUserMap.set('DESIGN', member)
      }
    })

    console.log('\n📋 Assignment mapping:')
    roleToUserMap.forEach((user, stageType) => {
      console.log(`  ${stageType} → ${user.name} (${user.role})`)
    })

    let totalReassigned = 0

    // Reassign stages by type
    for (const [stageType, assignedUser] of roleToUserMap.entries()) {
      console.log(`\n🔄 Reassigning ${stageType} stages to ${assignedUser.name}...`)
      
      const result = await prisma.stage.updateMany({
        where: {
          type: stageType
        },
        data: {
          assignedTo: assignedUser.id
        }
      })

      console.log(`   ✅ Reassigned ${result.count} ${stageType} stages`)
      totalReassigned += result.count
    }

    // Handle DESIGN stages (assign to OWNER as fallback since no DESIGNER role in our team)
    const ownerUser = teamMembers.find(m => m.role === 'OWNER')
    if (ownerUser) {
      console.log(`\n🔄 Reassigning DESIGN stages to ${ownerUser.name} (OWNER as fallback)...`)
      const designResult = await prisma.stage.updateMany({
        where: {
          type: 'DESIGN'
        },
        data: {
          assignedTo: ownerUser.id
        }
      })
      console.log(`   ✅ Reassigned ${designResult.count} DESIGN stages`)
      totalReassigned += designResult.count
    }

    console.log(`\n🎉 Reassignment complete! Total stages reassigned: ${totalReassigned}`)

    // Verify the reassignment
    console.log('\n🔍 Verifying reassignments...')
    const newAssignments = await prisma.stage.groupBy({
      by: ['type', 'assignedTo'],
      _count: {
        id: true
      },
      where: {
        assignedTo: {
          in: teamMembers.map(m => m.id)
        }
      }
    })

    for (const assignment of newAssignments) {
      const user = teamMembers.find(m => m.id === assignment.assignedTo)
      console.log(`  ${assignment.type}: ${assignment._count.id} stages → ${user?.name}`)
    }

  } catch (error) {
    console.error('❌ Error reassigning stages:', error)
  } finally {
    await prisma.$disconnect()
  }
}

reassignStages()
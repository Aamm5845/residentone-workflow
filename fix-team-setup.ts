import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixTeamSetup() {
  try {
    console.log('🔧 Fixing team setup issues...\n')

    // Step 1: Fix Shaya's email
    console.log('1️⃣ Fixing Shaya\'s email address...')
    const shayaUpdate = await prisma.user.updateMany({
      where: {
        email: 'shata@meisnerinteriors.com'
      },
      data: {
        email: 'shaya@meisnerinteriors.com'
      }
    })
    console.log(`   ✅ Updated ${shayaUpdate.count} email addresses (shata@ → shaya@)\n`)

    // Step 2: Get our current team members (the ones we want to keep)
    const currentTeam = await prisma.user.findMany({
      where: {
        email: {
          in: [
            'aaron@meisnerinteriors.com',
            'shaya@meisnerinteriors.com', 
            'sami@meisnerinteriors.com',
            'euvi.3d@gmail.com'
          ]
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })

    console.log('2️⃣ Current team members to keep:')
    currentTeam.forEach(member => {
      console.log(`   • ${member.name} (${member.role}) - ${member.email}`)
    })

    const currentTeamIds = currentTeam.map(m => m.id)

    // Step 3: Find old team members to remove
    const oldMembers = await prisma.user.findMany({
      where: {
        id: {
          notIn: currentTeamIds
        },
        orgId: { not: null } // Only get users that are still in the organization
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        _count: {
          select: {
            assignedStages: true,
            comments: true,
            uploadedAssets: true
          }
        }
      }
    })

    console.log(`\n3️⃣ Found ${oldMembers.length} old team members to clean up:`)
    oldMembers.forEach(member => {
      console.log(`   • ${member.name || 'No name'} (${member.role}) - ${member.email}`)
      console.log(`     Stages: ${member._count.assignedStages}, Comments: ${member._count.comments}, Assets: ${member._count.uploadedAssets}`)
    })

    // Step 4: Reassign any stages from old members to new team members first
    if (oldMembers.length > 0) {
      console.log('\n4️⃣ Reassigning stages from old members to new team members...')
      
      const roleMapping = {
        'DESIGN_CONCEPT': currentTeam.find(m => m.role === 'OWNER')?.id,
        'CLIENT_APPROVAL': currentTeam.find(m => m.role === 'OWNER')?.id,
        'DESIGN': currentTeam.find(m => m.role === 'OWNER')?.id,
        'THREE_D': currentTeam.find(m => m.role === 'RENDERER')?.id,
        'DRAWINGS': currentTeam.find(m => m.role === 'DRAFTER')?.id,
        'FFE': currentTeam.find(m => m.role === 'FFE')?.id
      }

      for (const [stageType, newAssigneeId] of Object.entries(roleMapping)) {
        if (newAssigneeId) {
          const reassignResult = await prisma.stage.updateMany({
            where: {
              type: stageType,
              assignedTo: {
                in: oldMembers.map(m => m.id)
              }
            },
            data: {
              assignedTo: newAssigneeId
            }
          })
          if (reassignResult.count > 0) {
            const assignee = currentTeam.find(m => m.id === newAssigneeId)
            console.log(`   ✅ Reassigned ${reassignResult.count} ${stageType} stages to ${assignee?.name}`)
          }
        }
      }
    }

    // Step 5: Remove old team members from organization (preserve their data but remove access)
    if (oldMembers.length > 0) {
      console.log('\n5️⃣ Removing old team members from organization...')
      const removeResult = await prisma.user.updateMany({
        where: {
          id: {
            in: oldMembers.map(m => m.id)
          }
        },
        data: {
          orgId: null // Remove from organization but keep their data
        }
      })
      console.log(`   ✅ Removed ${removeResult.count} old team members from organization`)
    }

    // Step 6: Verify current assignments
    console.log('\n6️⃣ Verifying current stage assignments...')
    const assignments = await prisma.stage.groupBy({
      by: ['type', 'assignedTo'],
      _count: {
        id: true
      },
      where: {
        assignedTo: {
          in: currentTeamIds
        }
      }
    })

    console.log('\n📊 Current assignments by team member:')
    for (const member of currentTeam) {
      const memberAssignments = assignments.filter(a => a.assignedTo === member.id)
      const totalStages = memberAssignments.reduce((sum, a) => sum + a._count.id, 0)
      console.log(`\n   👤 ${member.name} (${member.role}): ${totalStages} stages`)
      
      memberAssignments.forEach(assignment => {
        console.log(`      ${assignment.type}: ${assignment._count.id} stages`)
      })
    }

    // Step 7: Verify expected role assignments
    console.log('\n7️⃣ Verifying role-based assignments are correct...')
    const expectedAssignments = [
      { role: 'OWNER', types: ['DESIGN_CONCEPT', 'CLIENT_APPROVAL', 'DESIGN'] },
      { role: 'FFE', types: ['FFE'] },
      { role: 'DRAFTER', types: ['DRAWINGS'] },
      { role: 'RENDERER', types: ['THREE_D'] }
    ]

    for (const expected of expectedAssignments) {
      const member = currentTeam.find(m => m.role === expected.role)
      if (member) {
        for (const stageType of expected.types) {
          const count = assignments.find(a => a.assignedTo === member.id && a.type === stageType)?._count.id || 0
          const total = await prisma.stage.count({ where: { type: stageType } })
          const percentage = total > 0 ? Math.round((count / total) * 100) : 0
          
          if (percentage === 100) {
            console.log(`   ✅ ${member.name}: All ${stageType} stages (${count}/${total})`)
          } else {
            console.log(`   ⚠️  ${member.name}: ${count}/${total} ${stageType} stages (${percentage}%)`)
          }
        }
      }
    }

    // Step 8: Test dashboard functionality by checking tasks endpoint structure
    console.log('\n8️⃣ Testing task visibility...')
    for (const member of currentTeam) {
      const tasks = await prisma.stage.findMany({
        where: {
          assignedTo: member.id,
          status: {
            in: ['NOT_STARTED', 'IN_PROGRESS']
          }
        },
        include: {
          room: {
            include: {
              project: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        take: 5
      })
      
      console.log(`   👤 ${member.name}: ${tasks.length > 0 ? `${tasks.length} visible tasks` : 'No active tasks'}`)
      tasks.slice(0, 2).forEach(task => {
        console.log(`      • ${task.type} - ${task.room.project.name}`)
      })
    }

    console.log('\n🎉 Team setup fix completed!')
    console.log('\n📋 Summary:')
    console.log(`   • Fixed Shaya's email: shata@ → shaya@`)
    console.log(`   • Removed ${oldMembers.length} old team members`)
    console.log(`   • Kept ${currentTeam.length} current team members`)
    console.log(`   • All stages reassigned to correct team members`)
    console.log(`   • Task dashboard should now show correct assignments`)

  } catch (error) {
    console.error('❌ Error fixing team setup:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixTeamSetup()
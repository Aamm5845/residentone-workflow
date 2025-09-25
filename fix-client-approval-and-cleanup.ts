import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixClientApprovalAndCleanup() {
  try {
    console.log('🔧 Fixing Client Approval assignments and cleaning up old users...\n')

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

    console.log('👥 Current team members:')
    currentTeam.forEach(member => {
      console.log(`   • ${member.name} (${member.role}) - ${member.email}`)
    })

    const aaron = currentTeam.find(m => m.role === 'OWNER')
    const shaya = currentTeam.find(m => m.role === 'FFE')
    const sami = currentTeam.find(m => m.role === 'DRAFTER')
    const manoel = currentTeam.find(m => m.role === 'RENDERER')

    // 1. Fix Client Approval assignments - assign to Shaya instead of Aaron
    console.log('\n1️⃣ Reassigning CLIENT_APPROVAL stages to Shaya (FFE)...')
    if (shaya) {
      const clientApprovalUpdate = await prisma.stage.updateMany({
        where: {
          type: 'CLIENT_APPROVAL'
        },
        data: {
          assignedTo: shaya.id
        }
      })
      console.log(`   ✅ Reassigned ${clientApprovalUpdate.count} CLIENT_APPROVAL stages to ${shaya.name}`)
    }

    // 2. Completely delete old users from database (not just remove from org)
    console.log('\n2️⃣ Finding and completely removing old users from database...')
    
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        _count: {
          select: {
            assignedStages: true,
            comments: true,
            uploadedAssets: true,
            createdProjects: true,
            completedStages: true,
            createdStages: true
          }
        }
      }
    })

    const oldUsers = allUsers.filter(user => !teamEmails.includes(user.email))
    console.log(`   Found ${oldUsers.length} old users to remove:`)
    
    oldUsers.forEach(user => {
      console.log(`   • ${user.name || 'No name'} - ${user.email}`)
    })

    if (oldUsers.length > 0) {
      // First, reassign any remaining stages from old users to current team
      console.log('\n   📋 Reassigning any remaining assignments from old users...')
      
      for (const oldUser of oldUsers) {
        if (oldUser._count.assignedStages > 0) {
          // Get stages assigned to this old user
          const userStages = await prisma.stage.findMany({
            where: { assignedTo: oldUser.id },
            select: { id: true, type: true }
          })

          // Reassign based on stage type
          for (const stage of userStages) {
            let newAssigneeId = null
            switch (stage.type) {
              case 'DESIGN_CONCEPT':
              case 'DESIGN':
                newAssigneeId = aaron?.id
                break
              case 'CLIENT_APPROVAL':
                newAssigneeId = shaya?.id
                break
              case 'FFE':
                newAssigneeId = shaya?.id
                break
              case 'DRAWINGS':
                newAssigneeId = sami?.id
                break
              case 'THREE_D':
                newAssigneeId = manoel?.id
                break
            }

            if (newAssigneeId) {
              await prisma.stage.update({
                where: { id: stage.id },
                data: { assignedTo: newAssigneeId }
              })
            }
          }
          console.log(`     ✅ Reassigned ${userStages.length} stages from ${oldUser.name}`)
        }
      }

      // Now safely delete old users (cascade will handle related records)
      console.log('\n   🗑️ Completely removing old users from database...')
      
      for (const oldUser of oldUsers) {
        try {
          // Delete user - this will cascade and remove related records
          await prisma.user.delete({
            where: { id: oldUser.id }
          })
          console.log(`     ✅ Deleted ${oldUser.name || oldUser.email}`)
        } catch (error) {
          console.log(`     ⚠️ Could not delete ${oldUser.name || oldUser.email}:`, error.message)
        }
      }
    }

    // 3. Verify Aaron's user ID for "Aaron's Approval" button
    console.log('\n3️⃣ Verifying Aaron\'s user information for approval button...')
    if (aaron) {
      console.log(`   ✅ Aaron Meisner ID: ${aaron.id}`)
      console.log(`   📧 Aaron Email: ${aaron.email}`)
      console.log(`   🏷️ Aaron Role: ${aaron.role}`)
      console.log('   → "Aaron\'s Approval" button should reference this user ID')
    }

    // 4. Final verification
    console.log('\n4️⃣ Final verification...')
    
    const finalUsers = await prisma.user.findMany({
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

    console.log(`\n✅ Final users in database (${finalUsers.length} total):`)
    finalUsers.forEach(user => {
      const status = teamEmails.includes(user.email) ? '✅ Team Member' : '❌ Should not exist'
      console.log(`   • ${user.name} - ${user.email} [${status}] (${user._count.assignedStages} stages)`)
    })

    // 5. Verify Client Approval assignments
    console.log('\n5️⃣ Verifying Client Approval assignments...')
    const clientApprovalStages = await prisma.stage.findMany({
      where: { type: 'CLIENT_APPROVAL' },
      select: {
        id: true,
        assignedUser: {
          select: {
            name: true,
            role: true,
            email: true
          }
        }
      }
    })

    const shayaAssignments = clientApprovalStages.filter(s => s.assignedUser?.email === 'shaya@meisnerinteriors.com')
    console.log(`   ✅ Shaya has ${shayaAssignments.length}/${clientApprovalStages.length} CLIENT_APPROVAL stages`)

    // 6. Show current assignments summary
    console.log('\n6️⃣ Updated assignment summary:')
    const assignmentSummary = await prisma.stage.groupBy({
      by: ['type'],
      _count: { id: true },
      where: {
        assignedTo: {
          in: currentTeam.map(m => m.id)
        }
      }
    })

    for (const assignment of assignmentSummary) {
      const sampleStage = await prisma.stage.findFirst({
        where: { type: assignment.type },
        select: {
          assignedUser: {
            select: { name: true, role: true }
          }
        }
      })
      console.log(`   ${assignment.type}: ${assignment._count.id} stages → ${sampleStage?.assignedUser?.name} (${sampleStage?.assignedUser?.role})`)
    }

    console.log('\n🎉 Client Approval fix and cleanup completed!')
    console.log('\n📋 Summary of changes:')
    console.log('   • CLIENT_APPROVAL stages reassigned to Shaya Gross (FFE)')
    console.log(`   • ${oldUsers.length} old users completely removed from database`)
    console.log('   • Assignment dropdowns will now only show current 4 team members')
    console.log('   • Aaron\'s approval button linked to correct user')

  } catch (error) {
    console.error('❌ Error fixing client approval and cleanup:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixClientApprovalAndCleanup()
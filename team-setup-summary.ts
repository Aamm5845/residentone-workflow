import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function generateTeamSetupSummary() {
  try {
    console.log('📊 TEAM SETUP SUMMARY REPORT')
    console.log('=' .repeat(50))
    
    // 1. Current Team Members
    console.log('\n🎯 ACTIVE TEAM MEMBERS:')
    const activeTeam = await prisma.user.findMany({
      where: { orgId: { not: null } },
      select: {
        name: true,
        email: true,
        role: true,
        mustChangePassword: true,
        _count: {
          select: {
            assignedStages: true
          }
        }
      },
      orderBy: { role: 'asc' }
    })

    activeTeam.forEach((member, index) => {
      console.log(`${index + 1}. ${member.name}`)
      console.log(`   📧 Email: ${member.email}`)
      console.log(`   🏷️  Role: ${member.role}`)
      console.log(`   📋 Assigned Stages: ${member._count.assignedStages}`)
      console.log(`   🔒 Password Status: ${member.mustChangePassword ? 'Must change on first login' : 'Set'}`)
      console.log()
    })

    // 2. Role-Based Phase Assignments
    console.log('🎯 PHASE ASSIGNMENTS BY ROLE:')
    const assignments = await prisma.stage.groupBy({
      by: ['type'],
      _count: { id: true },
      where: {
        assignedTo: {
          in: activeTeam.map(m => m.name === 'Aaron Meisner' ? m.email : 
                           m.name === 'Shaya Gross' ? m.email :
                           m.name === 'Sami Youssef' ? m.email :
                           m.name === 'Manoel Vitor' ? m.email : '')
        }
      }
    })

    // Get assignee details
    const stageAssignments = await prisma.stage.findMany({
      where: {
        assignedTo: { not: null }
      },
      select: {
        type: true,
        assignedUser: {
          select: {
            name: true,
            role: true
          }
        }
      }
    })

    // Group by role and phase
    const assignmentsByRole = new Map()
    stageAssignments.forEach(stage => {
      if (stage.assignedUser) {
        const role = stage.assignedUser.role
        if (!assignmentsByRole.has(role)) {
          assignmentsByRole.set(role, new Map())
        }
        const roleMap = assignmentsByRole.get(role)
        const count = roleMap.get(stage.type) || 0
        roleMap.set(stage.type, count + 1)
      }
    })

    assignmentsByRole.forEach((phases, role) => {
      const member = activeTeam.find(m => m.role === role)
      console.log(`\n👤 ${member?.name} (${role}):`)
      phases.forEach((count, phaseType) => {
        console.log(`   • ${phaseType}: ${count} stages`)
      })
    })

    // 3. Assignment Verification
    console.log('\n✅ ASSIGNMENT VERIFICATION:')
    const expectedAssignments = [
      { role: 'OWNER', name: 'Aaron Meisner', phases: ['DESIGN_CONCEPT', 'CLIENT_APPROVAL', 'DESIGN'] },
      { role: 'FFE', name: 'Shaya Gross', phases: ['FFE'] },
      { role: 'DRAFTER', name: 'Sami Youssef', phases: ['DRAWINGS'] },
      { role: 'RENDERER', name: 'Manoel Vitor', phases: ['THREE_D'] }
    ]

    for (const expected of expectedAssignments) {
      console.log(`\n${expected.name} (${expected.role}):`)
      for (const phaseType of expected.phases) {
        const totalPhases = await prisma.stage.count({ where: { type: phaseType } })
        const assignedPhases = await prisma.stage.count({
          where: {
            type: phaseType,
            assignedUser: {
              role: expected.role
            }
          }
        })
        
        const percentage = totalPhases > 0 ? Math.round((assignedPhases / totalPhases) * 100) : 0
        const status = percentage === 100 ? '✅' : percentage > 0 ? '⚠️' : '❌'
        console.log(`   ${status} ${phaseType}: ${assignedPhases}/${totalPhases} (${percentage}%)`)
      }
    }

    // 4. Dashboard Task Test
    console.log('\n📱 DASHBOARD TASK VISIBILITY TEST:')
    for (const member of activeTeam) {
      const taskCount = await prisma.stage.count({
        where: {
          assignedUser: {
            email: member.email
          },
          status: {
            in: ['NOT_STARTED', 'IN_PROGRESS']
          }
        }
      })
      
      console.log(`   👤 ${member.name}: ${taskCount} visible tasks in dashboard`)
    }

    // 5. System Status
    console.log('\n🔍 SYSTEM STATUS:')
    const totalUsers = await prisma.user.count()
    const activeUsers = activeTeam.length
    const totalStages = await prisma.stage.count()
    const assignedStages = await prisma.stage.count({ where: { assignedTo: { not: null } } })
    
    console.log(`   • Total users in system: ${totalUsers}`)
    console.log(`   • Active team members: ${activeUsers}`)
    console.log(`   • Total stages: ${totalStages}`)
    console.log(`   • Assigned stages: ${assignedStages}`)
    console.log(`   • Unassigned stages: ${totalStages - assignedStages}`)

    // 6. Login Information
    console.log('\n🔑 LOGIN INFORMATION:')
    console.log('   Temporary Password: Meisner6700')
    console.log('   All users must change password on first login')
    console.log()
    console.log('   Login URLs:')
    console.log('   • Aaron Meisner: aaron@meisnerinteriors.com')
    console.log('   • Shaya Gross: shaya@meisnerinteriors.com') 
    console.log('   • Sami Youssef: sami@meisnerinteriors.com')
    console.log('   • Manoel Vitor: euvi.3d@gmail.com')

    // 7. Application Access
    console.log('\n🌐 APPLICATION ACCESS:')
    console.log('   Development Server: http://localhost:3000')
    console.log('   Team Page: http://localhost:3000/team')
    console.log('   Dashboard: http://localhost:3000/dashboard')
    console.log('   Projects: http://localhost:3000/projects')

    console.log('\n' + '=' .repeat(50))
    console.log('🎉 SETUP COMPLETE!')
    console.log('The team is ready to start working on interior design projects.')

  } catch (error) {
    console.error('❌ Error generating summary:', error)
  } finally {
    await prisma.$disconnect()
  }
}

generateTeamSetupSummary()
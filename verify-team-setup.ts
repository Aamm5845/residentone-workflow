import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyTeamSetup() {
  try {
    console.log('🔍 Verifying team setup...')

    // Get all users in the organization
    const users = await prisma.user.findMany({
      where: {
        orgId: { not: null }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        mustChangePassword: true,
        createdAt: true,
        _count: {
          select: {
            assignedStages: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`\n👥 Found ${users.length} team members:\n`)

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name}`)
      console.log(`   📧 Email: ${user.email}`)
      console.log(`   🏷️  Role: ${user.role}`)
      console.log(`   🔒 Must change password: ${user.mustChangePassword ? 'Yes' : 'No'}`)
      console.log(`   📋 Assigned stages: ${user._count.assignedStages}`)
      console.log(`   📅 Created: ${user.createdAt.toLocaleString()}`)
      console.log()
    })

    // Check organization
    const organization = await prisma.organization.findFirst()
    if (organization) {
      console.log(`🏢 Organization: ${organization.name}`)
    }

    // Check if there are any existing projects with stages
    const stagesCount = await prisma.stage.count()
    console.log(`📊 Total stages in system: ${stagesCount}`)

    if (stagesCount > 0) {
      const stagesByType = await prisma.stage.groupBy({
        by: ['type'],
        _count: {
          id: true
        }
      })

      console.log('\n📋 Stages by type:')
      stagesByType.forEach(stage => {
        console.log(`   ${stage.type}: ${stage._count.id}`)
      })

      // Check assignments
      const assignedStages = await prisma.stage.findMany({
        where: {
          assignedTo: { not: null }
        },
        select: {
          type: true,
          assignedTo: true,
          assignedUser: {
            select: {
              name: true,
              role: true
            }
          }
        }
      })

      if (assignedStages.length > 0) {
        console.log('\n🎯 Current stage assignments:')
        assignedStages.forEach(stage => {
          console.log(`   ${stage.type} → ${stage.assignedUser?.name} (${stage.assignedUser?.role})`)
        })
      }
    }

    console.log('\n✅ Team verification complete!')

  } catch (error) {
    console.error('❌ Error verifying team setup:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyTeamSetup()
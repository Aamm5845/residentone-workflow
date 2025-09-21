const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔍 Checking Database State...\n')
    
    // Count records in each table
    const userCount = await prisma.user.count()
    const orgCount = await prisma.organization.count()
    const projectCount = await prisma.project.count()
    const roomCount = await prisma.room.count()
    const stageCount = await prisma.stage.count()
    
    console.log('📊 Record Counts:')
    console.log(`Users: ${userCount}`)
    console.log(`Organizations: ${orgCount}`)
    console.log(`Projects: ${projectCount}`)
    console.log(`Rooms: ${roomCount}`)
    console.log(`Stages: ${stageCount}\n`)
    
    // Get team member details
    console.log('👥 Team Members:')
    const users = await prisma.user.findMany({
      select: {
        name: true,
        email: true,
        role: true,
        orgId: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })
    
    users.forEach(user => {
      console.log(`- ${user.name || 'Unnamed'} (${user.email}) - Role: ${user.role} - OrgID: ${user.orgId}`)
    })
    
    console.log('\n🏢 Organizations:')
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            projects: true
          }
        }
      }
    })
    
    orgs.forEach(org => {
      console.log(`- ${org.name} (${org.slug}) - Users: ${org._count.users}, Projects: ${org._count.projects}`)
    })
    
    console.log('\n📁 Recent Projects:')
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        client: {
          select: {
            name: true
          }
        },
        createdAt: true,
        _count: {
          select: {
            rooms: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    })
    
    projects.forEach(project => {
      console.log(`- ${project.name} (${project.status}) - Client: ${project.client.name} - Rooms: ${project._count.rooms}`)
    })
    
  } catch (error) {
    console.error('❌ Database Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
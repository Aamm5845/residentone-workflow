const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function loginHelper() {
  try {
    console.log('🔍 Checking available login credentials...\n')
    
    const users = await prisma.user.findMany({
      select: { 
        email: true, 
        name: true, 
        role: true, 
        password: true,
        orgId: true 
      }
    })
    
    console.log('👥 Available Users:')
    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      console.log(`${i + 1}. Email: ${user.email}`)
      console.log(`   Name: ${user.name || 'No name'}`)
      console.log(`   Role: ${user.role}`)
      console.log(`   Has Password: ${user.password ? '✅' : '❌'}`)
      console.log(`   Org ID: ${user.orgId}`)
      console.log('')
    }
    
    // Check if admin@example.com has a password, if not, set one
    const adminUser = users.find(u => u.email === 'admin@example.com')
    if (adminUser && !adminUser.password) {
      console.log('🔧 Setting password for admin@example.com...')
      const hashedPassword = await bcrypt.hash('admin123', 12)
      
      await prisma.user.update({
        where: { email: 'admin@example.com' },
        data: { password: hashedPassword }
      })
      
      console.log('✅ Password set! You can now login with:')
      console.log('   Email: admin@example.com')
      console.log('   Password: admin123')
    }
    
    // Check projects for each user
    const orgs = await prisma.organization.findMany({
      include: {
        projects: {
          include: {
            client: true,
            rooms: {
              include: {
                stages: true
              }
            }
          }
        }
      }
    })
    
    console.log('📁 Projects by Organization:')
    for (const org of orgs) {
      console.log(`\n🏢 ${org.name}:`)
      if (org.projects.length === 0) {
        console.log('   No projects found')
      } else {
        for (const project of org.projects) {
          console.log(`   📋 ${project.name} (${project.status})`)
          console.log(`      Client: ${project.client.name}`)
          console.log(`      Rooms: ${project.rooms.length}`)
          
          // Check for DRAWINGS stages
          const drawingStages = project.rooms.flatMap(room => 
            room.stages.filter(stage => stage.type === 'DRAWINGS')
          )
          if (drawingStages.length > 0) {
            console.log(`      🎨 Drawing Stages: ${drawingStages.length}`)
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

loginHelper()
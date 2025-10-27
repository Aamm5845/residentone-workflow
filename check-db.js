const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkData() {
  try {
    const projectCount = await prisma.project.count()
    const roomCount = await prisma.room.count()
    const userCount = await prisma.user.count()
    const clientCount = await prisma.client.count()
    
    console.log('✅ DATABASE DATA CHECK:')
    console.log(`  Projects: ${projectCount}`)
    console.log(`  Rooms: ${roomCount}`)
    console.log(`  Users: ${userCount}`)
    console.log(`  Clients: ${clientCount}`)
    
    if (projectCount === 0 && roomCount === 0) {
      console.log('\n⚠️ WARNING: Database appears empty!')
    } else {
      console.log('\n✅ Your data is SAFE! All records are present.')
    }
  } catch (error) {
    console.error('Error checking database:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkData()

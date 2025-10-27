const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkSections() {
  try {
    const sections = await prisma.roomSection.findMany({
      include: {
        _count: {
          select: { rooms: true }
        }
      }
    })
    
    console.log('\n📋 SECTIONS IN DATABASE:')
    if (sections.length === 0) {
      console.log('   ❌ No sections found!')
    } else {
      sections.forEach(section => {
        console.log(`   ✅ ${section.name} (ID: ${section.id}) - ${section._count.rooms} rooms`)
      })
    }
    
    const rooms = await prisma.room.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        sectionId: true,
        order: true,
        section: {
          select: {
            name: true
          }
        }
      }
    })
    
    console.log('\n🏠 ROOMS:')
    rooms.forEach(room => {
      const roomName = room.name || room.type
      const sectionName = room.section?.name || 'Unassigned'
      console.log(`   ${roomName} → ${sectionName} (order: ${room.order})`)
    })
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSections()

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function debugStages() {
  console.log('🔍 Debugging stage data in database...')
  
  try {
    // Get all projects with rooms and stages
    const projects = await prisma.project.findMany({
      include: {
        rooms: {
          include: {
            stages: true
          }
        }
      },
      take: 5 // Limit to first 5 projects
    })
    
    console.log(`\n📊 Found ${projects.length} projects`)
    
    projects.forEach((project, i) => {
      console.log(`\n🏠 Project ${i + 1}: ${project.name}`)
      
      project.rooms.forEach((room, j) => {
        console.log(`  📍 Room ${j + 1}: ${room.name || room.type}`)
        console.log(`    Stages (${room.stages.length}):`)
        
        room.stages.forEach((stage, k) => {
          console.log(`      ${k + 1}. ${stage.type} - ${stage.status} (ID: ${stage.id})`)
        })
      })
    })
    
    // Check for DESIGN_CONCEPT vs DESIGN stages specifically
    const designStages = await prisma.stage.findMany({
      where: {
        OR: [
          { type: 'DESIGN' },
          { type: 'DESIGN_CONCEPT' }
        ]
      },
      include: {
        room: {
          select: {
            name: true,
            type: true,
            project: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })
    
    console.log(`\n🎨 Found ${designStages.length} design-related stages:`)
    designStages.forEach((stage, i) => {
      console.log(`  ${i + 1}. ${stage.type} - ${stage.status} (${stage.room.project.name} - ${stage.room.name || stage.room.type})`)
    })
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugStages()
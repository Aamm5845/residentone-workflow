const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function findMasterBedroom() {
  console.log('Searching for Master Bedroom / Avi Fried project...\n')
  
  // Search for client
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { name: { contains: 'Fried', mode: 'insensitive' } },
        { name: { contains: 'Avi', mode: 'insensitive' } }
      ]
    }
  })
  
  console.log(`Found ${clients.length} clients matching "Fried" or "Avi":\n`)
  clients.forEach(client => {
    console.log(`- ${client.name} (ID: ${client.id})`)
  })
  
  // Search for projects
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { name: { contains: 'Fried', mode: 'insensitive' } },
        { name: { contains: 'Ground', mode: 'insensitive' } }
      ]
    },
    include: {
      client: true
    }
  })
  
  console.log(`\nFound ${projects.length} projects:\n`)
  projects.forEach(project => {
    console.log(`Project: ${project.name}`)
    console.log(`  Client: ${project.client.name}`)
    console.log(`  ID: ${project.id}\n`)
  })
  
  // Search for Master Bedroom rooms in the Fried project
  const rooms = await prisma.room.findMany({
    where: {
      projectId: 'cmgecc1jg000308fmsrbb6far'
    },
    include: {
      project: {
        include: {
          client: true
        }
      },
      stages: {
        where: {
          type: 'DESIGN_CONCEPT'
        }
      }
    }
  })
  
  console.log(`\nFound ${rooms.length} Master Bedroom rooms:\n`)
  rooms.forEach(room => {
    console.log(`Room: ${room.name || room.type}`)
    console.log(`  Project: ${room.project.name}`)
    console.log(`  Client: ${room.project.client.name}`)
    console.log(`  Room ID: ${room.id}`)
    if (room.stages.length > 0) {
      room.stages.forEach(stage => {
        console.log(`  Design Concept Stage ID: ${stage.id}`)
        console.log(`  Status: ${stage.status}`)
      })
    }
    console.log('')
  })
  
  await prisma.$disconnect()
}

findMasterBedroom().catch(console.error)

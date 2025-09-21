const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function verifyCleanup() {
  const rooms = await prisma.room.findMany({
    include: {
      stages: true,
      project: { select: { name: true } }
    }
  })
  
  const duplicateCheck = {}
  let totalDuplicates = 0
  
  rooms.forEach(room => {
    const stageTypes = {}
    room.stages.forEach(stage => {
      if (!stageTypes[stage.type]) {
        stageTypes[stage.type] = 0
      }
      stageTypes[stage.type]++
    })
    
    // Check for duplicates
    Object.keys(stageTypes).forEach(type => {
      if (stageTypes[type] > 1) {
        if (!duplicateCheck[type]) duplicateCheck[type] = 0
        duplicateCheck[type]++
        totalDuplicates++
      }
    })
  })
  
  console.log('🔍 Verification Results:')
  console.log(`Total rooms: ${rooms.length}`)
  
  if (totalDuplicates === 0) {
    console.log('✅ No duplicate stages found!')
  } else {
    console.log('❌ Duplicate stage types still found:')
    console.log(duplicateCheck)
  }
  
  // Show sample room with DESIGN_CONCEPT stage
  const sampleRoom = rooms.find(r => r.stages.some(s => s.type === 'DESIGN_CONCEPT'))
  if (sampleRoom) {
    console.log('\n📋 Sample room stages after cleanup:')
    console.log(`${sampleRoom.project.name} - ${sampleRoom.name}:`)
    sampleRoom.stages.forEach(stage => {
      console.log(`  - ${stage.type}: ${stage.status}`)
    })
  }
  
  // Count total stage types
  const stageCounts = {}
  rooms.forEach(room => {
    room.stages.forEach(stage => {
      if (!stageCounts[stage.type]) stageCounts[stage.type] = 0
      stageCounts[stage.type]++
    })
  })
  
  console.log('\n📊 Stage type distribution:')
  Object.keys(stageCounts).sort().forEach(type => {
    console.log(`  ${type}: ${stageCounts[type]}`)
  })
  
  await prisma.$disconnect()
}

verifyCleanup()
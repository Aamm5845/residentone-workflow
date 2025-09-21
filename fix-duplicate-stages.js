const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fixDuplicateStages() {
  console.log('🔧 Starting stage cleanup process...')
  
  try {
    // Get all rooms with their stages
    const rooms = await prisma.room.findMany({
      include: {
        stages: {
          orderBy: { createdAt: 'asc' }
        },
        project: {
          select: { name: true }
        }
      }
    })
    
    console.log(`\n📊 Processing ${rooms.length} rooms...`)
    
    let totalStagesRemoved = 0
    let roomsProcessed = 0
    
    for (const room of rooms) {
      const stageTypes = {}
      const stagesToRemove = []
      
      // Group stages by type to find duplicates
      room.stages.forEach(stage => {
        const stageType = stage.type
        if (!stageTypes[stageType]) {
          stageTypes[stageType] = []
        }
        stageTypes[stageType].push(stage)
      })
      
      let roomModified = false
      
      // Handle DESIGN + DESIGN_CONCEPT duplicates
      if (stageTypes.DESIGN && stageTypes.DESIGN_CONCEPT) {
        console.log(`\n🏠 ${room.project.name} - ${room.name || room.type}: Found DESIGN + DESIGN_CONCEPT duplicates`)
        
        const designStages = stageTypes.DESIGN
        const conceptStages = stageTypes.DESIGN_CONCEPT
        
        // Keep the DESIGN_CONCEPT stage that has activity (sections, progress, etc.)
        // or the most recently updated one
        let stageToKeep = null
        let stagesToDelete = []
        
        // Check if any DESIGN_CONCEPT has more activity
        for (const conceptStage of conceptStages) {
          const sections = await prisma.designSection.findMany({
            where: { stageId: conceptStage.id }
          })
          
          if (conceptStage.status !== 'NOT_STARTED' || sections.length > 0) {
            stageToKeep = conceptStage
            break
          }
        }
        
        // If no active DESIGN_CONCEPT, check DESIGN stages and merge their data
        if (!stageToKeep) {
          let activeDesignStage = null
          
          for (const designStage of designStages) {
            const sections = await prisma.designSection.findMany({
              where: { stageId: designStage.id }
            })
            
            if (designStage.status !== 'NOT_STARTED' || sections.length > 0) {
              activeDesignStage = designStage
              break
            }
          }
          
          if (activeDesignStage) {
            // Use the first DESIGN_CONCEPT stage as the keeper and merge data
            stageToKeep = conceptStages[0]
            
            // Transfer data from active DESIGN to DESIGN_CONCEPT
            await prisma.stage.update({
              where: { id: stageToKeep.id },
              data: {
                status: activeDesignStage.status,
                startedAt: activeDesignStage.startedAt,
                completedAt: activeDesignStage.completedAt,
                assignedToId: activeDesignStage.assignedToId
              }
            })
            
            // Transfer design sections
            await prisma.designSection.updateMany({
              where: { stageId: activeDesignStage.id },
              data: { stageId: stageToKeep.id }
            })
            
            console.log(`  ✅ Merged active DESIGN data into DESIGN_CONCEPT stage`)
          }
        }
        
        // If still no keeper, just keep the first DESIGN_CONCEPT
        if (!stageToKeep) {
          stageToKeep = conceptStages[0]
        }
        
        // Mark all others for deletion
        designStages.forEach(stage => {
          if (stage.id !== stageToKeep.id) {
            stagesToDelete.push(stage)
          }
        })
        conceptStages.forEach(stage => {
          if (stage.id !== stageToKeep.id) {
            stagesToDelete.push(stage)
          }
        })
        
        // Delete the duplicate stages
        for (const stage of stagesToDelete) {
          // First delete related design sections
          await prisma.designSection.deleteMany({
            where: { stageId: stage.id }
          })
          
          // Then delete the stage
          await prisma.stage.delete({
            where: { id: stage.id }
          })
          
          console.log(`  🗑️  Removed duplicate ${stage.type} stage`)
          totalStagesRemoved++
          roomModified = true
        }
      }
      
      // Handle other duplicates similarly (THREE_D + RENDERING, etc.)
      // For now, let's focus on the DESIGN issue since that's what's blocking
      
      if (roomModified) {
        roomsProcessed++
      }
    }
    
    console.log(`\n✅ Cleanup complete!`)
    console.log(`   Rooms processed: ${roomsProcessed}`)
    console.log(`   Stages removed: ${totalStagesRemoved}`)
    
    // Verify the cleanup worked
    console.log(`\n🔍 Verifying cleanup...`)
    const remainingDesignStages = await prisma.stage.count({
      where: {
        OR: [
          { type: 'DESIGN' },
          { type: 'DESIGN_CONCEPT' }
        ]
      }
    })
    
    console.log(`   Remaining design stages: ${remainingDesignStages}`)
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixDuplicateStages()
import { PrismaClient, StageType, StageStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function addMissingStages() {
  console.log('🔍 Checking for existing rooms...')
  
  // Get all rooms
  const rooms = await prisma.room.findMany({
    include: {
      stages: true,
      project: {
        include: {
          organization: {
            include: {
              users: true
            }
          }
        }
      }
    }
  })

  console.log(`📊 Found ${rooms.length} rooms`)

  if (rooms.length === 0) {
    console.log('✅ No rooms found, nothing to migrate')
    return
  }

  let addedStages = 0

  for (const room of rooms) {
    const existingStageTypes = room.stages.map(stage => stage.type)
    const missingStageTypes: StageType[] = []

    // Check which stages are missing
    if (!existingStageTypes.includes('DESIGN_CONCEPT')) {
      missingStageTypes.push('DESIGN_CONCEPT')
    }
    if (!existingStageTypes.includes('FFE')) {
      missingStageTypes.push('FFE')
    }

    if (missingStageTypes.length === 0) {
      console.log(`✅ Room ${room.id} (${room.type}) already has all stages`)
      continue
    }

    console.log(`🔧 Adding missing stages to room ${room.id} (${room.type}): ${missingStageTypes.join(', ')}`)

    // Get team members for stage assignments
    const teamMembers = room.project.organization.users
    const designer = teamMembers.find(u => u.role === 'DESIGNER')
    const ffe = teamMembers.find(u => u.role === 'FFE')

    // Create missing stages
    const stagesToCreate = missingStageTypes.map(stageType => ({
      roomId: room.id,
      type: stageType,
      status: 'NOT_STARTED' as StageStatus,
      assignedTo: stageType === 'DESIGN_CONCEPT' ? designer?.id || null : ffe?.id || null
    }))

    await prisma.stage.createMany({
      data: stagesToCreate
    })

    addedStages += stagesToCreate.length
    console.log(`✅ Added ${stagesToCreate.length} stages to room ${room.id}`)
  }

  console.log(`🎉 Migration complete! Added ${addedStages} stages across ${rooms.length} rooms`)
}

async function main() {
  try {
    await addMissingStages()
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

export { addMissingStages }
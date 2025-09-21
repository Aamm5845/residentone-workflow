const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testDrawingsAPI() {
  try {
    console.log('🧪 Testing Drawings Workspace Setup...\n')
    
    // Find a DRAWINGS stage
    const drawingStage = await prisma.stage.findFirst({
      where: { type: 'DRAWINGS' },
      include: {
        room: {
          include: {
            project: {
              include: {
                client: true,
                organization: true
              }
            }
          }
        },
        assignedUser: true
      }
    })
    
    if (!drawingStage) {
      console.log('❌ No DRAWINGS stage found in database')
      return
    }
    
    console.log(`✅ Found DRAWINGS stage:`)
    console.log(`   Stage ID: ${drawingStage.id}`)
    console.log(`   Room: ${drawingStage.room.name || drawingStage.room.type}`)
    console.log(`   Project: ${drawingStage.room.project.name}`)
    console.log(`   Client: ${drawingStage.room.project.client.name}`)
    console.log(`   Organization: ${drawingStage.room.project.organization.name}`)
    console.log(`   Status: ${drawingStage.status}`)
    console.log('')
    
    // Check if checklist items exist
    const checklistItems = await prisma.drawingChecklistItem.findMany({
      where: { stageId: drawingStage.id },
      include: {
        assets: true
      }
    })
    
    console.log(`📋 Checklist Items: ${checklistItems.length}`)
    if (checklistItems.length === 0) {
      console.log('   ℹ️  Checklist items will be auto-created when first accessed via API')
    } else {
      checklistItems.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.name} (${item.type}) - ${item.completed ? '✅' : '⏳'} - ${item.assets.length} files`)
      })
    }
    console.log('')
    
    // Check activity logs
    const activityCount = await prisma.activityLog.count({
      where: {
        entity: 'STAGE',
        entityId: drawingStage.id
      }
    })
    
    console.log(`📊 Activity Logs: ${activityCount}`)
    console.log('')
    
    // Test if new schema is applied
    console.log('🔍 Schema Validation:')
    try {
      await prisma.drawingChecklistItem.findFirst()
      console.log('   ✅ DrawingChecklistItem table exists')
    } catch (error) {
      console.log('   ❌ DrawingChecklistItem table missing')
    }
    
    console.log('')
    console.log('🚀 Ready to test! You can now:')
    console.log(`   1. Go to http://localhost:3000`)
    console.log(`   2. Login with:`)
    console.log(`      - admin@example.com / admin123`)
    console.log(`      - OR aamm2201@gmail.com (if you know the password)`)
    console.log(`   3. Navigate to a project`)
    console.log(`   4. Look for a room with DRAWINGS stage`)
    console.log(`   5. Click on the DRAWINGS stage to test the new workspace`)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testDrawingsAPI()
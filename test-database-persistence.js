const { PrismaClient } = require('@prisma/client')

async function runCRUDTests() {
  const prisma = new PrismaClient()
  let testResults = []
  
  try {
    console.log('🧪 Starting Comprehensive CRUD Persistence Tests...\n')
    
    // Get existing org for testing
    const existingOrg = await prisma.organization.findFirst()
    if (!existingOrg) {
      throw new Error('No organization found for testing')
    }
    
    // Get existing user for testing
    const existingUser = await prisma.user.findFirst({
      where: { orgId: existingOrg.id }
    })
    if (!existingUser) {
      throw new Error('No user found for testing')
    }
    
    console.log(`Using Organization: ${existingOrg.name} (${existingOrg.id})`)
    console.log(`Using User: ${existingUser.name} (${existingUser.id})\n`)
    
    // Test 1: Client CRUD Operations
    console.log('1️⃣ Testing Client CRUD Operations...')
    let testClient = null
    
    try {
      // CREATE
      testClient = await prisma.client.create({
        data: {
          name: 'Test Client CRUD',
          email: 'test-crud@example.com',
          phone: '+1-555-TEST',
          orgId: existingOrg.id
        }
      })
      console.log('   ✅ CREATE: Client created successfully')
      
      // READ
      const readClient = await prisma.client.findUnique({
        where: { id: testClient.id }
      })
      if (readClient && readClient.name === 'Test Client CRUD') {
        console.log('   ✅ READ: Client retrieved successfully')
      } else {
        throw new Error('Client not found or data mismatch')
      }
      
      // UPDATE
      const updatedClient = await prisma.client.update({
        where: { id: testClient.id },
        data: { name: 'Updated Test Client CRUD', phone: '+1-555-UPDATED' }
      })
      if (updatedClient.name === 'Updated Test Client CRUD') {
        console.log('   ✅ UPDATE: Client updated successfully')
      } else {
        throw new Error('Client update failed')
      }
      
      // DELETE
      await prisma.client.delete({
        where: { id: testClient.id }
      })
      const deletedClient = await prisma.client.findUnique({
        where: { id: testClient.id }
      })
      if (!deletedClient) {
        console.log('   ✅ DELETE: Client deleted successfully')
      } else {
        throw new Error('Client deletion failed')
      }
      
      testResults.push({ test: 'Client CRUD', status: 'PASSED' })
      
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`)
      testResults.push({ test: 'Client CRUD', status: 'FAILED', error: error.message })
      
      // Cleanup on failure
      if (testClient) {
        try {
          await prisma.client.delete({ where: { id: testClient.id } })
        } catch {}
      }
    }
    
    // Test 2: Project CRUD Operations
    console.log('\n2️⃣ Testing Project CRUD Operations...')
    let testProject = null
    let testClientForProject = null
    
    try {
      // Create a client for the project
      testClientForProject = await prisma.client.create({
        data: {
          name: 'Test Project Client',
          email: 'project-test@example.com',
          orgId: existingOrg.id
        }
      })
      
      // CREATE
      testProject = await prisma.project.create({
        data: {
          name: 'Test Project CRUD',
          description: 'Test project for CRUD operations',
          type: 'RESIDENTIAL',
          status: 'DRAFT',
          clientId: testClientForProject.id,
          orgId: existingOrg.id,
          createdById: existingUser.id,
          budget: 50000.00
        }
      })
      console.log('   ✅ CREATE: Project created successfully')
      
      // READ
      const readProject = await prisma.project.findUnique({
        where: { id: testProject.id },
        include: { client: true }
      })
      if (readProject && readProject.name === 'Test Project CRUD') {
        console.log('   ✅ READ: Project retrieved successfully with relations')
      } else {
        throw new Error('Project not found or data mismatch')
      }
      
      // UPDATE
      const updatedProject = await prisma.project.update({
        where: { id: testProject.id },
        data: { 
          name: 'Updated Test Project CRUD',
          status: 'IN_PROGRESS',
          budget: 75000.00
        }
      })
      if (updatedProject.name === 'Updated Test Project CRUD' && updatedProject.status === 'IN_PROGRESS') {
        console.log('   ✅ UPDATE: Project updated successfully')
      } else {
        throw new Error('Project update failed')
      }
      
      testResults.push({ test: 'Project CRUD', status: 'PASSED' })
      
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`)
      testResults.push({ test: 'Project CRUD', status: 'FAILED', error: error.message })
    }
    
    // Test 3: Room and Stage CRUD Operations
    console.log('\n3️⃣ Testing Room & Stage CRUD Operations...')
    let testRoom = null
    
    try {
      if (testProject) {
        // CREATE Room
        testRoom = await prisma.room.create({
          data: {
            projectId: testProject.id,
            type: 'LIVING_ROOM',
            name: 'Test Living Room',
            status: 'NOT_STARTED',
            createdById: existingUser.id
          }
        })
        console.log('   ✅ CREATE: Room created successfully')
        
        // CREATE Stage
        const testStage = await prisma.stage.create({
          data: {
            roomId: testRoom.id,
            type: 'DESIGN',
            status: 'NOT_STARTED',
            assignedTo: existingUser.id,
            createdById: existingUser.id
          }
        })
        console.log('   ✅ CREATE: Stage created successfully')
        
        // READ with relations
        const readRoom = await prisma.room.findUnique({
          where: { id: testRoom.id },
          include: {
            stages: true,
            project: true
          }
        })
        
        if (readRoom && readRoom.stages.length > 0) {
          console.log('   ✅ READ: Room retrieved with related stages')
        } else {
          throw new Error('Room or stage relationship failed')
        }
        
        // UPDATE Stage
        await prisma.stage.update({
          where: { id: testStage.id },
          data: { status: 'IN_PROGRESS', startedAt: new Date() }
        })
        console.log('   ✅ UPDATE: Stage status updated successfully')
        
        testResults.push({ test: 'Room & Stage CRUD', status: 'PASSED' })
      }
      
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`)
      testResults.push({ test: 'Room & Stage CRUD', status: 'FAILED', error: error.message })
    }
    
    // Test 4: Design Section CRUD Operations
    console.log('\n4️⃣ Testing Design Section CRUD Operations...')
    
    try {
      if (testRoom) {
        // Find the design stage
        const designStage = await prisma.stage.findFirst({
          where: { roomId: testRoom.id, type: 'DESIGN' }
        })
        
        if (designStage) {
          // CREATE Design Sections
          const wallsSection = await prisma.designSection.create({
            data: {
              stageId: designStage.id,
              type: 'WALLS',
              content: 'Test walls content for CRUD operations',
              createdById: existingUser.id
            }
          })
          
          const furnitureSection = await prisma.designSection.create({
            data: {
              stageId: designStage.id,
              type: 'FURNITURE', 
              content: 'Test furniture content for CRUD operations',
              createdById: existingUser.id
            }
          })
          console.log('   ✅ CREATE: Design sections created successfully')
          
          // UPDATE Section
          await prisma.designSection.update({
            where: { id: wallsSection.id },
            data: { 
              content: 'Updated walls content',
              completed: true,
              completedById: existingUser.id
            }
          })
          console.log('   ✅ UPDATE: Design section updated successfully')
          
          // READ Sections
          const sections = await prisma.designSection.findMany({
            where: { stageId: designStage.id }
          })
          
          if (sections.length >= 2) {
            console.log('   ✅ READ: Design sections retrieved successfully')
          }
          
          testResults.push({ test: 'Design Section CRUD', status: 'PASSED' })
        }
      }
      
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`)
      testResults.push({ test: 'Design Section CRUD', status: 'FAILED', error: error.message })
    }
    
    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...')
    try {
      if (testProject) {
        // This will cascade delete rooms, stages, sections due to foreign key constraints
        await prisma.project.delete({ where: { id: testProject.id } })
        console.log('   ✅ Test project and related data cleaned up')
      }
      
      if (testClientForProject) {
        await prisma.client.delete({ where: { id: testClientForProject.id } })
        console.log('   ✅ Test client cleaned up')
      }
    } catch (error) {
      console.log(`   ⚠️ Cleanup warning: ${error.message}`)
    }
    
  } catch (error) {
    console.error('❌ Test Setup Error:', error.message)
    testResults.push({ test: 'Test Setup', status: 'FAILED', error: error.message })
  } finally {
    await prisma.$disconnect()
  }
  
  // Print Results Summary
  console.log('\n📊 Test Results Summary:')
  console.log('═══════════════════════════════════════')
  
  const passed = testResults.filter(r => r.status === 'PASSED').length
  const failed = testResults.filter(r => r.status === 'FAILED').length
  
  testResults.forEach(result => {
    const icon = result.status === 'PASSED' ? '✅' : '❌'
    console.log(`${icon} ${result.test}: ${result.status}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
  })
  
  console.log('═══════════════════════════════════════')
  console.log(`Total Tests: ${testResults.length}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log(`Success Rate: ${Math.round((passed / testResults.length) * 100)}%`)
  
  if (failed === 0) {
    console.log('\n🎉 All CRUD persistence tests PASSED! Database is working correctly.')
  } else {
    console.log('\n⚠️ Some tests FAILED. Review the errors above.')
  }
}

runCRUDTests().catch(console.error)
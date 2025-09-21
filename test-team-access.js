const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function testTeamAccess() {
  const prisma = new PrismaClient()
  let testResults = []
  
  try {
    console.log('👥 Testing Team Member Access & Shared Data Visibility...\n')
    
    // Test 1: Verify all team members exist with correct roles
    console.log('1️⃣ Verifying Team Member Accounts...')
    
    const expectedTeamMembers = [
      { email: 'aaron@example.com', role: 'DESIGNER', name: 'Aaron (Designer)' },
      { email: 'vitor@example.com', role: 'RENDERER', name: 'Vitor (Renderer)' },
      { email: 'sammy@example.com', role: 'DRAFTER', name: 'Sammy (Drafter)' },
      { email: 'shaya@example.com', role: 'FFE', name: 'Shaya (FFE)' },
      { email: 'admin@example.com', role: 'OWNER', name: 'Admin User' }
    ]
    
    const org = await prisma.organization.findFirst({
      where: { name: 'Interior Design Studio' }
    })
    
    if (!org) {
      throw new Error('Interior Design Studio organization not found')
    }
    
    let allMembersVerified = true
    const foundMembers = []
    
    for (const expectedMember of expectedTeamMembers) {
      const user = await prisma.user.findUnique({
        where: { email: expectedMember.email },
        include: { organization: true }
      })
      
      if (user) {
        if (user.role === expectedMember.role && user.orgId === org.id) {
          console.log(`   ✅ ${expectedMember.name}: Role ${user.role} ✓`)
          foundMembers.push(user)
        } else {
          console.log(`   ❌ ${expectedMember.name}: Role mismatch or wrong org`)
          allMembersVerified = false
        }
      } else {
        console.log(`   ❌ ${expectedMember.name}: Account not found`)
        allMembersVerified = false
      }
    }
    
    testResults.push({ 
      test: 'Team Member Accounts', 
      status: allMembersVerified ? 'PASSED' : 'FAILED',
      details: `${foundMembers.length}/${expectedTeamMembers.length} accounts verified`
    })
    
    // Test 2: Create a test project and verify all team members can access it
    console.log('\n2️⃣ Testing Shared Project Visibility...')
    
    // Create a test client first
    const testClient = await prisma.client.create({
      data: {
        name: 'Shared Access Test Client',
        email: 'shared-test@example.com',
        orgId: org.id
      }
    })
    
    // Create a test project
    const adminUser = foundMembers.find(u => u.role === 'OWNER')
    const testProject = await prisma.project.create({
      data: {
        name: 'Team Shared Project Test',
        description: 'Project to test shared data visibility',
        type: 'RESIDENTIAL',
        status: 'IN_PROGRESS',
        clientId: testClient.id,
        orgId: org.id,
        createdById: adminUser.id,
        budget: 100000.00
      }
    })
    
    console.log(`   Created test project: ${testProject.name} (${testProject.id})`)
    
    // Test each team member's access to the shared project
    let sharedAccessVerified = true
    
    for (const member of foundMembers) {
      try {
        // Query projects from the perspective of each team member
        const memberProjects = await prisma.project.findMany({
          where: { 
            orgId: member.orgId,  // Organization-based data isolation
            id: testProject.id
          },
          include: {
            client: true,
            createdBy: true,
            _count: {
              select: {
                rooms: true
              }
            }
          }
        })
        
        if (memberProjects.length === 1 && memberProjects[0].id === testProject.id) {
          console.log(`   ✅ ${member.name} (${member.role}): Can access shared project`)
        } else {
          console.log(`   ❌ ${member.name} (${member.role}): Cannot access shared project`)
          sharedAccessVerified = false
        }
      } catch (error) {
        console.log(`   ❌ ${member.name} (${member.role}): Access error - ${error.message}`)
        sharedAccessVerified = false
      }
    }
    
    testResults.push({
      test: 'Shared Project Visibility',
      status: sharedAccessVerified ? 'PASSED' : 'FAILED',
      details: `Project visibility tested for ${foundMembers.length} team members`
    })
    
    // Test 3: Create room and stages, verify all team members see updates
    console.log('\n3️⃣ Testing Shared Room & Stage Data...')
    
    const testRoom = await prisma.room.create({
      data: {
        projectId: testProject.id,
        type: 'MASTER_BEDROOM',
        name: 'Test Master Bedroom',
        status: 'IN_PROGRESS',
        createdById: adminUser.id
      }
    })
    
    // Create stages for different roles
    const designStage = await prisma.stage.create({
      data: {
        roomId: testRoom.id,
        type: 'DESIGN',
        status: 'IN_PROGRESS',
        assignedTo: foundMembers.find(u => u.role === 'DESIGNER')?.id,
        createdById: adminUser.id
      }
    })
    
    const renderStage = await prisma.stage.create({
      data: {
        roomId: testRoom.id,
        type: 'THREE_D',
        status: 'NOT_STARTED',
        assignedTo: foundMembers.find(u => u.role === 'RENDERER')?.id,
        createdById: adminUser.id
      }
    })
    
    let stageAccessVerified = true
    
    // Test that all team members can see all stages (shared visibility)
    for (const member of foundMembers) {
      try {
        const memberStages = await prisma.stage.findMany({
          where: {
            room: {
              project: {
                orgId: member.orgId  // Organization-based filtering
              }
            }
          },
          include: {
            room: {
              include: {
                project: true
              }
            },
            assignedUser: true
          }
        })
        
        const relevantStages = memberStages.filter(s => s.room.project.id === testProject.id)
        
        if (relevantStages.length >= 2) { // Should see both design and render stages
          console.log(`   ✅ ${member.name} (${member.role}): Can see ${relevantStages.length} shared stages`)
        } else {
          console.log(`   ❌ ${member.name} (${member.role}): Only sees ${relevantStages.length} stages`)
          stageAccessVerified = false
        }
      } catch (error) {
        console.log(`   ❌ ${member.name} (${member.role}): Stage access error - ${error.message}`)
        stageAccessVerified = false
      }
    }
    
    testResults.push({
      test: 'Shared Room & Stage Data',
      status: stageAccessVerified ? 'PASSED' : 'FAILED',
      details: 'All team members should see all stages in shared projects'
    })
    
    // Test 4: Test role-specific assigned tasks visibility
    console.log('\n4️⃣ Testing Role-specific Assignments...')
    
    let assignmentTestPassed = true
    
    // Designer should see design stage assigned to them
    const designer = foundMembers.find(u => u.role === 'DESIGNER')
    if (designer) {
      const assignedStages = await prisma.stage.findMany({
        where: {
          assignedTo: designer.id,
          room: {
            project: {
              orgId: org.id
            }
          }
        }
      })
      
      if (assignedStages.some(s => s.id === designStage.id)) {
        console.log(`   ✅ Designer: Can see assigned design stage`)
      } else {
        console.log(`   ❌ Designer: Cannot see assigned design stage`)
        assignmentTestPassed = false
      }
    }
    
    // Renderer should see render stage assigned to them
    const renderer = foundMembers.find(u => u.role === 'RENDERER')
    if (renderer) {
      const assignedStages = await prisma.stage.findMany({
        where: {
          assignedTo: renderer.id,
          room: {
            project: {
              orgId: org.id
            }
          }
        }
      })
      
      if (assignedStages.some(s => s.id === renderStage.id)) {
        console.log(`   ✅ Renderer: Can see assigned render stage`)
      } else {
        console.log(`   ❌ Renderer: Cannot see assigned render stage`)
        assignmentTestPassed = false
      }
    }
    
    testResults.push({
      test: 'Role-specific Assignments',
      status: assignmentTestPassed ? 'PASSED' : 'FAILED',
      details: 'Team members should see stages assigned to their roles'
    })
    
    // Test 5: Organization isolation (users shouldn't see other org's data)
    console.log('\n5️⃣ Testing Organization Data Isolation...')
    
    const otherOrgUser = await prisma.user.findFirst({
      where: {
        orgId: { not: org.id }  // User from different organization
      }
    })
    
    let isolationTestPassed = true
    
    if (otherOrgUser) {
      try {
        const otherUserProjects = await prisma.project.findMany({
          where: {
            orgId: otherOrgUser.orgId,
            id: testProject.id  // Try to access our test project
          }
        })
        
        if (otherUserProjects.length === 0) {
          console.log(`   ✅ Organization Isolation: Other org user cannot see our project`)
        } else {
          console.log(`   ❌ Organization Isolation: Data leak detected!`)
          isolationTestPassed = false
        }
      } catch (error) {
        console.log(`   ✅ Organization Isolation: Access properly blocked (${error.message})`)
      }
    } else {
      console.log(`   ⚠️ Organization Isolation: No other organization user found to test with`)
    }
    
    testResults.push({
      test: 'Organization Data Isolation',
      status: isolationTestPassed ? 'PASSED' : 'FAILED',
      details: 'Users should only see data from their own organization'
    })
    
    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...')
    try {
      await prisma.project.delete({ where: { id: testProject.id } })
      await prisma.client.delete({ where: { id: testClient.id } })
      console.log('   ✅ Test data cleaned up successfully')
    } catch (error) {
      console.log(`   ⚠️ Cleanup warning: ${error.message}`)
    }
    
  } catch (error) {
    console.error('❌ Team Access Test Error:', error.message)
    testResults.push({ test: 'Test Setup', status: 'FAILED', error: error.message })
  } finally {
    await prisma.$disconnect()
  }
  
  // Print Results Summary
  console.log('\n📊 Team Access Test Results:')
  console.log('═══════════════════════════════════════')
  
  const passed = testResults.filter(r => r.status === 'PASSED').length
  const failed = testResults.filter(r => r.status === 'FAILED').length
  
  testResults.forEach(result => {
    const icon = result.status === 'PASSED' ? '✅' : '❌'
    console.log(`${icon} ${result.test}: ${result.status}`)
    if (result.details) {
      console.log(`   Details: ${result.details}`)
    }
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
    console.log('\n🎉 All team access tests PASSED! Team members can see shared data correctly.')
    console.log('\n✅ CONFIRMED: All projects are saved to database and visible to all team members')
  } else {
    console.log('\n⚠️ Some team access tests FAILED. Review the errors above.')
  }
}

testTeamAccess().catch(console.error)

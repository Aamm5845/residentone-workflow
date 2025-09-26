/**
 * Test scenarios for the phase notification system
 * 
 * This file contains test cases to verify the notification system works correctly
 * for different phase completion scenarios.
 * 
 * Run with: npm test -- phase-notification-service.test.ts
 * Or manually test by calling the functions with mock data.
 */

import { phaseNotificationService } from '../phase-notification-service'
import { getNextPhasesToNotify, getPhaseSequenceInfo, generatePhaseTransitionSummary } from '../../utils/phase-utils'

// Mock session for testing
const mockSession = {
  user: {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    orgId: 'test-org-id'
  }
}

/**
 * Test phase sequence utilities
 */
export function testPhaseSequenceUtilities() {
  console.log('🧪 Testing Phase Sequence Utilities...\n')
  
  // Test 1: Regular phase sequence
  console.log('1. Testing regular phase sequence:')
  const phases = ['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE']
  
  phases.forEach(phase => {
    try {
      const info = getPhaseSequenceInfo(phase)
      console.log(`   ${phase}:`, {
        order: info.phaseOrder,
        next: info.nextPhase || 'none',
        previous: info.previousPhase || 'none',
        isFirst: info.isFirstPhase,
        isLast: info.isLastPhase
      })
    } catch (error) {
      console.error(`   Error with ${phase}:`, error.message)
    }
  })
  
  // Test 2: Client approval special case
  console.log('\n2. Testing client approval special case:')
  const clientApprovalNext = getNextPhasesToNotify('CLIENT_APPROVAL')
  console.log('   CLIENT_APPROVAL next phases:', clientApprovalNext)
  console.log('   Expected: ["DRAWINGS", "FFE"]')
  console.log('   Match:', JSON.stringify(clientApprovalNext) === JSON.stringify(['DRAWINGS', 'FFE']))
  
  // Test 3: Other phases next phase logic
  console.log('\n3. Testing other phases next phase logic:')
  const testCases = [
    { phase: 'DESIGN_CONCEPT', expected: ['THREE_D'] },
    { phase: 'THREE_D', expected: ['CLIENT_APPROVAL'] }, 
    { phase: 'DRAWINGS', expected: ['FFE'] },
    { phase: 'FFE', expected: [] }
  ]
  
  testCases.forEach(({ phase, expected }) => {
    const result = getNextPhasesToNotify(phase)
    console.log(`   ${phase}: ${JSON.stringify(result)} (expected: ${JSON.stringify(expected)})`)
    console.log(`   Match: ${JSON.stringify(result) === JSON.stringify(expected)}`)
  })
  
  console.log('\n✅ Phase sequence utilities test completed\n')
}

/**
 * Test transition summary generation
 */
export function testTransitionSummaryGeneration() {
  console.log('🧪 Testing Transition Summary Generation...\n')
  
  const testCases = [
    {
      completed: 'DESIGN_CONCEPT',
      next: ['THREE_D'],
      room: 'Master Bedroom',
      project: 'Smith Residence'
    },
    {
      completed: 'CLIENT_APPROVAL', 
      next: ['DRAWINGS', 'FFE'],
      room: 'Living Room',
      project: 'Johnson Condo'
    },
    {
      completed: 'FFE',
      next: [],
      room: 'Kitchen',
      project: 'Wilson House'
    }
  ]
  
  testCases.forEach(({ completed, next, room, project }, index) => {
    console.log(`${index + 1}. Testing ${completed} completion:`)
    const summary = generatePhaseTransitionSummary(completed, next, room, project)
    console.log(`   Summary: ${summary}`)
    console.log()
  })
  
  console.log('✅ Transition summary generation test completed\n')
}

/**
 * Mock data for testing notification service
 */
const mockStageData = {
  regularPhaseCompletion: {
    stageId: 'stage-123',
    completedByUserId: 'user-456',
    stageType: 'DESIGN_CONCEPT',
    roomId: 'room-789',
    projectId: 'project-abc'
  },
  clientApprovalCompletion: {
    stageId: 'stage-456', 
    completedByUserId: 'user-789',
    stageType: 'CLIENT_APPROVAL',
    roomId: 'room-123',
    projectId: 'project-def'
  },
  finalPhaseCompletion: {
    stageId: 'stage-789',
    completedByUserId: 'user-123', 
    stageType: 'FFE',
    roomId: 'room-456',
    projectId: 'project-ghi'
  }
}

/**
 * Test notification service with mock data
 * Note: This requires a database connection and will log instead of actually sending notifications
 */
export async function testNotificationServiceWithMocks() {
  console.log('🧪 Testing Notification Service (Mock Mode)...\n')
  
  console.log('Note: This test uses the actual notification service but with logging instead of real emails.')
  console.log('The service will attempt to query the database for stage information.\n')
  
  const testScenarios = [
    {
      name: 'Regular Phase Completion (Design Concept)',
      data: mockStageData.regularPhaseCompletion
    },
    {
      name: 'Client Approval Completion (Special Case)',
      data: mockStageData.clientApprovalCompletion 
    },
    {
      name: 'Final Phase Completion (FFE)',
      data: mockStageData.finalPhaseCompletion
    }
  ]
  
  for (const scenario of testScenarios) {
    console.log(`Testing: ${scenario.name}`)
    console.log(`Stage ID: ${scenario.data.stageId}`)
    
    try {
      // Note: This will fail if the stage doesn't exist in the database
      // It's mainly for testing the service structure and logic flow
      const result = await phaseNotificationService.handlePhaseCompletion(
        scenario.data.stageId,
        scenario.data.completedByUserId,
        mockSession as any
      )
      
      console.log(`✅ Result:`, {
        success: result.success,
        notifications: result.notificationsSent,
        emails: result.emailsSent,
        errors: result.errors
      })
      
    } catch (error) {
      console.log(`❌ Expected error (stage not found):`, error.message)
    }
    
    console.log()
  }
  
  console.log('✅ Notification service mock test completed\n')
}

/**
 * Manual test runner
 * Call this function to run all tests
 */
export async function runAllNotificationTests() {
  console.log('🚀 Running All Phase Notification Tests\n')
  console.log('=' .repeat(50))
  
  // Test 1: Phase sequence utilities (no database required)
  testPhaseSequenceUtilities()
  
  // Test 2: Transition summary generation (no database required)  
  testTransitionSummaryGeneration()
  
  // Test 3: Notification service with mocks (requires database)
  await testNotificationServiceWithMocks()
  
  console.log('🎉 All notification tests completed!')
  console.log('=' .repeat(50))
}

/**
 * Integration test instructions
 */
export function printIntegrationTestInstructions() {
  console.log(`
📋 INTEGRATION TEST INSTRUCTIONS

To fully test the notification system with real data:

1. **Setup Phase Assignments:**
   - Create a test project with a room
   - Assign different users to each phase (DESIGN_CONCEPT, THREE_D, etc.)
   - Make sure users have valid email addresses

2. **Test Regular Phase Completion:**
   - Complete DESIGN_CONCEPT phase via API: PATCH /api/stages/{stageId} with action: "complete"
   - Check console logs for notification processing
   - Verify THREE_D assignee receives notification
   - Check email logs (currently logged, not sent)

3. **Test Client Approval Special Case:**
   - Complete THREE_D phase first
   - Complete CLIENT_APPROVAL phase via API
   - Verify BOTH DRAWINGS and FFE assignees receive notifications
   - Check that the email templates include correct information

4. **Test Final Phase:**
   - Complete FFE phase (last phase)
   - Verify no "next phase" notifications are sent
   - Only completion notification should be sent

5. **Database Verification:**
   - Check 'notifications' table for in-app notifications
   - Verify notification types and recipients are correct
   - Confirm relatedId points to correct stage

6. **Email Integration:**
   - Replace the mock sendEmail function in email-service.ts
   - Configure your email provider (SendGrid, SES, etc.)
   - Test actual email delivery

📧 Email Template Testing:
   - Check HTML email rendering in email clients
   - Verify all template variables are populated
   - Test responsive design on mobile devices

🔔 Notification Testing:
   - Test in-app notification display
   - Verify notification badges and counts
   - Test marking notifications as read

🚨 Error Handling:
   - Test with unassigned phases
   - Test with invalid stage IDs
   - Test with missing user information
   - Verify graceful failure (main operation continues even if notifications fail)
  `)
}

// Example usage:
// runAllNotificationTests().catch(console.error)
// printIntegrationTestInstructions()
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { createTestApp } from '@/lib/test-utils/app'
import { createTestUser, createTestRoom, createTestFFEData } from '@/lib/test-utils/fixtures'

describe('FFE Notes Persistence Integration Tests', () => {
  let app: any
  let prisma: PrismaClient
  let testUser: any
  let testRoom: any
  let testItem: any
  let authToken: string

  beforeAll(async () => {
    app = await createTestApp()
    prisma = new PrismaClient()
    
    // Create test user with admin privileges
    testUser = await createTestUser({
      email: 'test-admin@example.com',
      role: 'admin'
    })
    
    // Create test room and FFE data
    testRoom = await createTestRoom({
      name: 'Test Room',
      organizationId: testUser.organizationId
    })
    
    const ffeData = await createTestFFEData({
      roomId: testRoom.id,
      sections: [
        {
          name: 'Test Section',
          items: [
            {
              name: 'Test Item',
              state: 'PENDING',
              visibility: 'VISIBLE',
              notes: 'Initial notes'
            }
          ]
        }
      ]
    })
    
    testItem = ffeData.sections[0].items[0]
    
    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'password123'
      })
    
    authToken = loginResponse.body.token
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.roomFFEItem.deleteMany({
      where: { roomId: testRoom.id }
    })
    await prisma.roomFFESection.deleteMany({
      where: { roomId: testRoom.id }
    })
    await prisma.room.delete({
      where: { id: testRoom.id }
    })
    await prisma.user.delete({
      where: { id: testUser.id }
    })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Reset item state before each test
    await prisma.roomFFEItem.update({
      where: { id: testItem.id },
      data: {
        state: 'PENDING',
        notes: 'Initial notes',
        visibility: 'VISIBLE'
      }
    })
  })

  describe('Notes persistence during state changes', () => {
    it('should preserve notes when changing item state from PENDING to UNDECIDED', async () => {
      const testNotes = 'These notes should persist during state change'
      
      // First, update notes
      const notesResponse = await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemId: testItem.id,
          notes: testNotes
        })
      
      expect(notesResponse.status).toBe(200)
      
      // Then change state
      const stateResponse = await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemId: testItem.id,
          state: 'UNDECIDED'
        })
      
      expect(stateResponse.status).toBe(200)
      
      // Verify notes are preserved
      const item = await prisma.roomFFEItem.findUnique({
        where: { id: testItem.id }
      })
      
      expect(item?.notes).toBe(testNotes)
      expect(item?.state).toBe('UNDECIDED')
    })

    it('should preserve notes when changing item state from UNDECIDED to COMPLETED', async () => {
      const testNotes = 'Important completion notes'
      
      // Set initial state to UNDECIDED and add notes
      await prisma.roomFFEItem.update({
        where: { id: testItem.id },
        data: {
          state: 'UNDECIDED',
          notes: testNotes
        }
      })
      
      // Change state to COMPLETED
      const response = await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemId: testItem.id,
          state: 'COMPLETED'
        })
      
      expect(response.status).toBe(200)
      
      // Verify notes are preserved
      const item = await prisma.roomFFEItem.findUnique({
        where: { id: testItem.id }
      })
      
      expect(item?.notes).toBe(testNotes)
      expect(item?.state).toBe('COMPLETED')
    })

    it('should preserve notes when reverting from COMPLETED back to PENDING', async () => {
      const testNotes = 'These notes should survive state reversion'
      
      // Set item to COMPLETED with notes
      await prisma.roomFFEItem.update({
        where: { id: testItem.id },
        data: {
          state: 'COMPLETED',
          notes: testNotes
        }
      })
      
      // Revert back to PENDING
      const response = await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemId: testItem.id,
          state: 'PENDING'
        })
      
      expect(response.status).toBe(200)
      
      // Verify notes are preserved
      const item = await prisma.roomFFEItem.findUnique({
        where: { id: testItem.id }
      })
      
      expect(item?.notes).toBe(testNotes)
      expect(item?.state).toBe('PENDING')
    })
  })

  describe('Notes persistence during visibility changes', () => {
    it('should preserve notes when hiding an item', async () => {
      const testNotes = 'Notes should survive hiding'
      
      // Add notes to visible item
      await prisma.roomFFEItem.update({
        where: { id: testItem.id },
        data: {
          notes: testNotes,
          visibility: 'VISIBLE'
        }
      })
      
      // Hide the item
      const response = await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items/${testItem.id}/visibility`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          visibility: 'HIDDEN'
        })
      
      expect(response.status).toBe(200)
      
      // Verify notes are preserved
      const item = await prisma.roomFFEItem.findUnique({
        where: { id: testItem.id }
      })
      
      expect(item?.notes).toBe(testNotes)
      expect(item?.visibility).toBe('HIDDEN')
    })

    it('should preserve notes when making hidden item visible again', async () => {
      const testNotes = 'Notes from when item was previously worked on'
      
      // Set item as hidden with notes
      await prisma.roomFFEItem.update({
        where: { id: testItem.id },
        data: {
          notes: testNotes,
          visibility: 'HIDDEN',
          state: 'COMPLETED'
        }
      })
      
      // Make item visible again
      const response = await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items/${testItem.id}/visibility`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          visibility: 'VISIBLE'
        })
      
      expect(response.status).toBe(200)
      
      // Verify notes and state are preserved
      const item = await prisma.roomFFEItem.findUnique({
        where: { id: testItem.id }
      })
      
      expect(item?.notes).toBe(testNotes)
      expect(item?.state).toBe('COMPLETED')
      expect(item?.visibility).toBe('VISIBLE')
    })
  })

  describe('Notes persistence during combined operations', () => {
    it('should preserve notes through multiple state and visibility changes', async () => {
      const testNotes = 'Persistent notes through multiple changes'
      
      // Add notes
      await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemId: testItem.id,
          notes: testNotes
        })
      
      // Change state to UNDECIDED
      await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemId: testItem.id,
          state: 'UNDECIDED'
        })
      
      // Hide item
      await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items/${testItem.id}/visibility`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          visibility: 'HIDDEN'
        })
      
      // Change state to COMPLETED while hidden
      await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemId: testItem.id,
          state: 'COMPLETED'
        })
      
      // Make visible again
      await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items/${testItem.id}/visibility`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          visibility: 'VISIBLE'
        })
      
      // Verify notes are still preserved
      const item = await prisma.roomFFEItem.findUnique({
        where: { id: testItem.id }
      })
      
      expect(item?.notes).toBe(testNotes)
      expect(item?.state).toBe('COMPLETED')
      expect(item?.visibility).toBe('VISIBLE')
    })

    it('should handle notes updates without affecting state or visibility', async () => {
      const initialState = 'UNDECIDED'
      const initialVisibility = 'VISIBLE'
      const updatedNotes = 'Updated notes without changing other fields'
      
      // Set initial state and visibility
      await prisma.roomFFEItem.update({
        where: { id: testItem.id },
        data: {
          state: initialState,
          visibility: initialVisibility,
          notes: 'Original notes'
        }
      })
      
      // Update only notes
      const response = await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemId: testItem.id,
          notes: updatedNotes
        })
      
      expect(response.status).toBe(200)
      
      // Verify notes updated but other fields unchanged
      const item = await prisma.roomFFEItem.findUnique({
        where: { id: testItem.id }
      })
      
      expect(item?.notes).toBe(updatedNotes)
      expect(item?.state).toBe(initialState)
      expect(item?.visibility).toBe(initialVisibility)
    })
  })

  describe('Error scenarios and edge cases', () => {
    it('should not lose notes when API call fails during state change', async () => {
      const testNotes = 'Notes that should survive API failure'
      
      // Add notes
      await prisma.roomFFEItem.update({
        where: { id: testItem.id },
        data: { notes: testNotes }
      })
      
      // Attempt to change state with invalid value (should fail)
      const response = await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemId: testItem.id,
          state: 'INVALID_STATE'
        })
      
      expect(response.status).toBe(400)
      
      // Verify notes are still intact
      const item = await prisma.roomFFEItem.findUnique({
        where: { id: testItem.id }
      })
      
      expect(item?.notes).toBe(testNotes)
    })

    it('should handle empty notes gracefully', async () => {
      // Set item with empty notes
      const response = await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemId: testItem.id,
          notes: ''
        })
      
      expect(response.status).toBe(200)
      
      // Change state
      await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemId: testItem.id,
          state: 'COMPLETED'
        })
      
      // Verify empty notes are preserved
      const item = await prisma.roomFFEItem.findUnique({
        where: { id: testItem.id }
      })
      
      expect(item?.notes).toBe('')
      expect(item?.state).toBe('COMPLETED')
    })

    it('should handle null notes gracefully', async () => {
      // Set notes to null
      await prisma.roomFFEItem.update({
        where: { id: testItem.id },
        data: { notes: null }
      })
      
      // Change state
      const response = await request(app)
        .patch(`/api/ffe/v2/rooms/${testRoom.id}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itemId: testItem.id,
          state: 'COMPLETED'
        })
      
      expect(response.status).toBe(200)
      
      // Verify null notes are preserved
      const item = await prisma.roomFFEItem.findUnique({
        where: { id: testItem.id }
      })
      
      expect(item?.notes).toBeNull()
      expect(item?.state).toBe('COMPLETED')
    })
  })

  describe('Concurrent operations', () => {
    it('should handle simultaneous notes and state updates correctly', async () => {
      const notesUpdate = 'Notes from concurrent update'
      const stateUpdate = 'COMPLETED'
      
      // Simulate concurrent updates
      const [notesResponse, stateResponse] = await Promise.all([
        request(app)
          .patch(`/api/ffe/v2/rooms/${testRoom.id}/items`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            itemId: testItem.id,
            notes: notesUpdate
          }),
        request(app)
          .patch(`/api/ffe/v2/rooms/${testRoom.id}/items`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            itemId: testItem.id,
            state: stateUpdate
          })
      ])
      
      expect(notesResponse.status).toBe(200)
      expect(stateResponse.status).toBe(200)
      
      // Verify final state - both updates should have succeeded
      const item = await prisma.roomFFEItem.findUnique({
        where: { id: testItem.id }
      })
      
      // Due to concurrent updates, we should have the final state
      // but notes might be from either update depending on timing
      expect(item?.state).toBe(stateUpdate)
      expect(item?.notes).toBeDefined()
    })
  })
})

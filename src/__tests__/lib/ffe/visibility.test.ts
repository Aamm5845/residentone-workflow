import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { prismaMock } from '@/lib/test-utils/prisma-mock'
import {
  updateItemVisibility,
  getVisibleItems,
  getAllItems,
  bulkUpdateVisibility
} from '@/lib/ffe/visibility'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

// Mock audit logging
jest.mock('@/lib/audit', () => ({
  logFFEChange: jest.fn(),
}))

describe('FFE Visibility Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('updateItemVisibility', () => {
    const mockItem = {
      id: 'item-1',
      name: 'Test Item',
      visibility: 'VISIBLE' as const,
      state: 'PENDING' as const,
      notes: 'Test notes',
      roomId: 'room-1',
      sectionId: 'section-1',
      isRequired: false,
      isCustom: false,
      quantity: 1,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    it('should update item visibility from VISIBLE to HIDDEN', async () => {
      // Arrange
      prismaMock.roomFFEItem.findUnique.mockResolvedValue(mockItem)
      prismaMock.roomFFEItem.update.mockResolvedValue({
        ...mockItem,
        visibility: 'HIDDEN'
      })

      // Act
      const result = await updateItemVisibility('item-1', 'HIDDEN', 'user-1')

      // Assert
      expect(prismaMock.roomFFEItem.findUnique).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        include: { room: true, section: true }
      })
      expect(prismaMock.roomFFEItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { visibility: 'HIDDEN' }
      })
      expect(result.visibility).toBe('HIDDEN')
    })

    it('should update item visibility from HIDDEN to VISIBLE', async () => {
      // Arrange
      const hiddenItem = { ...mockItem, visibility: 'HIDDEN' as const }
      prismaMock.roomFFEItem.findUnique.mockResolvedValue(hiddenItem)
      prismaMock.roomFFEItem.update.mockResolvedValue({
        ...hiddenItem,
        visibility: 'VISIBLE'
      })

      // Act
      const result = await updateItemVisibility('item-1', 'VISIBLE', 'user-1')

      // Assert
      expect(result.visibility).toBe('VISIBLE')
    })

    it('should preserve notes when updating visibility', async () => {
      // Arrange
      const itemWithNotes = { 
        ...mockItem, 
        notes: 'Important notes that should persist',
        visibility: 'VISIBLE' as const
      }
      prismaMock.roomFFEItem.findUnique.mockResolvedValue(itemWithNotes)
      prismaMock.roomFFEItem.update.mockResolvedValue({
        ...itemWithNotes,
        visibility: 'HIDDEN'
      })

      // Act
      const result = await updateItemVisibility('item-1', 'HIDDEN', 'user-1')

      // Assert
      expect(result.notes).toBe('Important notes that should persist')
      expect(result.visibility).toBe('HIDDEN')
    })

    it('should throw error if item not found', async () => {
      // Arrange
      prismaMock.roomFFEItem.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(updateItemVisibility('invalid-id', 'VISIBLE', 'user-1'))
        .rejects.toThrow('FFE item not found')
    })

    it('should throw error for invalid visibility value', async () => {
      // Act & Assert
      await expect(updateItemVisibility('item-1', 'INVALID' as any, 'user-1'))
        .rejects.toThrow('Invalid visibility value')
    })
  })

  describe('getVisibleItems', () => {
    const mockRoom = {
      id: 'room-1',
      name: 'Test Room',
      sections: [
        {
          id: 'section-1',
          name: 'Test Section',
          items: [
            {
              id: 'item-1',
              name: 'Visible Item',
              visibility: 'VISIBLE',
              state: 'PENDING',
              notes: 'Test notes'
            },
            {
              id: 'item-2', 
              name: 'Hidden Item',
              visibility: 'HIDDEN',
              state: 'COMPLETED',
              notes: 'Hidden notes'
            }
          ]
        }
      ]
    }

    it('should return only visible items', async () => {
      // Arrange
      prismaMock.room.findUnique.mockResolvedValue(mockRoom as any)

      // Act
      const result = await getVisibleItems('room-1')

      // Assert
      expect(prismaMock.room.findUnique).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        include: {
          sections: {
            include: {
              items: {
                where: { visibility: 'VISIBLE' },
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      })
      expect(result.sections[0].items).toHaveLength(1)
      expect(result.sections[0].items[0].name).toBe('Visible Item')
    })

    it('should return empty sections if no visible items', async () => {
      // Arrange
      const roomWithHiddenItems = {
        ...mockRoom,
        sections: [{
          ...mockRoom.sections[0],
          items: []
        }]
      }
      prismaMock.room.findUnique.mockResolvedValue(roomWithHiddenItems as any)

      // Act
      const result = await getVisibleItems('room-1')

      // Assert
      expect(result.sections[0].items).toHaveLength(0)
    })
  })

  describe('getAllItems', () => {
    it('should return all items regardless of visibility', async () => {
      // Arrange
      const mockRoom = {
        id: 'room-1',
        sections: [
          {
            id: 'section-1',
            items: [
              { id: 'item-1', visibility: 'VISIBLE' },
              { id: 'item-2', visibility: 'HIDDEN' }
            ]
          }
        ]
      }
      prismaMock.room.findUnique.mockResolvedValue(mockRoom as any)

      // Act
      const result = await getAllItems('room-1')

      // Assert
      expect(prismaMock.room.findUnique).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        include: {
          sections: {
            include: {
              items: {
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      })
      expect(result.sections[0].items).toHaveLength(2)
    })
  })

  describe('bulkUpdateVisibility', () => {
    it('should update all items to VISIBLE', async () => {
      // Arrange
      prismaMock.roomFFEItem.updateMany.mockResolvedValue({ count: 5 })

      // Act
      const result = await bulkUpdateVisibility('room-1', 'VISIBLE', 'user-1')

      // Assert
      expect(prismaMock.roomFFEItem.updateMany).toHaveBeenCalledWith({
        where: { roomId: 'room-1' },
        data: { visibility: 'VISIBLE' }
      })
      expect(result.count).toBe(5)
    })

    it('should update all items to HIDDEN', async () => {
      // Arrange
      prismaMock.roomFFEItem.updateMany.mockResolvedValue({ count: 3 })

      // Act
      const result = await bulkUpdateVisibility('room-1', 'HIDDEN', 'user-1')

      // Assert
      expect(prismaMock.roomFFEItem.updateMany).toHaveBeenCalledWith({
        where: { roomId: 'room-1' },
        data: { visibility: 'HIDDEN' }
      })
      expect(result.count).toBe(3)
    })
  })

  describe('Notes persistence during visibility changes', () => {
    it('should maintain notes when hiding an item', async () => {
      // Arrange
      const itemWithNotes = {
        id: 'item-1',
        name: 'Test Item',
        visibility: 'VISIBLE' as const,
        state: 'PENDING' as const,
        notes: 'These notes should persist across visibility changes',
        roomId: 'room-1',
        sectionId: 'section-1'
      }
      
      prismaMock.roomFFEItem.findUnique.mockResolvedValue(itemWithNotes as any)
      prismaMock.roomFFEItem.update.mockResolvedValue({
        ...itemWithNotes,
        visibility: 'HIDDEN'
      } as any)

      // Act
      const result = await updateItemVisibility('item-1', 'HIDDEN', 'user-1')

      // Assert
      expect(result.notes).toBe('These notes should persist across visibility changes')
      expect(result.visibility).toBe('HIDDEN')
    })

    it('should maintain notes when making an item visible again', async () => {
      // Arrange
      const hiddenItemWithNotes = {
        id: 'item-1',
        name: 'Test Item',
        visibility: 'HIDDEN' as const,
        state: 'COMPLETED' as const,
        notes: 'Notes from when item was previously worked on',
        roomId: 'room-1',
        sectionId: 'section-1'
      }
      
      prismaMock.roomFFEItem.findUnique.mockResolvedValue(hiddenItemWithNotes as any)
      prismaMock.roomFFEItem.update.mockResolvedValue({
        ...hiddenItemWithNotes,
        visibility: 'VISIBLE'
      } as any)

      // Act
      const result = await updateItemVisibility('item-1', 'VISIBLE', 'user-1')

      // Assert
      expect(result.notes).toBe('Notes from when item was previously worked on')
      expect(result.state).toBe('COMPLETED') // State should also persist
      expect(result.visibility).toBe('VISIBLE')
    })
  })
})

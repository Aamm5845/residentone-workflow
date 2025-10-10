import { NextRequest } from 'next/server'
import { POST } from '@/app/api/team/route'
import { PUT } from '@/app/api/team/[userId]/route'
import { getSession } from '@/auth'

// Mock dependencies
jest.mock('@/auth')
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      findFirst: jest.fn(),
    },
  },
}))

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>

describe('Team API Email Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock authenticated admin session
    mockGetSession.mockResolvedValue({
      user: {
        id: 'test-user-id',
        orgId: 'test-org-id',
        role: 'OWNER',
      },
    } as any)
  })

  describe('POST /api/team - Create team member', () => {
    it('should reject example.com emails in production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const request = new NextRequest('http://localhost/api/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          role: 'DESIGNER',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid email domain. Please use a real email address.')

      process.env.NODE_ENV = originalEnv
    })

    it('should allow example.com emails in test environment', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'test'

      // Mock the prisma calls for successful creation
      const { prisma } = require('@/lib/prisma')
      prisma.user.findUnique.mockResolvedValue(null) // No existing user
      prisma.user.findFirst.mockResolvedValue(null) // No user with role
      prisma.organization.findFirst.mockResolvedValue({ id: 'test-org-id' })
      prisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        name: 'Test User',
        email: 'test@example.com',
        role: 'DESIGNER',
        _count: { assignedStages: 0, comments: 0, uploadedAssets: 0 },
      })

      const request = new NextRequest('http://localhost/api/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          role: 'DESIGNER',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('PUT /api/team/[userId] - Update team member', () => {
    it('should reject example.com emails in production when updating', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      // Mock existing user
      const { prisma } = require('@/lib/prisma')
      prisma.user.findFirst.mockResolvedValue({
        id: 'existing-user-id',
        name: 'Existing User',
        email: 'existing@realcompany.com',
        role: 'DESIGNER',
      })

      const request = new NextRequest('http://localhost/api/team/existing-user-id', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'updated@example.com',
        }),
      })

      const response = await PUT(request, { 
        params: Promise.resolve({ userId: 'existing-user-id' }) 
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid email domain. Please use a real email address.')

      process.env.NODE_ENV = originalEnv
    })

    it('should allow example.com emails in test environment when updating', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'test'

      // Mock existing user and successful update
      const { prisma } = require('@/lib/prisma')
      prisma.user.findFirst
        .mockResolvedValueOnce({
          id: 'existing-user-id',
          name: 'Existing User',
          email: 'existing@realcompany.com',
          role: 'DESIGNER',
        })
        .mockResolvedValueOnce(null) // No email conflict

      prisma.user.update.mockResolvedValue({
        id: 'existing-user-id',
        name: 'Existing User',
        email: 'updated@example.com',
        role: 'DESIGNER',
        _count: { assignedStages: 0, comments: 0, uploadedAssets: 0 },
      })

      const request = new NextRequest('http://localhost/api/team/existing-user-id', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'updated@example.com',
        }),
      })

      const response = await PUT(request, { 
        params: Promise.resolve({ userId: 'existing-user-id' }) 
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.email).toBe('updated@example.com')

      process.env.NODE_ENV = originalEnv
    })
  })
})
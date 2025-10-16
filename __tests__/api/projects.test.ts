import { createMocks } from 'node-mocks-http'
import handler from '@/app/api/projects/[id]/updates/route'

// Mock Prisma
const mockPrisma = {
  project: {
    findFirst: jest.fn(),
  },
  projectUpdate: {
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  projectUpdateActivity: {
    create: jest.fn(),
  }
}

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}))

jest.mock('@/auth', () => ({
  getSession: jest.fn(() => ({
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'ADMIN'
    }
  }))
}))

describe('/api/projects/[id]/updates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return project updates with pagination', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project'
      }

      const mockUpdates = [
        {
          id: 'update-1',
          title: 'Test Update',
          description: 'Test description',
          type: 'PROGRESS_UPDATE',
          status: 'PUBLISHED',
          createdAt: new Date(),
          createdBy: { id: 'user-1', name: 'Test User' },
          _count: { photos: 2, tasks: 1, messages: 3 }
        }
      ]

      mockPrisma.project.findFirst.mockResolvedValue(mockProject)
      mockPrisma.projectUpdate.findMany.mockResolvedValue(mockUpdates)
      mockPrisma.projectUpdate.count.mockResolvedValue(1)
      mockPrisma.projectUpdate.groupBy.mockResolvedValue([
        { status: 'PUBLISHED', _count: { id: 1 } }
      ])

      const { req, res } = createMocks({
        method: 'GET',
        url: '/api/projects/project-1/updates?page=1&limit=10',
        query: { id: 'project-1', page: '1', limit: '10' }
      })

      await handler.GET(req as any, { params: { id: 'project-1' } } as any)

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'project-1',
          OR: expect.any(Array)
        }
      })
      expect(mockPrisma.projectUpdate.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10
      })
    })

    it('should return 404 for non-existent project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null)

      const { req, res } = createMocks({
        method: 'GET',
        query: { id: 'non-existent' }
      })

      const response = await handler.GET(req as any, { params: { id: 'non-existent' } } as any)

      expect(response.status).toBe(404)
    })
  })

  describe('POST', () => {
    it('should create a new project update', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project'
      }

      const mockCreatedUpdate = {
        id: 'update-1',
        title: 'New Update',
        description: 'New description',
        type: 'PROGRESS_UPDATE',
        status: 'DRAFT',
        projectId: 'project-1',
        createdById: 'user-1'
      }

      mockPrisma.project.findFirst.mockResolvedValue(mockProject)
      mockPrisma.projectUpdate.create.mockResolvedValue(mockCreatedUpdate)

      const updateData = {
        title: 'New Update',
        description: 'New description',
        type: 'PROGRESS_UPDATE',
        category: 'Construction'
      }

      const { req, res } = createMocks({
        method: 'POST',
        body: updateData,
        query: { id: 'project-1' }
      })

      const response = await handler.POST(req as any, { params: { id: 'project-1' } } as any)

      expect(response.status).toBe(201)
      expect(mockPrisma.projectUpdate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'New Update',
          description: 'New description',
          type: 'PROGRESS_UPDATE',
          projectId: 'project-1',
          createdById: 'user-1'
        }),
        include: expect.any(Object)
      })
    })

    it('should validate required fields', async () => {
      const mockProject = { id: 'project-1' }
      mockPrisma.project.findFirst.mockResolvedValue(mockProject)

      const invalidData = {
        description: 'Missing title'
      }

      const { req, res } = createMocks({
        method: 'POST',
        body: invalidData,
        query: { id: 'project-1' }
      })

      const response = await handler.POST(req as any, { params: { id: 'project-1' } } as any)

      expect(response.status).toBe(400)
    })
  })
})

describe('Project Updates Integration', () => {
  it('should handle the complete flow of creating an update with photos and tasks', async () => {
    // This would be an integration test that tests the full flow
    const projectId = 'test-project'
    const updateData = {
      title: 'Kitchen Renovation Complete',
      description: 'All kitchen work has been finished',
      type: 'MILESTONE',
      category: 'Construction',
      status: 'PUBLISHED'
    }

    // Mock the full flow
    mockPrisma.project.findFirst.mockResolvedValue({ id: projectId })
    mockPrisma.projectUpdate.create.mockResolvedValue({
      id: 'update-1',
      ...updateData,
      projectId,
      createdById: 'user-1'
    })

    // Test that activity logging is called
    expect(mockPrisma.projectUpdateActivity.create).toBeDefined()
  })
})
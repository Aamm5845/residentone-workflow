/**
 * Unit tests for FFE Template Service
 * 
 * Tests all CRUD operations, validation, and business logic
 * for template management in the new FFE system.
 */

import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { FFETemplateService } from '@/lib/services/ffe-template-service';
import type { FFETemplate, CreateFFETemplateData, UpdateFFETemplateData } from '@/types/ffe-v2';

// Mock Prisma Client
const mockPrisma = {
  fFETemplate: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  fFESection: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
} as unknown as jest.Mocked<PrismaClient>;

// Mock audit logger
const mockAuditLogger = {
  logTemplateAction: jest.fn(),
  logError: jest.fn(),
};

describe('FFETemplateService', () => {
  let service: FFETemplateService;
  const mockOrgId = 'org-123';
  const mockUserId = 'user-456';

  beforeEach(() => {
    service = new FFETemplateService(mockPrisma, mockAuditLogger as any);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getAllTemplates', () => {
    it('should return all templates for an organization', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          orgId: mockOrgId,
          name: 'Bedroom Template',
          roomType: 'BEDROOM',
          isActive: true,
          sections: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'template-2',
          orgId: mockOrgId,
          name: 'Bathroom Template',
          roomType: 'BATHROOM',
          isActive: true,
          sections: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.fFETemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await service.getAllTemplates(mockOrgId);

      expect(mockPrisma.fFETemplate.findMany).toHaveBeenCalledWith({
        where: { orgId: mockOrgId },
        include: {
          sections: {
            include: { items: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual(mockTemplates);
    });

    it('should filter templates by room type when specified', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          orgId: mockOrgId,
          name: 'Bedroom Template',
          roomType: 'BEDROOM',
          isActive: true,
          sections: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.fFETemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await service.getAllTemplates(mockOrgId, 'BEDROOM');

      expect(mockPrisma.fFETemplate.findMany).toHaveBeenCalledWith({
        where: { 
          orgId: mockOrgId,
          roomType: 'BEDROOM'
        },
        include: {
          sections: {
            include: { items: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual(mockTemplates);
    });

    it('should filter active templates only when specified', async () => {
      const result = await service.getAllTemplates(mockOrgId, undefined, true);

      expect(mockPrisma.fFETemplate.findMany).toHaveBeenCalledWith({
        where: { 
          orgId: mockOrgId,
          isActive: true
        },
        include: {
          sections: {
            include: { items: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('getTemplateById', () => {
    it('should return a template by ID', async () => {
      const mockTemplate = {
        id: 'template-1',
        orgId: mockOrgId,
        name: 'Bedroom Template',
        roomType: 'BEDROOM',
        isActive: true,
        sections: [
          {
            id: 'section-1',
            name: 'Flooring',
            order: 0,
            items: [
              {
                id: 'item-1',
                name: 'Hardwood Flooring',
                description: 'Premium oak hardwood',
                defaultState: 'PENDING',
                isRequired: true,
                estimatedCost: 5000,
                notes: '',
              },
            ],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.fFETemplate.findUnique.mockResolvedValue(mockTemplate);

      const result = await service.getTemplateById('template-1', mockOrgId);

      expect(mockPrisma.fFETemplate.findUnique).toHaveBeenCalledWith({
        where: { 
          id: 'template-1',
          orgId: mockOrgId 
        },
        include: {
          sections: {
            include: { items: true },
            orderBy: { order: 'asc' },
          },
        },
      });
      expect(result).toEqual(mockTemplate);
    });

    it('should return null for non-existent template', async () => {
      mockPrisma.fFETemplate.findUnique.mockResolvedValue(null);

      const result = await service.getTemplateById('non-existent', mockOrgId);

      expect(result).toBeNull();
    });
  });

  describe('createTemplate', () => {
    it('should create a new template successfully', async () => {
      const createData: CreateFFETemplateData = {
        orgId: mockOrgId,
        name: 'New Bedroom Template',
        description: 'A comprehensive bedroom template',
        roomType: 'BEDROOM',
        isActive: true,
        sections: [
          {
            name: 'Flooring',
            order: 0,
            items: [
              {
                name: 'Hardwood Flooring',
                description: 'Premium oak hardwood',
                defaultState: 'PENDING',
                isRequired: true,
                estimatedCost: 5000,
                notes: '',
              },
            ],
          },
        ],
      };

      const mockCreatedTemplate = {
        id: 'template-new',
        ...createData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.fFETemplate.create.mockResolvedValue(mockCreatedTemplate);

      const result = await service.createTemplate(createData, mockUserId);

      expect(mockPrisma.fFETemplate.create).toHaveBeenCalledWith({
        data: {
          orgId: mockOrgId,
          name: 'New Bedroom Template',
          description: 'A comprehensive bedroom template',
          roomType: 'BEDROOM',
          isActive: true,
          sections: {
            create: [
              {
                name: 'Flooring',
                order: 0,
                items: {
                  create: [
                    {
                      name: 'Hardwood Flooring',
                      description: 'Premium oak hardwood',
                      defaultState: 'PENDING',
                      isRequired: true,
                      estimatedCost: 5000,
                      notes: '',
                    },
                  ],
                },
              },
            ],
          },
        },
        include: {
          sections: {
            include: { items: true },
            orderBy: { order: 'asc' },
          },
        },
      });

      expect(mockAuditLogger.logTemplateAction).toHaveBeenCalledWith(
        'TEMPLATE_CREATED',
        mockUserId,
        mockOrgId,
        'template-new',
        { templateName: 'New Bedroom Template' }
      );

      expect(result).toEqual(mockCreatedTemplate);
    });

    it('should throw error for invalid template data', async () => {
      const invalidData = {
        orgId: mockOrgId,
        name: '', // Empty name should be invalid
        roomType: 'BEDROOM',
        isActive: true,
        sections: [],
      } as CreateFFETemplateData;

      await expect(service.createTemplate(invalidData, mockUserId))
        .rejects.toThrow('Template name is required');

      expect(mockPrisma.fFETemplate.create).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const createData: CreateFFETemplateData = {
        orgId: mockOrgId,
        name: 'Test Template',
        roomType: 'BEDROOM',
        isActive: true,
        sections: [],
      };

      const dbError = new Error('Database connection failed');
      mockPrisma.fFETemplate.create.mockRejectedValue(dbError);

      await expect(service.createTemplate(createData, mockUserId))
        .rejects.toThrow('Database connection failed');

      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        'TEMPLATE_CREATE_FAILED',
        mockUserId,
        mockOrgId,
        expect.objectContaining({ error: dbError.message })
      );
    });
  });

  describe('updateTemplate', () => {
    it('should update an existing template', async () => {
      const updateData: UpdateFFETemplateData = {
        name: 'Updated Bedroom Template',
        description: 'Updated description',
        isActive: false,
      };

      const mockUpdatedTemplate = {
        id: 'template-1',
        orgId: mockOrgId,
        name: 'Updated Bedroom Template',
        description: 'Updated description',
        roomType: 'BEDROOM',
        isActive: false,
        sections: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.fFETemplate.update.mockResolvedValue(mockUpdatedTemplate);

      const result = await service.updateTemplate('template-1', updateData, mockOrgId, mockUserId);

      expect(mockPrisma.fFETemplate.update).toHaveBeenCalledWith({
        where: { 
          id: 'template-1',
          orgId: mockOrgId 
        },
        data: updateData,
        include: {
          sections: {
            include: { items: true },
            orderBy: { order: 'asc' },
          },
        },
      });

      expect(mockAuditLogger.logTemplateAction).toHaveBeenCalledWith(
        'TEMPLATE_UPDATED',
        mockUserId,
        mockOrgId,
        'template-1',
        { changes: updateData }
      );

      expect(result).toEqual(mockUpdatedTemplate);
    });

    it('should handle non-existent template', async () => {
      const updateData: UpdateFFETemplateData = {
        name: 'Updated Template',
      };

      const dbError = { code: 'P2025', message: 'Record not found' };
      mockPrisma.fFETemplate.update.mockRejectedValue(dbError);

      await expect(service.updateTemplate('non-existent', updateData, mockOrgId, mockUserId))
        .rejects.toThrow('Template not found');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete an existing template', async () => {
      const mockTemplate = {
        id: 'template-1',
        orgId: mockOrgId,
        name: 'Test Template',
        roomType: 'BEDROOM',
        isActive: true,
        sections: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.fFETemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.fFETemplate.delete.mockResolvedValue(mockTemplate);

      const result = await service.deleteTemplate('template-1', mockOrgId, mockUserId);

      expect(mockPrisma.fFETemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'template-1', orgId: mockOrgId },
      });

      expect(mockPrisma.fFETemplate.delete).toHaveBeenCalledWith({
        where: { id: 'template-1' },
      });

      expect(mockAuditLogger.logTemplateAction).toHaveBeenCalledWith(
        'TEMPLATE_DELETED',
        mockUserId,
        mockOrgId,
        'template-1',
        { templateName: 'Test Template' }
      );

      expect(result).toBe(true);
    });

    it('should return false for non-existent template', async () => {
      mockPrisma.fFETemplate.findUnique.mockResolvedValue(null);

      const result = await service.deleteTemplate('non-existent', mockOrgId, mockUserId);

      expect(result).toBe(false);
      expect(mockPrisma.fFETemplate.delete).not.toHaveBeenCalled();
    });
  });

  describe('copyTemplate', () => {
    it('should copy an existing template with new name', async () => {
      const originalTemplate = {
        id: 'template-1',
        orgId: mockOrgId,
        name: 'Original Template',
        description: 'Original description',
        roomType: 'BEDROOM',
        isActive: true,
        sections: [
          {
            id: 'section-1',
            name: 'Flooring',
            order: 0,
            items: [
              {
                id: 'item-1',
                name: 'Hardwood Flooring',
                description: 'Premium oak hardwood',
                defaultState: 'PENDING',
                isRequired: true,
                estimatedCost: 5000,
                notes: '',
              },
            ],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const copiedTemplate = {
        id: 'template-copy',
        orgId: mockOrgId,
        name: 'Copy of Original Template',
        description: 'Original description',
        roomType: 'BEDROOM',
        isActive: true,
        sections: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.fFETemplate.findUnique.mockResolvedValue(originalTemplate);
      mockPrisma.fFETemplate.create.mockResolvedValue(copiedTemplate);

      const result = await service.copyTemplate('template-1', 'Copy of Original Template', mockOrgId, mockUserId);

      expect(mockPrisma.fFETemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'template-1', orgId: mockOrgId },
        include: {
          sections: {
            include: { items: true },
            orderBy: { order: 'asc' },
          },
        },
      });

      expect(mockPrisma.fFETemplate.create).toHaveBeenCalledWith({
        data: {
          orgId: mockOrgId,
          name: 'Copy of Original Template',
          description: 'Original description',
          roomType: 'BEDROOM',
          isActive: true,
          sections: {
            create: [
              {
                name: 'Flooring',
                order: 0,
                items: {
                  create: [
                    {
                      name: 'Hardwood Flooring',
                      description: 'Premium oak hardwood',
                      defaultState: 'PENDING',
                      isRequired: true,
                      estimatedCost: 5000,
                      notes: '',
                    },
                  ],
                },
              },
            ],
          },
        },
        include: {
          sections: {
            include: { items: true },
            orderBy: { order: 'asc' },
          },
        },
      });

      expect(mockAuditLogger.logTemplateAction).toHaveBeenCalledWith(
        'TEMPLATE_COPIED',
        mockUserId,
        mockOrgId,
        'template-copy',
        { sourceTemplateId: 'template-1', newName: 'Copy of Original Template' }
      );

      expect(result).toEqual(copiedTemplate);
    });

    it('should handle copying non-existent template', async () => {
      mockPrisma.fFETemplate.findUnique.mockResolvedValue(null);

      await expect(service.copyTemplate('non-existent', 'Copy', mockOrgId, mockUserId))
        .rejects.toThrow('Template not found');

      expect(mockPrisma.fFETemplate.create).not.toHaveBeenCalled();
    });
  });

  describe('validateTemplate', () => {
    it('should validate a valid template', () => {
      const validTemplate: CreateFFETemplateData = {
        orgId: mockOrgId,
        name: 'Valid Template',
        description: 'A valid template',
        roomType: 'BEDROOM',
        isActive: true,
        sections: [
          {
            name: 'Flooring',
            order: 0,
            items: [
              {
                name: 'Hardwood Flooring',
                description: 'Premium oak hardwood',
                defaultState: 'PENDING',
                isRequired: true,
                estimatedCost: 5000,
                notes: '',
              },
            ],
          },
        ],
      };

      expect(() => service.validateTemplate(validTemplate)).not.toThrow();
    });

    it('should reject template with empty name', () => {
      const invalidTemplate = {
        orgId: mockOrgId,
        name: '',
        roomType: 'BEDROOM',
        isActive: true,
        sections: [],
      } as CreateFFETemplateData;

      expect(() => service.validateTemplate(invalidTemplate))
        .toThrow('Template name is required');
    });

    it('should reject template with invalid room type', () => {
      const invalidTemplate = {
        orgId: mockOrgId,
        name: 'Test Template',
        roomType: 'INVALID_ROOM_TYPE',
        isActive: true,
        sections: [],
      } as CreateFFETemplateData;

      expect(() => service.validateTemplate(invalidTemplate))
        .toThrow('Invalid room type');
    });

    it('should reject sections with duplicate names', () => {
      const invalidTemplate: CreateFFETemplateData = {
        orgId: mockOrgId,
        name: 'Test Template',
        roomType: 'BEDROOM',
        isActive: true,
        sections: [
          { name: 'Flooring', order: 0, items: [] },
          { name: 'Flooring', order: 1, items: [] }, // Duplicate name
        ],
      };

      expect(() => service.validateTemplate(invalidTemplate))
        .toThrow('Duplicate section names are not allowed');
    });

    it('should reject items with empty names', () => {
      const invalidTemplate: CreateFFETemplateData = {
        orgId: mockOrgId,
        name: 'Test Template',
        roomType: 'BEDROOM',
        isActive: true,
        sections: [
          {
            name: 'Flooring',
            order: 0,
            items: [
              {
                name: '', // Empty name
                description: 'Test item',
                defaultState: 'PENDING',
                isRequired: false,
                estimatedCost: null,
                notes: '',
              },
            ],
          },
        ],
      };

      expect(() => service.validateTemplate(invalidTemplate))
        .toThrow('Item name is required');
    });
  });
});
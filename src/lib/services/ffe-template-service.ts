import { FFETemplate, FFETemplateStatus, RoomType, FFEItemState } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { FFEChangeLog } from '../types/ffe-types'

export interface CreateFFETemplateData {
  orgId: string
  name: string
  description?: string
  status?: FFETemplateStatus
  isDefault?: boolean
  tags?: string[]
  metadata?: any
  sections: CreateFFETemplateSectionData[]
}

export interface CreateFFETemplateSectionData {
  name: string
  description?: string
  order: number
  isRequired?: boolean
  isCollapsible?: boolean
  icon?: string
  color?: string
  items: CreateFFETemplateItemData[]
}

export interface CreateFFETemplateItemData {
  name: string
  description?: string
  defaultState?: FFEItemState
  isRequired?: boolean
  order: number
  category?: string
  tags?: string[]
  estimatedCost?: number
  leadTimeWeeks?: number
  supplierInfo?: any
  customFields?: any
}

export interface UpdateFFETemplateData {
  name?: string
  description?: string
  status?: FFETemplateStatus
  isDefault?: boolean
  tags?: string[]
  metadata?: any
}

export interface FFETemplateWithRelations extends FFETemplate {
  sections: Array<{
    id: string
    name: string
    description?: string
    order: number
    isRequired: boolean
    isCollapsible: boolean
    icon?: string
    color?: string
    items: Array<{
      id: string
      name: string
      description?: string
      defaultState: FFEItemState
      isRequired: boolean
      order: number
      category?: string
      tags: string[]
      estimatedCost?: number
      leadTimeWeeks?: number
      supplierInfo?: any
      customFields?: any
    }>
  }>
}

/**
 * FFE Template Service
 * Handles CRUD operations for FFE templates, sections, and items
 */
export class FFETemplateService {
  
  /**
   * Get all FFE templates for an organization
   */
  async getTemplates(orgId: string, filters?: {
    status?: FFETemplateStatus
    search?: string
  }): Promise<FFETemplateWithRelations[]> {
    const where: any = { orgId }
    
    if (filters?.status) {
      where.status = filters.status
    }
    
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ]
    }
    
    return prisma.fFETemplate.findMany({
      where,
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            items: {
              orderBy: { order: 'asc' }
            }
          }
        },
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } }
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    }) as Promise<FFETemplateWithRelations[]>
  }
  
  /**
   * Get a single FFE template with all relations
   */
  async getTemplate(templateId: string, orgId: string): Promise<FFETemplateWithRelations | null> {
    return prisma.fFETemplate.findFirst({
      where: { id: templateId, orgId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            items: {
              orderBy: { order: 'asc' }
            }
          }
        },
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } }
      }
    }) as Promise<FFETemplateWithRelations | null>
  }
  
  /**
   * Create a new FFE template
   */
  async createTemplate(data: CreateFFETemplateData, userId: string): Promise<FFETemplateWithRelations> {
    return prisma.$transaction(async (tx) => {
      // Create the template with sections and items
      const template = await tx.fFETemplate.create({
        data: {
          orgId: data.orgId,
          name: data.name,
          description: data.description,
          status: data.status || 'DRAFT',
          isDefault: data.isDefault || false,
          tags: data.tags || [],
          metadata: data.metadata,
          createdById: userId,
          updatedById: userId,
          sections: {
            create: data.sections.map(section => ({
              name: section.name,
              description: section.description,
              order: section.order,
              isRequired: section.isRequired || false,
              isCollapsible: section.isCollapsible !== false,
              icon: section.icon,
              color: section.color,
              items: {
                create: section.items.map(item => ({
                  name: item.name,
                  description: item.description,
                  defaultState: item.defaultState || 'PENDING',
                  isRequired: item.isRequired || false,
                  order: item.order,
                  category: item.category,
                  tags: item.tags || [],
                  estimatedCost: item.estimatedCost,
                  leadTimeWeeks: item.leadTimeWeeks,
                  supplierInfo: item.supplierInfo,
                  customFields: item.customFields
                }))
              }
            }))
          }
        },
        include: {
          sections: {
            orderBy: { order: 'asc' },
            include: {
              items: {
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      })
      
      // Log the creation
      await this.logChange({
        entityType: 'template',
        entityId: template.id,
        action: 'created',
        userId,
        orgId: data.orgId,
        metadata: { templateName: data.name }
      })
      
      return template as FFETemplateWithRelations
    })
  }
  
  /**
   * Update an existing FFE template
   */
  async updateTemplate(templateId: string, data: UpdateFFETemplateData, userId: string, orgId: string): Promise<FFETemplateWithRelations> {
    return prisma.$transaction(async (tx) => {
      // Get old data for change logging
      const oldTemplate = await tx.fFETemplate.findFirst({
        where: { id: templateId, orgId }
      })
      
      if (!oldTemplate) {
        throw new Error('Template not found')
      }
      
      const template = await tx.fFETemplate.update({
        where: { id: templateId },
        data: {
          ...data,
          updatedById: userId
        },
        include: {
          sections: {
            orderBy: { order: 'asc' },
            include: {
              items: {
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      })
      
      // Log changes
      const changes = Object.entries(data)
        .filter(([key, value]) => oldTemplate[key as keyof typeof oldTemplate] !== value)
        .map(([key, value]) => ({
          fieldName: key,
          oldValue: String(oldTemplate[key as keyof typeof oldTemplate] || ''),
          newValue: String(value || '')
        }))
      
      for (const change of changes) {
        await this.logChange({
          entityType: 'template',
          entityId: templateId,
          action: 'updated',
          fieldName: change.fieldName,
          oldValue: change.oldValue,
          newValue: change.newValue,
          userId,
          orgId
        })
      }
      
      return template as FFETemplateWithRelations
    })
  }
  
  /**
   * Copy an existing template to create a new one
   */
  async copyTemplate(templateId: string, newName: string, userId: string, orgId: string): Promise<FFETemplateWithRelations> {
    return prisma.$transaction(async (tx) => {
      // Get the original template with all relations
      const originalTemplate = await tx.fFETemplate.findFirst({
        where: { id: templateId, orgId },
        include: {
          sections: {
            include: {
              items: true
            }
          }
        }
      })
      
      if (!originalTemplate) {
        throw new Error('Template to copy not found')
      }
      
      // Create the new template
      const newTemplate = await tx.fFETemplate.create({
        data: {
          orgId,
          name: newName,
          description: `Copy of ${originalTemplate.name}`,
          status: 'DRAFT', // New copies start as drafts
          isDefault: false, // Copies are never default
          tags: originalTemplate.tags,
          metadata: originalTemplate.metadata,
          createdById: userId,
          updatedById: userId,
          sections: {
            create: originalTemplate.sections.map(section => ({
              name: section.name,
              description: section.description,
              order: section.order,
              isRequired: section.isRequired,
              isCollapsible: section.isCollapsible,
              icon: section.icon,
              color: section.color,
              items: {
                create: section.items.map(item => ({
                  name: item.name,
                  description: item.description,
                  defaultState: item.defaultState,
                  isRequired: item.isRequired,
                  order: item.order,
                  category: item.category,
                  tags: item.tags,
                  estimatedCost: item.estimatedCost,
                  leadTimeWeeks: item.leadTimeWeeks,
                  supplierInfo: item.supplierInfo,
                  customFields: item.customFields
                }))
              }
            }))
          }
        },
        include: {
          sections: {
            orderBy: { order: 'asc' },
            include: {
              items: {
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      })
      
      // Log the copy operation
      await this.logChange({
        entityType: 'template',
        entityId: newTemplate.id,
        action: 'copied',
        userId,
        orgId,
        metadata: { 
          originalTemplateId: templateId,
          originalTemplateName: originalTemplate.name,
          newTemplateName: newName 
        }
      })
      
      return newTemplate as FFETemplateWithRelations
    })
  }
  
  /**
   * Delete a template (archive it)
   */
  async deleteTemplate(templateId: string, userId: string, orgId: string): Promise<void> {
    return prisma.$transaction(async (tx) => {
      const template = await tx.fFETemplate.findFirst({
        where: { id: templateId, orgId }
      })
      
      if (!template) {
        throw new Error('Template not found')
      }
      
      // Check if template is in use by any room instances
      const instancesUsingTemplate = await tx.roomFFEInstance.count({
        where: { templateId }
      })
      
      if (instancesUsingTemplate > 0) {
        // Archive instead of delete if in use
        await tx.fFETemplate.update({
          where: { id: templateId },
          data: {
            status: 'ARCHIVED',
            updatedById: userId
          }
        })
        
        await this.logChange({
          entityType: 'template',
          entityId: templateId,
          action: 'archived',
          userId,
          orgId,
          metadata: { reason: 'Template in use by active rooms' }
        })
      } else {
        // Safe to hard delete
        await tx.fFETemplate.delete({
          where: { id: templateId }
        })
        
        await this.logChange({
          entityType: 'template',
          entityId: templateId,
          action: 'deleted',
          userId,
          orgId,
          metadata: { templateName: template.name }
        })
      }
    })
  }
  
  /**
   * Get available section library items
   */
  async getSectionLibrary() {
    return prisma.fFESectionLibrary.findMany({
      orderBy: { defaultOrder: 'asc' }
    })
  }
  
  /**
   * Set a template as default for a room type
   */
  async setDefaultTemplate(templateId: string, userId: string, orgId: string): Promise<void> {
    return prisma.$transaction(async (tx) => {
      const template = await tx.fFETemplate.findFirst({
        where: { id: templateId, orgId }
      })
      
      if (!template) {
        throw new Error('Template not found')
      }
      
      // Remove default status from other templates of same room type
      await tx.fFETemplate.updateMany({
        where: {
          orgId,
          roomType: template.roomType,
          id: { not: templateId }
        },
        data: {
          isDefault: false,
          updatedById: userId
        }
      })
      
      // Set this template as default
      await tx.fFETemplate.update({
        where: { id: templateId },
        data: {
          isDefault: true,
          status: 'ACTIVE', // Default templates must be active
          updatedById: userId
        }
      })
      
      await this.logChange({
        entityType: 'template',
        entityId: templateId,
        action: 'set_as_default',
        userId,
        orgId,
        metadata: { roomType: template.roomType }
      })
    })
  }
  
  /**
   * Log changes for audit trail
   */
  private async logChange(data: {
    entityType: string
    entityId: string
    action: string
    fieldName?: string
    oldValue?: string
    newValue?: string
    userId: string
    orgId: string
    roomId?: string
    instanceId?: string
    metadata?: any
  }) {
    await prisma.fFEChangeLog.create({
      data: {
        ...data,
        createdAt: new Date()
      }
    })
  }
}

// Export singleton instance
export const ffeTemplateService = new FFETemplateService()

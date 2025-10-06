import { PrismaClient, RoomType, FFEItemState, FFEInstanceStatus } from '@prisma/client'
import { ffeTemplateService } from './ffe-template-service'

const prisma = new PrismaClient()

export interface CreateRoomFFEInstanceData {
  roomId: string
  templateId?: string
  name: string
  estimatedBudget?: number
  targetCompletionDate?: Date
  notes?: string
  metadata?: any
}

export interface UpdateRoomFFEInstanceData {
  name?: string
  status?: FFEInstanceStatus
  estimatedBudget?: number
  actualBudget?: number
  targetCompletionDate?: Date
  actualCompletionDate?: Date
  notes?: string
  metadata?: any
}

export interface UpdateRoomFFEItemData {
  state?: FFEItemState
  quantity?: number
  unitCost?: number
  supplierName?: string
  supplierLink?: string
  modelNumber?: string
  notes?: string
  attachments?: any
  customFields?: any
}

export interface RoomFFEInstanceWithRelations {
  id: string
  roomId: string
  templateId?: string
  name: string
  status: FFEInstanceStatus
  progress: number
  estimatedBudget?: number
  actualBudget?: number
  targetCompletionDate?: Date
  actualCompletionDate?: Date
  notes?: string
  metadata?: any
  createdAt: Date
  updatedAt: Date
  
  // Relations
  room: {
    id: string
    name?: string
    type: RoomType
    project: {
      id: string
      name: string
      orgId: string
    }
  }
  template?: {
    id: string
    name: string
  }
  sections: Array<{
    id: string
    name: string
    description?: string
    order: number
    isExpanded: boolean
    isCompleted: boolean
    completedAt?: Date
    notes?: string
    items: Array<{
      id: string
      name: string
      description?: string
      state: FFEItemState
      isRequired: boolean
      isCustom: boolean
      order: number
      quantity: number
      unitCost?: number
      totalCost?: number
      supplierName?: string
      supplierLink?: string
      modelNumber?: string
      notes?: string
      completedAt?: Date
      attachments?: any
      customFields?: any
    }>
  }>
}

/**
 * FFE Room Service
 * Manages room-specific FFE instances, sections, and items
 */
export class FFERoomService {

  /**
   * Get FFE instance for a room
   */
  async getRoomFFEInstance(roomId: string): Promise<RoomFFEInstanceWithRelations | null> {
    return prisma.roomFFEInstance.findUnique({
      where: { roomId },
      include: {
        room: {
          include: {
            project: {
              select: { id: true, name: true, orgId: true }
            }
          }
        },
        template: {
          select: { id: true, name: true, roomType: true }
        },
        sections: {
          orderBy: { order: 'asc' },
          include: {
            items: {
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    }) as Promise<RoomFFEInstanceWithRelations | null>
  }

  /**
   * Create FFE instance for a room
   */
  async createRoomFFEInstance(data: CreateRoomFFEInstanceData, userId: string): Promise<RoomFFEInstanceWithRelations> {
    return prisma.$transaction(async (tx) => {
      // Get room details
      const room = await tx.room.findUnique({
        where: { id: data.roomId },
        include: {
          project: { select: { orgId: true } }
        }
      })

      if (!room) {
        throw new Error('Room not found')
      }

      let sectionsData: any[] = []

      // If template is specified, copy from template
      if (data.templateId) {
        const template = await ffeTemplateService.getTemplate(data.templateId, room.project.orgId)
        if (!template) {
          throw new Error('Template not found')
        }

        sectionsData = template.sections.map(section => ({
          templateSectionId: section.id,
          name: section.name,
          description: section.description,
          order: section.order,
          isExpanded: true,
          isCompleted: false,
          items: {
            create: section.items.map(item => ({
              templateItemId: item.id,
              name: item.name,
              description: item.description,
              state: item.defaultState,
              isRequired: item.isRequired,
              isCustom: false,
              order: item.order,
              quantity: 1,
              unitCost: item.estimatedCost,
              totalCost: item.estimatedCost,
              createdById: userId,
              updatedById: userId
            }))
          }
        }))
      }

      // Create the room FFE instance
      const instance = await tx.roomFFEInstance.create({
        data: {
          roomId: data.roomId,
          templateId: data.templateId,
          name: data.name,
          status: 'NOT_STARTED',
          progress: 0,
          estimatedBudget: data.estimatedBudget,
          targetCompletionDate: data.targetCompletionDate,
          notes: data.notes,
          metadata: data.metadata,
          createdById: userId,
          updatedById: userId,
          sections: {
            create: sectionsData
          }
        },
        include: {
          room: {
            include: {
              project: {
                select: { id: true, name: true, orgId: true }
              }
            }
          },
          template: {
            select: { id: true, name: true, roomType: true }
          },
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
        entityType: 'instance',
        entityId: instance.id,
        action: 'created',
        userId,
        orgId: room.project.orgId,
        roomId: data.roomId,
        instanceId: instance.id,
        metadata: { 
          instanceName: data.name, 
          templateId: data.templateId,
          roomType: room.type 
        }
      })

      return instance as RoomFFEInstanceWithRelations
    })
  }

  /**
   * Update FFE instance
   */
  async updateRoomFFEInstance(instanceId: string, data: UpdateRoomFFEInstanceData, userId: string): Promise<RoomFFEInstanceWithRelations> {
    return prisma.$transaction(async (tx) => {
      // Get current instance for logging
      const oldInstance = await tx.roomFFEInstance.findUnique({
        where: { id: instanceId },
        include: {
          room: { include: { project: true } }
        }
      })

      if (!oldInstance) {
        throw new Error('FFE instance not found')
      }

      const updatedInstance = await tx.roomFFEInstance.update({
        where: { id: instanceId },
        data: {
          ...data,
          updatedById: userId
        },
        include: {
          room: {
            include: {
              project: {
                select: { id: true, name: true, orgId: true }
              }
            }
          },
          template: {
            select: { id: true, name: true, roomType: true }
          },
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
        .filter(([key, value]) => oldInstance[key as keyof typeof oldInstance] !== value)
        .map(([key, value]) => ({
          fieldName: key,
          oldValue: String(oldInstance[key as keyof typeof oldInstance] || ''),
          newValue: String(value || '')
        }))

      for (const change of changes) {
        await this.logChange({
          entityType: 'instance',
          entityId: instanceId,
          action: 'updated',
          fieldName: change.fieldName,
          oldValue: change.oldValue,
          newValue: change.newValue,
          userId,
          orgId: updatedInstance.room.project.orgId,
          roomId: updatedInstance.roomId,
          instanceId
        })
      }

      return updatedInstance as RoomFFEInstanceWithRelations
    })
  }

  /**
   * Update FFE item state/details
   */
  async updateRoomFFEItem(itemId: string, data: UpdateRoomFFEItemData, userId: string): Promise<void> {
    return prisma.$transaction(async (tx) => {
      // Get current item for logging
      const oldItem = await tx.roomFFEItem.findUnique({
        where: { id: itemId },
        include: {
          section: {
            include: {
              instance: {
                include: {
                  room: { include: { project: true } }
                }
              }
            }
          }
        }
      })

      if (!oldItem) {
        throw new Error('FFE item not found')
      }

      // Update the item
      await tx.roomFFEItem.update({
        where: { id: itemId },
        data: {
          ...data,
          completedAt: data.state === 'COMPLETED' ? new Date() : null,
          completedById: data.state === 'COMPLETED' ? userId : null,
          updatedById: userId
        }
      })

      // Recalculate progress for the instance
      await this.updateInstanceProgress(oldItem.section.instanceId, tx)

      // Log changes
      const changes = Object.entries(data)
        .filter(([key, value]) => oldItem[key as keyof typeof oldItem] !== value)

      for (const [key, value] of changes) {
        await this.logChange({
          entityType: 'item',
          entityId: itemId,
          action: 'updated',
          fieldName: key,
          oldValue: String(oldItem[key as keyof typeof oldItem] || ''),
          newValue: String(value || ''),
          userId,
          orgId: oldItem.section.instance.room.project.orgId,
          roomId: oldItem.section.instance.roomId,
          instanceId: oldItem.section.instanceId
        })
      }
    })
  }

  /**
   * Add custom item to a section
   */
  async addCustomItemToSection(sectionId: string, itemData: {
    name: string
    description?: string
    isRequired?: boolean
    order?: number
    quantity?: number
    unitCost?: number
    category?: string
    notes?: string
  }, userId: string) {
    return prisma.$transaction(async (tx) => {
      // Get section details
      const section = await tx.roomFFESection.findUnique({
        where: { id: sectionId },
        include: {
          instance: {
            include: {
              room: { include: { project: true } }
            }
          }
        }
      })

      if (!section) {
        throw new Error('Section not found')
      }

      // Get next order number if not specified
      const order = itemData.order ?? await tx.roomFFEItem.count({
        where: { sectionId }
      }) + 1

      // Create the custom item
      const item = await tx.roomFFEItem.create({
        data: {
          sectionId,
          name: itemData.name,
          description: itemData.description,
          state: 'PENDING',
          isRequired: itemData.isRequired || false,
          isCustom: true,
          order,
          quantity: itemData.quantity || 1,
          unitCost: itemData.unitCost,
          totalCost: itemData.unitCost ? itemData.unitCost * (itemData.quantity || 1) : null,
          category: itemData.category,
          notes: itemData.notes,
          createdById: userId,
          updatedById: userId
        }
      })

      // Recalculate progress
      await this.updateInstanceProgress(section.instanceId, tx)

      // Log the addition
      await this.logChange({
        entityType: 'item',
        entityId: item.id,
        action: 'created',
        userId,
        orgId: section.instance.room.project.orgId,
        roomId: section.instance.roomId,
        instanceId: section.instanceId,
        metadata: { itemName: itemData.name, isCustom: true }
      })

      return item
    })
  }

  /**
   * Add custom section to instance
   */
  async addCustomSectionToInstance(instanceId: string, sectionData: {
    name: string
    description?: string
    order?: number
    icon?: string
    color?: string
  }, userId: string) {
    return prisma.$transaction(async (tx) => {
      // Get instance details
      const instance = await tx.roomFFEInstance.findUnique({
        where: { id: instanceId },
        include: {
          room: { include: { project: true } }
        }
      })

      if (!instance) {
        throw new Error('FFE instance not found')
      }

      // Get next order number if not specified
      const order = sectionData.order ?? await tx.roomFFESection.count({
        where: { instanceId }
      }) + 1

      // Create the custom section
      const section = await tx.roomFFESection.create({
        data: {
          instanceId,
          name: sectionData.name,
          description: sectionData.description,
          order,
          isExpanded: true,
          isCompleted: false
        }
      })

      // Log the addition
      await this.logChange({
        entityType: 'section',
        entityId: section.id,
        action: 'created',
        userId,
        orgId: instance.room.project.orgId,
        roomId: instance.roomId,
        instanceId,
        metadata: { sectionName: sectionData.name, isCustom: true }
      })

      return section
    })
  }

  /**
   * Calculate and update instance progress
   */
  private async updateInstanceProgress(instanceId: string, tx?: any) {
    const client = tx || prisma

    // Get all items for this instance
    const sections = await client.roomFFESection.findMany({
      where: { instanceId },
      include: {
        items: true
      }
    })

    const allItems = sections.flatMap(section => section.items)
    const totalItems = allItems.length

    if (totalItems === 0) {
      await client.roomFFEInstance.update({
        where: { id: instanceId },
        data: { progress: 0, status: 'NOT_STARTED' }
      })
      return
    }

    // Calculate progress based on item states
    const completedItems = allItems.filter(item => 
      item.state === 'COMPLETED' || item.state === 'NOT_NEEDED'
    ).length

    const inProgressItems = allItems.filter(item => 
      item.state === 'CONFIRMED' || item.state === 'SELECTED'
    ).length

    const progress = Math.round((completedItems / totalItems) * 100)

    // Determine status
    let status: FFEInstanceStatus = 'NOT_STARTED'
    if (progress === 100) {
      status = 'COMPLETED'
    } else if (inProgressItems > 0 || completedItems > 0) {
      status = 'IN_PROGRESS'
    }

    // Update the instance
    await client.roomFFEInstance.update({
      where: { id: instanceId },
      data: { 
        progress,
        status,
        actualCompletionDate: status === 'COMPLETED' ? new Date() : null
      }
    })
  }

  /**
   * Get FFE progress summary for multiple rooms
   */
  async getFFEProgressSummary(roomIds: string[]) {
    const instances = await prisma.roomFFEInstance.findMany({
      where: {
        roomId: { in: roomIds }
      },
      select: {
        id: true,
        roomId: true,
        status: true,
        progress: true,
        estimatedBudget: true,
        actualBudget: true,
        room: {
          select: { id: true, name: true, type: true }
        }
      }
    })

    return instances.map(instance => ({
      roomId: instance.roomId,
      roomName: instance.room.name,
      roomType: instance.room.type,
      status: instance.status,
      progress: instance.progress,
      estimatedBudget: instance.estimatedBudget,
      actualBudget: instance.actualBudget
    }))
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
export const ffeRoomService = new FFERoomService()
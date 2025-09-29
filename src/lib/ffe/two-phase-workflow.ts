// Two-Phase FFE Workflow System
// Phase 1: Selection (pick what categories/items belong in this room)
// Phase 2: Completion (mark status: ✅ Chosen, ⏳ Pending, 🚫 Not Needed)

import { getRoomLibrary, type FFELibraryItem, type FFEItemLogicRule, type FFESubItem } from './room-library-system'

export type SelectionPhaseStatus = 'not_selected' | 'selected'
export type CompletionPhaseStatus = 'chosen' | 'pending' | 'not_needed'
export type FFEWorkflowPhase = 'selection' | 'completion'

// Selection Phase: What items are part of this room?
export interface SelectionPhaseItem {
  itemId: string
  name: string
  category: string
  isRequired: boolean
  status: SelectionPhaseStatus // selected = will appear in completion phase
  order: number
}

// Completion Phase: What's the status of each selected item?
export interface CompletionPhaseItem {
  itemId: string
  name: string
  category: string
  isRequired: boolean
  status: CompletionPhaseStatus
  selectionType?: 'standard' | 'custom' // User's choice for items with logic rules
  standardSelection?: string // Selected standard option
  customDetails?: Record<string, any> // Custom sub-item values
  expandedSubItems?: ExpandedSubItem[] // Generated from logic rules
  notes?: string
  order: number
}

export interface ExpandedSubItem {
  id: string
  name: string
  type: 'selection' | 'input' | 'checkbox' | 'color'
  options?: string[]
  isRequired: boolean
  value?: any // User's input/selection
  placeholder?: string
}

// Room workflow state
export interface RoomFFEWorkflow {
  roomId: string
  roomType: string
  currentPhase: FFEWorkflowPhase
  selectionPhase: {
    items: SelectionPhaseItem[]
    isComplete: boolean
    completedAt?: Date
  }
  completionPhase: {
    items: CompletionPhaseItem[]
    isComplete: boolean
    completedAt?: Date
  }
  adHocItems: CompletionPhaseItem[] // Custom items added during selection phase
  createdAt: Date
  updatedAt: Date
}

export class FFETwoPhaseWorkflow {
  private roomId: string
  private roomType: string
  
  constructor(roomId: string, roomType: string) {
    this.roomId = roomId
    this.roomType = roomType
  }

  // ============ INITIALIZATION ============
  async initializeWorkflow(): Promise<RoomFFEWorkflow> {
    try {
      const library = getRoomLibrary(this.roomType)
      if (!library) {
        throw new Error(`No library found for room type: ${this.roomType}`)
      }

      // Create selection phase items from library
      const selectionItems: SelectionPhaseItem[] = []
      
      library.categories.forEach(category => {
        category.items.forEach(item => {
          selectionItems.push({
            itemId: item.id,
            name: item.name,
            category: category.name,
            isRequired: item.isRequired,
            status: item.isRequired ? 'selected' : 'not_selected', // Auto-select required items
            order: item.order
          })
        })
      })

      const workflow: RoomFFEWorkflow = {
        roomId: this.roomId,
        roomType: this.roomType,
        currentPhase: 'selection',
        selectionPhase: {
          items: selectionItems.sort((a, b) => a.order - b.order),
          isComplete: false
        },
        completionPhase: {
          items: [],
          isComplete: false
        },
        adHocItems: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      return workflow
    } catch (error) {
      console.error('Error initializing FFE workflow:', error)
      throw error
    }
  }

  // ============ SELECTION PHASE ============
  async updateSelectionPhaseItem(
    workflow: RoomFFEWorkflow,
    itemId: string,
    status: SelectionPhaseStatus
  ): Promise<RoomFFEWorkflow> {
    try {
      const updatedItems = workflow.selectionPhase.items.map(item =>
        item.itemId === itemId ? { ...item, status } : item
      )

      return {
        ...workflow,
        selectionPhase: {
          ...workflow.selectionPhase,
          items: updatedItems
        },
        updatedAt: new Date()
      }
    } catch (error) {
      console.error('Error updating selection phase item:', error)
      throw error
    }
  }

  async addAdHocItem(
    workflow: RoomFFEWorkflow,
    name: string,
    category: string
  ): Promise<RoomFFEWorkflow> {
    try {
      const newAdHocItem: CompletionPhaseItem = {
        itemId: `adhoc_${Date.now()}`,
        name,
        category,
        isRequired: false,
        status: 'pending',
        order: workflow.adHocItems.length + 1000 // Appear after library items
      }

      return {
        ...workflow,
        adHocItems: [...workflow.adHocItems, newAdHocItem],
        updatedAt: new Date()
      }
    } catch (error) {
      console.error('Error adding ad-hoc item:', error)
      throw error
    }
  }

  async completeSelectionPhase(workflow: RoomFFEWorkflow): Promise<RoomFFEWorkflow> {
    try {
      // Move selected items to completion phase
      const selectedItems = workflow.selectionPhase.items.filter(item => item.status === 'selected')
      
      const completionItems: CompletionPhaseItem[] = selectedItems.map(item => ({
        itemId: item.itemId,
        name: item.name,
        category: item.category,
        isRequired: item.isRequired,
        status: 'pending', // Default status in completion phase
        order: item.order
      }))

      return {
        ...workflow,
        currentPhase: 'completion',
        selectionPhase: {
          ...workflow.selectionPhase,
          isComplete: true,
          completedAt: new Date()
        },
        completionPhase: {
          items: completionItems,
          isComplete: false
        },
        updatedAt: new Date()
      }
    } catch (error) {
      console.error('Error completing selection phase:', error)
      throw error
    }
  }

  // ============ COMPLETION PHASE ============
  async updateCompletionPhaseItemStatus(
    workflow: RoomFFEWorkflow,
    itemId: string,
    status: CompletionPhaseStatus,
    notes?: string
  ): Promise<RoomFFEWorkflow> {
    try {
      // Update in main items
      const updatedItems = workflow.completionPhase.items.map(item =>
        item.itemId === itemId 
          ? { ...item, status, notes, updatedAt: new Date() } 
          : item
      )

      // Update in ad-hoc items
      const updatedAdHocItems = workflow.adHocItems.map(item =>
        item.itemId === itemId 
          ? { ...item, status, notes, updatedAt: new Date() } 
          : item
      )

      return {
        ...workflow,
        completionPhase: {
          ...workflow.completionPhase,
          items: updatedItems
        },
        adHocItems: updatedAdHocItems,
        updatedAt: new Date()
      }
    } catch (error) {
      console.error('Error updating completion phase item status:', error)
      throw error
    }
  }

  async setItemSelectionType(
    workflow: RoomFFEWorkflow,
    itemId: string,
    selectionType: 'standard' | 'custom'
  ): Promise<RoomFFEWorkflow> {
    try {
      // Get item's logic rules from library
      const library = getRoomLibrary(this.roomType)
      if (!library) throw new Error('Library not found')

      let item: FFELibraryItem | undefined
      let logicRules: FFEItemLogicRule[] = []

      // Find the item and its logic rules
      for (const category of library.categories) {
        item = category.items.find(i => i.id === itemId)
        if (item) {
          logicRules = item.logicRules || []
          break
        }
      }

      if (!item) throw new Error('Item not found in library')

      // Find the logic rule for this selection type
      const rule = logicRules.find(r => r.trigger === selectionType)
      if (!rule) throw new Error('Logic rule not found for selection type')

      // Generate expanded sub-items
      const expandedSubItems: ExpandedSubItem[] = rule.expandsTo.map(subItem => ({
        id: subItem.id,
        name: subItem.name,
        type: subItem.type,
        options: subItem.options,
        isRequired: subItem.isRequired,
        placeholder: subItem.placeholder,
        value: undefined
      }))

      // Update the item in completion phase
      const updatedItems = workflow.completionPhase.items.map(workflowItem =>
        workflowItem.itemId === itemId 
          ? { 
              ...workflowItem, 
              selectionType, 
              expandedSubItems,
              // Clear previous selections when switching types
              standardSelection: undefined,
              customDetails: undefined
            } 
          : workflowItem
      )

      return {
        ...workflow,
        completionPhase: {
          ...workflow.completionPhase,
          items: updatedItems
        },
        updatedAt: new Date()
      }
    } catch (error) {
      console.error('Error setting item selection type:', error)
      throw error
    }
  }

  async updateStandardSelection(
    workflow: RoomFFEWorkflow,
    itemId: string,
    selection: string
  ): Promise<RoomFFEWorkflow> {
    try {
      const updatedItems = workflow.completionPhase.items.map(item =>
        item.itemId === itemId 
          ? { ...item, standardSelection: selection } 
          : item
      )

      return {
        ...workflow,
        completionPhase: {
          ...workflow.completionPhase,
          items: updatedItems
        },
        updatedAt: new Date()
      }
    } catch (error) {
      console.error('Error updating standard selection:', error)
      throw error
    }
  }

  async updateCustomDetails(
    workflow: RoomFFEWorkflow,
    itemId: string,
    subItemId: string,
    value: any
  ): Promise<RoomFFEWorkflow> {
    try {
      const updatedItems = workflow.completionPhase.items.map(item => {
        if (item.itemId === itemId && item.expandedSubItems) {
          const updatedSubItems = item.expandedSubItems.map(subItem =>
            subItem.id === subItemId ? { ...subItem, value } : subItem
          )
          return { ...item, expandedSubItems: updatedSubItems }
        }
        return item
      })

      return {
        ...workflow,
        completionPhase: {
          ...workflow.completionPhase,
          items: updatedItems
        },
        updatedAt: new Date()
      }
    } catch (error) {
      console.error('Error updating custom details:', error)
      throw error
    }
  }

  async checkCompletionPhaseComplete(workflow: RoomFFEWorkflow): Promise<boolean> {
    try {
      // Check all required items have been addressed (chosen or not_needed)
      const allItems = [...workflow.completionPhase.items, ...workflow.adHocItems]
      const requiredItems = allItems.filter(item => item.isRequired)
      
      const incompleteRequired = requiredItems.filter(item => item.status === 'pending')
      
      return incompleteRequired.length === 0
    } catch (error) {
      console.error('Error checking completion phase status:', error)
      return false
    }
  }

  async completeCompletionPhase(workflow: RoomFFEWorkflow): Promise<RoomFFEWorkflow> {
    try {
      const isComplete = await this.checkCompletionPhaseComplete(workflow)
      
      if (!isComplete) {
        throw new Error('Cannot complete phase: Required items are still pending')
      }

      return {
        ...workflow,
        completionPhase: {
          ...workflow.completionPhase,
          isComplete: true,
          completedAt: new Date()
        },
        updatedAt: new Date()
      }
    } catch (error) {
      console.error('Error completing completion phase:', error)
      throw error
    }
  }

  // ============ NAVIGATION ============
  async goBackToSelectionPhase(workflow: RoomFFEWorkflow): Promise<RoomFFEWorkflow> {
    try {
      return {
        ...workflow,
        currentPhase: 'selection',
        selectionPhase: {
          ...workflow.selectionPhase,
          isComplete: false,
          completedAt: undefined
        },
        completionPhase: {
          items: [],
          isComplete: false,
          completedAt: undefined
        },
        updatedAt: new Date()
      }
    } catch (error) {
      console.error('Error going back to selection phase:', error)
      throw error
    }
  }

  // ============ PROGRESS TRACKING ============
  getWorkflowProgress(workflow: RoomFFEWorkflow): {
    phase: FFEWorkflowPhase
    selectionProgress: {
      total: number
      selected: number
      percentComplete: number
    }
    completionProgress: {
      total: number
      chosen: number
      pending: number
      notNeeded: number
      percentComplete: number
    }
    overallProgress: number
  } {
    try {
      // Selection phase progress
      const totalSelectionItems = workflow.selectionPhase.items.length
      const selectedItems = workflow.selectionPhase.items.filter(item => item.status === 'selected').length
      const selectionPercent = totalSelectionItems > 0 ? (selectedItems / totalSelectionItems) * 100 : 0

      // Completion phase progress
      const allCompletionItems = [...workflow.completionPhase.items, ...workflow.adHocItems]
      const chosenItems = allCompletionItems.filter(item => item.status === 'chosen').length
      const pendingItems = allCompletionItems.filter(item => item.status === 'pending').length
      const notNeededItems = allCompletionItems.filter(item => item.status === 'not_needed').length
      const completionPercent = allCompletionItems.length > 0 
        ? ((chosenItems + notNeededItems) / allCompletionItems.length) * 100 
        : 0

      // Overall progress
      let overallProgress = 0
      if (workflow.currentPhase === 'selection') {
        overallProgress = selectionPercent * 0.3 // Selection phase is 30% of overall
      } else {
        overallProgress = 30 + (completionPercent * 0.7) // Completion phase is 70% of overall
      }

      return {
        phase: workflow.currentPhase,
        selectionProgress: {
          total: totalSelectionItems,
          selected: selectedItems,
          percentComplete: selectionPercent
        },
        completionProgress: {
          total: allCompletionItems.length,
          chosen: chosenItems,
          pending: pendingItems,
          notNeeded: notNeededItems,
          percentComplete: completionPercent
        },
        overallProgress
      }
    } catch (error) {
      console.error('Error calculating workflow progress:', error)
      return {
        phase: workflow.currentPhase,
        selectionProgress: { total: 0, selected: 0, percentComplete: 0 },
        completionProgress: { total: 0, chosen: 0, pending: 0, notNeeded: 0, percentComplete: 0 },
        overallProgress: 0
      }
    }
  }
}

// Factory function
export function createFFETwoPhaseWorkflow(roomId: string, roomType: string): FFETwoPhaseWorkflow {
  return new FFETwoPhaseWorkflow(roomId, roomType)
}

// Utility functions for UI
export function getPhaseDisplayName(phase: FFEWorkflowPhase): string {
  return phase === 'selection' ? 'Selection Phase' : 'Completion Phase'
}

export function getStatusDisplayName(status: CompletionPhaseStatus): string {
  switch (status) {
    case 'chosen': return '✅ Chosen'
    case 'pending': return '⏳ Pending'
    case 'not_needed': return '🚫 Not Needed'
  }
}

export function getStatusColor(status: CompletionPhaseStatus): string {
  switch (status) {
    case 'chosen': return 'green'
    case 'pending': return 'yellow'
    case 'not_needed': return 'gray'
  }
}
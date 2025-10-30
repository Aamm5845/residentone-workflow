import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { RoomType, FFEItemState, FFEInstanceStatus } from '@prisma/client'

export interface RoomFFEItem {
  id: string
  sectionId: string
  templateItemId?: string
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
}

export interface RoomFFESection {
  id: string
  instanceId: string
  templateSectionId?: string
  name: string
  description?: string
  order: number
  isExpanded: boolean
  isCompleted: boolean
  completedAt?: Date
  notes?: string
  items: RoomFFEItem[]
}

export interface RoomFFEInstance {
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
    roomType: RoomType
  }
  sections: RoomFFESection[]
}

interface FFERoomState {
  // Current room instance
  currentInstance: RoomFFEInstance | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
  
  // UI State
  expandedSections: Set<string>
  selectedItems: Set<string>
  showNotesDrawer: boolean
  showTemplateSelector: boolean
  currentPhase: 'setup' | 'execution'
  
  // Template selection
  availableTemplates: Array<{
    id: string
    name: string
    roomType: RoomType
    sections: Array<{ id: string; name: string }>
    isDefault: boolean
  }>
  
  // Actions
  setCurrentInstance: (instance: RoomFFEInstance | null) => void
  setLoading: (loading: boolean) => void
  setSaving: (saving: boolean) => void
  setError: (error: string | null) => void
  
  // UI Actions
  toggleSectionExpanded: (sectionId: string) => void
  toggleItemSelected: (itemId: string) => void
  setShowNotesDrawer: (show: boolean) => void
  setShowTemplateSelector: (show: boolean) => void
  setCurrentPhase: (phase: 'setup' | 'execution') => void
  setAvailableTemplates: (templates: FFERoomState['availableTemplates']) => void
  
  // Instance operations
  updateInstance: (updates: Partial<RoomFFEInstance>) => void
  
  // Section operations
  addSection: (section: Omit<RoomFFESection, 'id' | 'instanceId'>) => void
  updateSection: (sectionId: string, updates: Partial<RoomFFESection>) => void
  removeSection: (sectionId: string) => void
  toggleSectionCompleted: (sectionId: string) => void
  
  // Item operations
  addItem: (sectionId: string, item: Omit<RoomFFEItem, 'id' | 'sectionId'>) => void
  updateItem: (itemId: string, updates: Partial<RoomFFEItem>) => void
  removeItem: (itemId: string) => void
  updateItemState: (itemId: string, state: FFEItemState, notes?: string) => void
  bulkUpdateItemStates: (itemIds: string[], state: FFEItemState) => void
  
  // Progress and statistics
  getOverallProgress: () => number
  getSectionProgress: (sectionId: string) => { completed: number; total: number; percentage: number }
  getItemsByState: (state: FFEItemState) => RoomFFEItem[]
  getAllNotes: () => Array<{ itemId: string; itemName: string; notes: string; sectionName: string }>
  getCompletionStats: () => {
    total: number
    undecided: number
    completed: number
    pending: number
    selected: number
    confirmed: number
    notNeeded: number
  }
  
  // Utility
  findItemById: (itemId: string) => RoomFFEItem | null
  findSectionById: (sectionId: string) => RoomFFESection | null
  getSectionByItemId: (itemId: string) => RoomFFESection | null
  resetState: () => void
}

const initialState = {
  currentInstance: null,
  isLoading: false,
  isSaving: false,
  error: null,
  expandedSections: new Set<string>(),
  selectedItems: new Set<string>(),
  showNotesDrawer: false,
  showTemplateSelector: false,
  currentPhase: 'setup' as const,
  availableTemplates: []
}

export const useFFERoomStore = create<FFERoomState>()(
  devtools(
    (set, get) => ({
      ...initialState,
      
      // Basic setters
      setCurrentInstance: (currentInstance) => {
        set({ currentInstance })
        // Auto-expand sections on load
        if (currentInstance) {
          const expandedSections = new Set(currentInstance.sections.map(s => s.id))
          set({ expandedSections })
        }
      },
      setLoading: (isLoading) => set({ isLoading }),
      setSaving: (isSaving) => set({ isSaving }),
      setError: (error) => set({ error }),
      
      // UI actions
      toggleSectionExpanded: (sectionId) => set((state) => {
        const newExpanded = new Set(state.expandedSections)
        if (newExpanded.has(sectionId)) {
          newExpanded.delete(sectionId)
        } else {
          newExpanded.add(sectionId)
        }
        return { expandedSections: newExpanded }
      }),
      
      toggleItemSelected: (itemId) => set((state) => {
        const newSelected = new Set(state.selectedItems)
        if (newSelected.has(itemId)) {
          newSelected.delete(itemId)
        } else {
          newSelected.add(itemId)
        }
        return { selectedItems: newSelected }
      }),
      
      setShowNotesDrawer: (showNotesDrawer) => set({ showNotesDrawer }),
      setShowTemplateSelector: (showTemplateSelector) => set({ showTemplateSelector }),
      setCurrentPhase: (currentPhase) => set({ currentPhase }),
      setAvailableTemplates: (availableTemplates) => set({ availableTemplates }),
      
      // Instance operations
      updateInstance: (updates) => set((state) => ({
        currentInstance: state.currentInstance ? {
          ...state.currentInstance,
          ...updates
        } : null
      })),
      
      // Section operations
      addSection: (sectionData) => {
        const newSection: RoomFFESection = {
          ...sectionData,
          id: `temp-section-${Date.now()}`,
          instanceId: get().currentInstance?.id || '',
          items: []
        }
        
        set((state) => ({
          currentInstance: state.currentInstance ? {
            ...state.currentInstance,
            sections: [...state.currentInstance.sections, newSection].sort((a, b) => a.order - b.order)
          } : null
        }))
      },
      
      updateSection: (sectionId, updates) => set((state) => ({
        currentInstance: state.currentInstance ? {
          ...state.currentInstance,
          sections: state.currentInstance.sections.map(section =>
            section.id === sectionId ? { ...section, ...updates } : section
          )
        } : null
      })),
      
      removeSection: (sectionId) => set((state) => ({
        currentInstance: state.currentInstance ? {
          ...state.currentInstance,
          sections: state.currentInstance.sections.filter(section => section.id !== sectionId)
        } : null,
        expandedSections: new Set([...state.expandedSections].filter(id => id !== sectionId))
      })),
      
      toggleSectionCompleted: (sectionId) => set((state) => {
        if (!state.currentInstance) return state
        
        const section = state.currentInstance.sections.find(s => s.id === sectionId)
        if (!section) return state
        
        const isCompleted = !section.isCompleted
        const completedAt = isCompleted ? new Date() : undefined
        
        return {
          currentInstance: {
            ...state.currentInstance,
            sections: state.currentInstance.sections.map(s =>
              s.id === sectionId 
                ? { ...s, isCompleted, completedAt }
                : s
            )
          }
        }
      }),
      
      // Item operations
      addItem: (sectionId, itemData) => {
        const newItem: RoomFFEItem = {
          ...itemData,
          id: `temp-item-${Date.now()}`,
          sectionId
        }
        
        set((state) => ({
          currentInstance: state.currentInstance ? {
            ...state.currentInstance,
            sections: state.currentInstance.sections.map(section =>
              section.id === sectionId
                ? {
                    ...section,
                    items: [...section.items, newItem].sort((a, b) => a.order - b.order)
                  }
                : section
            )
          } : null
        }))
      },
      
      updateItem: (itemId, updates) => set((state) => ({
        currentInstance: state.currentInstance ? {
          ...state.currentInstance,
          sections: state.currentInstance.sections.map(section => ({
            ...section,
            items: section.items.map(item =>
              item.id === itemId 
                ? { 
                    ...item, 
                    ...updates,
                    completedAt: updates.state === 'COMPLETED' ? new Date() : item.completedAt
                  } 
                : item
            )
          }))
        } : null
      })),
      
      removeItem: (itemId) => set((state) => ({
        currentInstance: state.currentInstance ? {
          ...state.currentInstance,
          sections: state.currentInstance.sections.map(section => ({
            ...section,
            items: section.items.filter(item => item.id !== itemId)
          }))
        } : null,
        selectedItems: new Set([...state.selectedItems].filter(id => id !== itemId))
      })),
      
      updateItemState: (itemId, state, notes) => {
        const updates: Partial<RoomFFEItem> = { state }
        if (notes !== undefined) {
          updates.notes = notes
        }
        get().updateItem(itemId, updates)
      },
      
      bulkUpdateItemStates: (itemIds, state) => {
        const { updateItem } = get()
        itemIds.forEach(itemId => {
          updateItem(itemId, { state })
        })
      },
      
      // Progress and statistics
      getOverallProgress: () => {
        const state = get()
        if (!state.currentInstance) return 0
        
        const allItems = state.currentInstance.sections.flatMap(s => s.items)
        const totalItems = allItems.length
        
        if (totalItems === 0) return 0
        
        // Only COMPLETED items count as finished - everything else is undecided
        const completedItems = allItems.filter(item => 
          item.state === 'COMPLETED'
        ).length
        
        return Math.round((completedItems / totalItems) * 100)
      },
      
      getSectionProgress: (sectionId) => {
        const state = get()
        if (!state.currentInstance) return { completed: 0, total: 0, percentage: 0 }
        
        const section = state.currentInstance.sections.find(s => s.id === sectionId)
        if (!section) return { completed: 0, total: 0, percentage: 0 }
        
        const total = section.items.length
        // Only COMPLETED items count as finished - everything else is undecided
        const completed = section.items.filter(item => 
          item.state === 'COMPLETED'
        ).length
        
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
        
        return { completed, total, percentage }
      },
      
      getItemsByState: (targetState) => {
        const state = get()
        if (!state.currentInstance) return []
        
        return state.currentInstance.sections.flatMap(s => 
          s.items.filter(item => item.state === targetState)
        )
      },
      
      getAllNotes: () => {
        const state = get()
        if (!state.currentInstance) return []
        
        const notes: Array<{ itemId: string; itemName: string; notes: string; sectionName: string }> = []
        
        state.currentInstance.sections.forEach(section => {
          section.items.forEach(item => {
            if (item.notes?.trim()) {
              notes.push({
                itemId: item.id,
                itemName: item.name,
                notes: item.notes,
                sectionName: section.name
              })
            }
          })
        })
        
        return notes
      },
      
      getCompletionStats: () => {
        const state = get()
        if (!state.currentInstance) {
          return { total: 0, undecided: 0, completed: 0, pending: 0, selected: 0, confirmed: 0, notNeeded: 0 }
        }
        
        const allItems = state.currentInstance.sections.flatMap(s => s.items)
        const completed = allItems.filter(i => i.state === 'COMPLETED').length
        const pending = allItems.filter(i => i.state === 'PENDING').length
        // Undecided includes UNDECIDED state and legacy states (SELECTED, CONFIRMED)
        const undecided = allItems.filter(i => 
          i.state === 'UNDECIDED' || i.state === 'SELECTED' || i.state === 'CONFIRMED'
        ).length
        
        return {
          total: allItems.length,
          undecided,
          completed,
          // Legacy counts for backward compatibility
          pending,
          selected: allItems.filter(i => i.state === 'SELECTED').length,
          confirmed: allItems.filter(i => i.state === 'CONFIRMED').length,
          notNeeded: allItems.filter(i => i.state === 'NOT_NEEDED').length
        }
      },
      
      // Utility functions
      findItemById: (itemId) => {
        const state = get()
        if (!state.currentInstance) return null
        
        for (const section of state.currentInstance.sections) {
          const item = section.items.find(i => i.id === itemId)
          if (item) return item
        }
        return null
      },
      
      findSectionById: (sectionId) => {
        const state = get()
        if (!state.currentInstance) return null
        
        return state.currentInstance.sections.find(s => s.id === sectionId) || null
      },
      
      getSectionByItemId: (itemId) => {
        const state = get()
        if (!state.currentInstance) return null
        
        return state.currentInstance.sections.find(section =>
          section.items.some(item => item.id === itemId)
        ) || null
      },
      
      resetState: () => set(initialState)
    }),
    {
      name: 'ffe-room-store'
    }
  )
)

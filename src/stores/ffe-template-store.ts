import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { FFETemplateStatus } from '@prisma/client'

export interface FFETemplate {
  id: string
  orgId: string
  name: string
  description?: string
  status: FFETemplateStatus
  isDefault: boolean
  version: number
  tags: string[]
  metadata?: any
  createdAt: Date
  updatedAt: Date
  sections: FFETemplateSection[]
}

export interface FFETemplateSection {
  id: string
  templateId: string
  name: string
  description?: string
  order: number
  isRequired: boolean
  isCollapsible: boolean
  icon?: string
  color?: string
  items: FFETemplateItem[]
}

export interface FFETemplateItem {
  id: string
  sectionId: string
  name: string
  description?: string
  defaultState: 'PENDING' | 'SELECTED' | 'CONFIRMED' | 'NOT_NEEDED' | 'COMPLETED'
  isRequired: boolean
  order: number
  category?: string
  tags: string[]
  estimatedCost?: number
  leadTimeWeeks?: number
  supplierInfo?: any
  customFields?: any
}

export interface FFESectionLibraryItem {
  id: string
  name: string
  description?: string
  icon?: string
  color?: string
  defaultOrder: number
  applicableRoomTypes: string[]
  isGlobal: boolean
}

interface FFETemplateState {
  // Templates
  templates: FFETemplate[]
  selectedTemplate: FFETemplate | null
  selectedTemplates: string[] // for bulk operations
  isLoading: boolean
  error: string | null
  sections: FFESectionLibraryItem[] // Add sections to the state
  
  // Filters
  filters: {
    searchQuery: string
  }
  
  // Section Library
  sectionLibrary: FFESectionLibraryItem[]
  
  // UI State
  isTemplateEditorOpen: boolean
  isCreatingTemplate: boolean
  draggedItem: {
    type: 'section' | 'item'
    id: string
    sourceIndex: number
  } | null
  
  // Actions
  setTemplates: (templates: FFETemplate[]) => void
  setSelectedTemplate: (template: FFETemplate | null) => void
  setSelectedTemplates: (templates: string[]) => void
  clearSelectedTemplates: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setFilters: (filters: Partial<FFETemplateState['filters']>) => void
  setSectionLibrary: (library: FFESectionLibraryItem[]) => void
  
  // UI Actions
  setTemplateEditorOpen: (open: boolean) => void
  setCreatingTemplate: (creating: boolean) => void
  setDraggedItem: (item: FFETemplateState['draggedItem']) => void
  
  // Template Operations
  addTemplate: (template: FFETemplate) => void
  updateTemplate: (template: FFETemplate) => void
  removeTemplate: (templateId: string) => void
  
  // Section Operations
  addSection: (templateId: string, section: Omit<FFETemplateSection, 'id' | 'templateId'>) => void
  updateSection: (sectionId: string, updates: Partial<FFETemplateSection>) => void
  removeSection: (sectionId: string) => void
  reorderSections: (templateId: string, sectionIds: string[]) => void
  
  // Item Operations
  addItem: (sectionId: string, item: Omit<FFETemplateItem, 'id' | 'sectionId'>) => void
  updateItem: (itemId: string, updates: Partial<FFETemplateItem>) => void
  removeItem: (itemId: string) => void
  reorderItems: (sectionId: string, itemIds: string[]) => void
  
  // Utility
  getFilteredTemplates: () => FFETemplate[]
  resetState: () => void
}

const initialState = {
  templates: [],
  selectedTemplate: null,
  selectedTemplates: [],
  isLoading: false,
  error: null,
  sections: [],
  filters: {
    searchQuery: ''
  },
  sectionLibrary: [],
  isTemplateEditorOpen: false,
  isCreatingTemplate: false,
  draggedItem: null
}

export const useFFETemplateStore = create<FFETemplateState>()(
  devtools(
    (set, get) => ({
      ...initialState,
      
      // Basic setters
      setTemplates: (templates) => set({ templates }),
      setSelectedTemplate: (selectedTemplate) => set({ selectedTemplate }),
      setSelectedTemplates: (selectedTemplates) => set({ selectedTemplates }),
      clearSelectedTemplates: () => set({ selectedTemplates: [] }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setFilters: (newFilters) => set((state) => ({
        filters: { ...state.filters, ...newFilters }
      })),
      setSectionLibrary: (sectionLibrary) => set({ sectionLibrary }),
      
      // UI setters
      setTemplateEditorOpen: (isTemplateEditorOpen) => set({ isTemplateEditorOpen }),
      setCreatingTemplate: (isCreatingTemplate) => set({ isCreatingTemplate }),
      setDraggedItem: (draggedItem) => set({ draggedItem }),
      
      // Template operations
      addTemplate: (template) => set((state) => ({
        templates: [...state.templates, template]
      })),
      
      updateTemplate: (updatedTemplate) => set((state) => ({
        templates: state.templates.map(t => 
          t.id === updatedTemplate.id ? updatedTemplate : t
        ),
        selectedTemplate: state.selectedTemplate?.id === updatedTemplate.id 
          ? updatedTemplate 
          : state.selectedTemplate
      })),
      
      removeTemplate: (templateId) => set((state) => ({
        templates: state.templates.filter(t => t.id !== templateId),
        selectedTemplate: state.selectedTemplate?.id === templateId 
          ? null 
          : state.selectedTemplate
      })),
      
      // Section operations
      addSection: (templateId, sectionData) => {
        const newSection: FFETemplateSection = {
          ...sectionData,
          id: `temp-section-${Date.now()}`,
          templateId,
          items: []
        }
        
        set((state) => ({
          templates: state.templates.map(template =>
            template.id === templateId
              ? {
                  ...template,
                  sections: [...template.sections, newSection].sort((a, b) => a.order - b.order)
                }
              : template
          ),
          selectedTemplate: state.selectedTemplate?.id === templateId
            ? {
                ...state.selectedTemplate,
                sections: [...state.selectedTemplate.sections, newSection].sort((a, b) => a.order - b.order)
              }
            : state.selectedTemplate
        }))
      },
      
      updateSection: (sectionId, updates) => set((state) => ({
        templates: state.templates.map(template => ({
          ...template,
          sections: template.sections.map(section =>
            section.id === sectionId ? { ...section, ...updates } : section
          )
        })),
        selectedTemplate: state.selectedTemplate ? {
          ...state.selectedTemplate,
          sections: state.selectedTemplate.sections.map(section =>
            section.id === sectionId ? { ...section, ...updates } : section
          )
        } : null
      })),
      
      removeSection: (sectionId) => set((state) => ({
        templates: state.templates.map(template => ({
          ...template,
          sections: template.sections.filter(section => section.id !== sectionId)
        })),
        selectedTemplate: state.selectedTemplate ? {
          ...state.selectedTemplate,
          sections: state.selectedTemplate.sections.filter(section => section.id !== sectionId)
        } : null
      })),
      
      reorderSections: (templateId, sectionIds) => set((state) => ({
        templates: state.templates.map(template =>
          template.id === templateId
            ? {
                ...template,
                sections: sectionIds.map((id, index) => {
                  const section = template.sections.find(s => s.id === id)!
                  return { ...section, order: index }
                })
              }
            : template
        ),
        selectedTemplate: state.selectedTemplate?.id === templateId
          ? {
              ...state.selectedTemplate,
              sections: sectionIds.map((id, index) => {
                const section = state.selectedTemplate!.sections.find(s => s.id === id)!
                return { ...section, order: index }
              })
            }
          : state.selectedTemplate
      })),
      
      // Item operations
      addItem: (sectionId, itemData) => {
        const newItem: FFETemplateItem = {
          ...itemData,
          id: `temp-item-${Date.now()}`,
          sectionId
        }
        
        set((state) => ({
          templates: state.templates.map(template => ({
            ...template,
            sections: template.sections.map(section =>
              section.id === sectionId
                ? {
                    ...section,
                    items: [...section.items, newItem].sort((a, b) => a.order - b.order)
                  }
                : section
            )
          })),
          selectedTemplate: state.selectedTemplate ? {
            ...state.selectedTemplate,
            sections: state.selectedTemplate.sections.map(section =>
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
        templates: state.templates.map(template => ({
          ...template,
          sections: template.sections.map(section => ({
            ...section,
            items: section.items.map(item =>
              item.id === itemId ? { ...item, ...updates } : item
            )
          }))
        })),
        selectedTemplate: state.selectedTemplate ? {
          ...state.selectedTemplate,
          sections: state.selectedTemplate.sections.map(section => ({
            ...section,
            items: section.items.map(item =>
              item.id === itemId ? { ...item, ...updates } : item
            )
          }))
        } : null
      })),
      
      removeItem: (itemId) => set((state) => ({
        templates: state.templates.map(template => ({
          ...template,
          sections: template.sections.map(section => ({
            ...section,
            items: section.items.filter(item => item.id !== itemId)
          }))
        })),
        selectedTemplate: state.selectedTemplate ? {
          ...state.selectedTemplate,
          sections: state.selectedTemplate.sections.map(section => ({
            ...section,
            items: section.items.filter(item => item.id !== itemId)
          }))
        } : null
      })),
      
      reorderItems: (sectionId, itemIds) => set((state) => ({
        templates: state.templates.map(template => ({
          ...template,
          sections: template.sections.map(section =>
            section.id === sectionId
              ? {
                  ...section,
                  items: itemIds.map((id, index) => {
                    const item = section.items.find(i => i.id === id)!
                    return { ...item, order: index }
                  })
                }
              : section
          )
        })),
        selectedTemplate: state.selectedTemplate ? {
          ...state.selectedTemplate,
          sections: state.selectedTemplate.sections.map(section =>
            section.id === sectionId
              ? {
                  ...section,
                  items: itemIds.map((id, index) => {
                    const item = section.items.find(i => i.id === id)!
                    return { ...item, order: index }
                  })
                }
              : section
          )
        } : null
      })),
      
      // Utility functions
      getFilteredTemplates: () => {
        const state = get()
        let filtered = state.templates
        
        if (state.filters.searchQuery) {
          const search = state.filters.searchQuery.toLowerCase()
          filtered = filtered.filter(t => 
            t.name.toLowerCase().includes(search) ||
            t.description?.toLowerCase().includes(search) ||
            t.tags.some(tag => tag.toLowerCase().includes(search))
          )
        }
        
        return filtered.sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1
          if (!a.isDefault && b.isDefault) return 1
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
      },
      
      resetState: () => set(initialState)
    }),
    {
      name: 'ffe-template-store'
    }
  )
)
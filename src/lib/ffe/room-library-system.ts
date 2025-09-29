// FFE Room Library System
// Defines shared libraries per room type (not room-specific duplicates)

export type FFEItemStatus = 'chosen' | 'pending' | 'not_needed'

export interface FFESubItem {
  id: string
  name: string
  type: 'selection' | 'input' | 'checkbox' | 'color'
  options?: string[]
  isRequired: boolean
  placeholder?: string
}

export interface FFEItemLogicRule {
  trigger: 'standard' | 'custom'
  triggerValue?: string // For specific selections
  expandsTo: FFESubItem[]
}

export interface FFELibraryItem {
  id: string
  name: string
  category: string
  isRequired: boolean
  logicRules?: FFEItemLogicRule[] // Rules for expansion
  order: number
}

export interface FFECategory {
  id: string
  name: string
  order: number
  items: FFELibraryItem[]
}

export interface FFERoomLibrary {
  roomType: string
  name: string
  categories: FFECategory[]
}

// Removed all hardcoded standard categories - users manage their own categories
export const STANDARD_CATEGORIES: Record<string, { name: string; order: number }> = {}

// ONE LIBRARY PER ROOM TYPE - ALL REMOVED
export const FFE_ROOM_LIBRARIES: Record<string, FFERoomLibrary> = {

}

// Helper Functions - ALL CLEARED
export function getRoomLibrary(roomType: string): FFERoomLibrary | null {
  return null
}

export function getCategoryItems(roomType: string, categoryId: string): FFELibraryItem[] {
  return []
}

export function getItemLogicRules(roomType: string, itemId: string): FFEItemLogicRule[] {
  return []
}

export function getAllAvailableRoomTypes(): string[] {
  return []
}

export function getAllStandardCategories(): typeof STANDARD_CATEGORIES {
  return {} // No hardcoded categories
}

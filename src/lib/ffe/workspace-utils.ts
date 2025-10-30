/**
 * FFE Workspace Utilities
 * Helper functions for workspace item management and sorting
 */

export interface FFEWorkspaceItem {
  id: string
  name: string
  state: 'PENDING' | 'CONFIRMED' | 'NOT_NEEDED' | 'SELECTED' | string
  visibility?: 'VISIBLE' | 'HIDDEN' | string
  order?: number
  customFields?: any
  [key: string]: any
}

/**
 * Sort workspace items with pending/undecided items on top
 * 
 * Priority order:
 * 1. PENDING items (undecided)
 * 2. SELECTED items (in progress)
 * 3. CONFIRMED items (completed)
 * 4. NOT_NEEDED items (at the bottom)
 * 
 * Within each group, items are sorted by their original order
 */
export function sortWorkspaceItems(items: FFEWorkspaceItem[]): FFEWorkspaceItem[] {
  const stateOrder: Record<string, number> = {
    'PENDING': 1,
    'SELECTED': 2,
    'CONFIRMED': 3,
    'NOT_NEEDED': 4,
  }

  return [...items].sort((a, b) => {
    // Sort by state priority first
    const aPriority = stateOrder[a.state.toUpperCase()] || 5
    const bPriority = stateOrder[b.state.toUpperCase()] || 5
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }
    
    // Within same state, sort by original order
    return (a.order || 0) - (b.order || 0)
  })
}

/**
 * Group workspace items by state for display
 */
export function groupItemsByState(items: FFEWorkspaceItem[]) {
  const groups = {
    pending: [] as FFEWorkspaceItem[],
    selected: [] as FFEWorkspaceItem[],
    confirmed: [] as FFEWorkspaceItem[],
    notNeeded: [] as FFEWorkspaceItem[],
  }

  items.forEach(item => {
    const state = item.state.toUpperCase()
    switch (state) {
      case 'PENDING':
        groups.pending.push(item)
        break
      case 'SELECTED':
        groups.selected.push(item)
        break
      case 'CONFIRMED':
        groups.confirmed.push(item)
        break
      case 'NOT_NEEDED':
        groups.notNeeded.push(item)
        break
      default:
        // Default to pending for unknown states
        groups.pending.push(item)
    }
  })

  return groups
}

/**
 * Filter only visible items for workspace display
 */
export function getVisibleItems(items: FFEWorkspaceItem[]): FFEWorkspaceItem[] {
  return items.filter(item => 
    item.visibility === 'VISIBLE' || 
    item.visibility === undefined || // Default to visible if not specified
    item.state === 'SELECTED' || 
    item.state === 'CONFIRMED'
  )
}

/**
 * Count items by state
 */
export function getStateCounts(items: FFEWorkspaceItem[]) {
  return {
    pending: items.filter(i => i.state.toUpperCase() === 'PENDING').length,
    selected: items.filter(i => i.state.toUpperCase() === 'SELECTED').length,
    confirmed: items.filter(i => i.state.toUpperCase() === 'CONFIRMED').length,
    notNeeded: items.filter(i => i.state.toUpperCase() === 'NOT_NEEDED').length,
    total: items.length
  }
}

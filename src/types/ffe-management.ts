// Enhanced FFE Management Types
// Comprehensive interfaces for the advanced FFE Library Management System

export interface FFEItemLevel {
  BASE: 'base'           // Single checkbox item
  STANDARD: 'standard'   // Standard vs Custom choice
  CUSTOM: 'custom'      // Expands to show sub-items
  CONDITIONAL: 'conditional' // Appears based on other selections
}

export interface FFEItemState {
  PENDING: 'pending'
  CONFIRMED: 'confirmed'
  NOT_NEEDED: 'not_needed'
  CUSTOM_EXPANDED: 'custom_expanded'
}

export interface FFEItemScope {
  GLOBAL: 'global'         // Applies to all room types
  ROOM_SPECIFIC: 'room_specific' // Only for specific room types
}

export interface FFECategory {
  id: string
  name: string
  description?: string
  icon?: string
  order: number
  isExpandable: boolean
  roomTypes: string[]
  isGlobal: boolean
  createdAt: Date
  updatedAt: Date
  createdById: string
  updatedById: string
}

export interface FFESubItem {
  id: string
  name: string
  defaultState: FFEItemState[keyof FFEItemState]
  isRequired: boolean
  order: number
  conditionalOn?: string[] // Parent item IDs this depends on
}

export interface FFEItemTemplate {
  id: string
  name: string
  description?: string
  category: string
  level: FFEItemLevel[keyof FFEItemLevel]
  scope: FFEItemScope[keyof FFEItemScope]
  
  // State Configuration
  defaultState: FFEItemState[keyof FFEItemState]
  isRequired: boolean
  supportsMultiChoice: boolean
  
  // Room Type Configuration
  roomTypes: string[]        // Specific room types (if room-specific)
  excludeFromRoomTypes?: string[] // Room types to exclude (if global)
  
  // Item Relationships
  subItems?: FFESubItem[]
  conditionalOn?: string[]   // Shows only if these items are confirmed
  mutuallyExclusiveWith?: string[] // Cannot be selected with these items
  alternativeTo?: string[]   // Alternative options
  
  // Version Control
  version: string
  isActive: boolean
  deprecatedAt?: Date
  replacedBy?: string        // ID of replacement item
  
  // Metadata
  order: number
  notes?: string
  tags?: string[]
  estimatedCost?: number
  leadTimeWeeks?: number
  supplierInfo?: {
    name: string
    website?: string
    notes?: string
  }[]
  
  // Tracking
  createdAt: Date
  updatedAt: Date
  createdById: string
  updatedById: string
}

export interface FFERoomLibrary {
  id: string
  orgId: string
  name: string
  description?: string
  roomType: string
  version: string
  isActive: boolean
  isDefault: boolean
  
  // Template Configuration
  categories: FFECategoryConfig[]
  globalItems: string[]       // IDs of global items that apply
  customItems: string[]       // IDs of organization custom items
  
  // Version Control
  parentVersionId?: string    // Previous version this was based on
  versionNotes?: string
  publishedAt?: Date
  deprecatedAt?: Date
  
  // Usage Stats
  projectsUsing: number
  lastUsedAt?: Date
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  createdById: string
  updatedById: string
}

export interface FFECategoryConfig {
  categoryId: string
  isEnabled: boolean
  customName?: string        // Override category name for this room
  customOrder?: number       // Override category order for this room
  hiddenItems?: string[]     // Category items to hide for this room
  additionalItems?: string[] // Additional items specific to this room+category
}

export interface FFEVersionHistory {
  id: string
  orgId: string
  entityType: 'room_library' | 'category' | 'item_template'
  entityId: string
  version: string
  changeType: 'created' | 'updated' | 'deprecated' | 'restored'
  changeDescription: string
  changeDetails: {
    field: string
    oldValue: any
    newValue: any
  }[]
  
  // Snapshot of the entity at this version
  entitySnapshot: any
  
  // Impact Assessment
  affectedProjects?: {
    projectId: string
    projectName: string
    roomCount: number
    impact: 'none' | 'minor' | 'major'
  }[]
  
  // Migration Info
  migrationRequired: boolean
  migrationNotes?: string
  autoMigrationPossible: boolean
  
  createdAt: Date
  createdById: string
}

export interface FFEGlobalSettings {
  id: string
  orgId: string
  
  // Default Behaviors
  defaultItemState: FFEItemState[keyof FFEItemState]
  autoAddCustomItems: boolean        // Auto add project custom items to library
  requireApprovalForChanges: boolean
  enableVersionControl: boolean
  
  // Category Management
  enableCustomCategories: boolean
  allowCategoryReordering: boolean
  defaultCategoryExpansion: boolean  // Categories expanded by default
  
  // Item Configuration
  allowConditionalItems: boolean
  enableSubItems: boolean
  maxSubItemDepth: number
  enableItemAlternatives: boolean
  
  // Multi-Choice Configuration
  enableMultiChoice: boolean
  defaultMultiChoiceLimit?: number
  
  // Global Item Management
  enableGlobalItems: boolean
  globalItemsRequireApproval: boolean
  
  // Legacy Project Handling
  legacyProjectBehavior: 'freeze' | 'upgrade_prompt' | 'auto_upgrade'
  keepDeprecatedVersions: boolean
  versionRetentionDays?: number
  
  // Notifications
  notifyOnLibraryChanges: boolean
  notifyOnVersionUpdates: boolean
  emailRecipients: string[]
  
  // Advanced Features
  enableCostTracking: boolean
  enableLeadTimeTracking: boolean
  enableSupplierIntegration: boolean
  enableUsageAnalytics: boolean
  
  createdAt: Date
  updatedAt: Date
  createdById: string
  updatedById: string
}

export interface FFEProjectConfiguration {
  id: string
  projectId: string
  
  // Version Locking
  lockedToVersion?: string   // Lock project to specific library version
  allowUpgrades: boolean
  upgradePolicy: 'manual' | 'auto_minor' | 'auto_all'
  
  // Room Libraries
  roomLibraries: {
    roomId: string
    roomType: string
    libraryId: string
    libraryVersion: string
    customOverrides?: {
      hiddenCategories?: string[]
      hiddenItems?: string[]
      additionalItems?: FFEItemTemplate[]
    }
  }[]
  
  // Project-Specific Items
  customItems: FFEItemTemplate[]
  
  createdAt: Date
  updatedAt: Date
  createdById: string
  updatedById: string
}

// UI State Management Types
export interface FFEManagementViewState {
  activeTab: 'room_libraries' | 'categories' | 'global_items' | 'version_control' | 'settings'
  selectedRoomType?: string
  selectedCategory?: string
  selectedLibraryVersion?: string
  
  // Filters
  searchTerm: string
  statusFilter: 'all' | 'active' | 'deprecated'
  scopeFilter: 'all' | 'global' | 'room_specific'
  levelFilter: 'all' | 'base' | 'standard' | 'custom' | 'conditional'
  
  // UI States
  showDeprecated: boolean
  expandedCategories: Set<string>
  selectedItems: Set<string>
  draggedItem?: string
  
  // Modals
  showAddItemModal: boolean
  showEditItemModal: boolean
  showVersionHistoryModal: boolean
  showBulkOperationsModal: boolean
  editingItem?: FFEItemTemplate
}

export interface FFEBulkOperation {
  type: 'move_category' | 'change_scope' | 'update_state' | 'deprecate' | 'activate'
  itemIds: string[]
  params: Record<string, any>
  preview?: {
    affectedItems: number
    warnings: string[]
    estimatedTime: string
  }
}

// Form Types for UI Components
export interface FFEItemFormData {
  name: string
  description?: string
  category: string
  level: FFEItemLevel[keyof FFEItemLevel]
  scope: FFEItemScope[keyof FFEItemScope]
  defaultState: FFEItemState[keyof FFEItemState]
  isRequired: boolean
  supportsMultiChoice: boolean
  roomTypes: string[]
  excludeFromRoomTypes: string[]
  subItems: FFESubItem[]
  conditionalOn: string[]
  mutuallyExclusiveWith: string[]
  notes?: string
  tags: string[]
  estimatedCost?: number
  leadTimeWeeks?: number
  supplierInfo: Array<{
    name: string
    website?: string
    notes?: string
  }>
}

export interface FFECategoryFormData {
  name: string
  description?: string
  icon?: string
  roomTypes: string[]
  isGlobal: boolean
  isExpandable: boolean
}

export interface FFERoomLibraryFormData {
  name: string
  description?: string
  roomType: string
  basedOnLibrary?: string    // Copy from existing library
  categories: FFECategoryConfig[]
  versionNotes?: string
}

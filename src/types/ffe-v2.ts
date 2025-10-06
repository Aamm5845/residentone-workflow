// FFE System V2 Types
// New simplified template-based FFE system types

export type RoomType = 
  | 'BEDROOM'
  | 'BATHROOM'
  | 'KITCHEN'
  | 'LIVING_ROOM'
  | 'DINING_ROOM'
  | 'OFFICE'
  | 'POWDER_ROOM'
  | 'LAUNDRY'
  | 'PANTRY'
  | 'ENTRY'
  | 'HALLWAY'
  | 'CLOSET'
  | 'BALCONY'
  | 'OTHER';

export type FFEItemState = 
  | 'PENDING'
  | 'CONFIRMED'
  | 'NOT_NEEDED'
  | 'IN_PROGRESS'
  | 'COMPLETE';

// FFE Section (pre-defined library)
export interface FFESection {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// FFE Template Item
export interface FFETemplateItem {
  id: string;
  name: string;
  description?: string;
  defaultState: FFEItemState;
  isRequired: boolean;
  order: number;
  notes?: string;
  linkedItems?: string[]; // Names of items this item creates
  createdAt: Date;
  updatedAt: Date;
}

// FFE Template Section (links template to section with items)
export interface FFETemplateSection {
  id: string;
  templateId: string;
  sectionId: string;
  order: number;
  items: FFETemplateItem[];
  section: FFESection;
  createdAt: Date;
  updatedAt: Date;
}

// FFE Template
export interface FFETemplate {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  roomType: RoomType;
  isActive: boolean;
  isDefault: boolean;
  version: number;
  sections: FFETemplateSection[];
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  updatedById: string;
}

// FFE Project Room Data (actual usage of templates)
export interface FFERoomData {
  id: string;
  roomId: string;
  templateId?: string;
  items: FFERoomItem[];
  notes?: string;
  state: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETE';
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// FFE Room Item (actual item state in a room)
export interface FFERoomItem {
  id: string;
  roomDataId: string;
  templateItemId?: string; // null for custom items
  sectionId: string;
  name: string;
  description?: string;
  state: FFEItemState;
  notes?: string;
  completedAt?: Date;
  order: number;
  isCustom: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Template Creation/Update Data
export interface FFETemplateCreateData {
  name: string;
  description?: string;
  roomType: RoomType;
  isActive?: boolean;
  isDefault?: boolean;
  sections: {
    sectionId: string;
    order: number;
    items: {
      name: string;
      description?: string;
      defaultState: FFEItemState;
      isRequired: boolean;
      order: number;
      notes?: string;
      linkedItems?: string[];
    }[];
  }[];
}

export interface FFETemplateUpdateData {
  name?: string;
  description?: string;
  roomType?: RoomType;
  isActive?: boolean;
  isDefault?: boolean;
  sections?: {
    sectionId: string;
    order: number;
    items: {
      id?: string; // existing item ID for updates
      name: string;
      description?: string;
      defaultState: FFEItemState;
      isRequired: boolean;
      order: number;
      notes?: string;
      linkedItems?: string[];
    }[];
  }[];
}

// Filter and Search Types
export interface FFETemplateFilters {
  searchQuery?: string;
  roomType?: RoomType;
  isActive?: boolean;
  createdBy?: string;
}

export interface FFESectionFilters {
  searchQuery?: string;
}

// API Response Types
export interface FFETemplateListResponse {
  templates: FFETemplate[];
  total: number;
}

export interface FFESectionListResponse {
  sections: FFESection[];
  total: number;
}

// Store State Types
export interface FFETemplateStoreState {
  templates: FFETemplate[];
  sections: FFESection[];
  selectedTemplates: string[];
  filters: FFETemplateFilters;
  isLoading: boolean;
  error: string | null;
}

// Hook Types
export interface UseFFEApiReturn {
  templates: {
    data: FFETemplate[] | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
  };
  sections: {
    data: FFESection[] | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
  };
  createTemplate: {
    mutateAsync: (data: FFETemplateCreateData) => Promise<FFETemplate>;
    isLoading: boolean;
  };
  updateTemplate: {
    mutateAsync: (params: { id: string; data: FFETemplateUpdateData }) => Promise<FFETemplate>;
    isLoading: boolean;
  };
  deleteTemplate: {
    mutateAsync: (id: string) => Promise<void>;
    isLoading: boolean;
  };
  copyTemplate: {
    mutateAsync: (params: { id: string; name: string }) => Promise<FFETemplate>;
    isLoading: boolean;
  };
}

// Form Types for UI
export interface TemplateFormData {
  name: string;
  description: string;
  roomType: RoomType;
  isActive: boolean;
  isDefault: boolean;
  sections: {
    sectionId: string;
    order: number;
    items: {
      id?: string;
      name: string;
      description: string;
      defaultState: FFEItemState;
      isRequired: boolean;
      order: number;
      notes: string;
    }[];
  }[];
}

export interface SectionFormData {
  name: string;
  description: string;
  icon: string;
  order: number;
}

// Bulk Operations
export interface BulkOperation {
  type: 'activate' | 'deactivate' | 'delete' | 'set_default';
  templateIds: string[];
}

// Drag and Drop Types
export interface DragItem {
  type: 'section' | 'item';
  id: string;
  sectionId?: string;
  data: any;
}

export interface DropResult {
  draggedId: string;
  targetId: string;
  position: 'before' | 'after' | 'inside';
}
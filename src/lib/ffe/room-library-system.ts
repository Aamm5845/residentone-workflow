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

// Standard Categories (consistent across all room types)
export const STANDARD_CATEGORIES: Record<string, { name: string; order: number }> = {
  FLOORING: { name: 'Flooring', order: 1 },
  WALLS: { name: 'Walls', order: 2 },
  CEILING: { name: 'Ceiling', order: 3 },
  PLUMBING: { name: 'Plumbing', order: 4 },
  FURNITURE: { name: 'Furniture', order: 5 },
  LIGHTING: { name: 'Lighting', order: 6 },
  ACCESSORIES: { name: 'Accessories', order: 7 }
}

// ONE LIBRARY PER ROOM TYPE (shared across all instances)
export const FFE_ROOM_LIBRARIES: Record<string, FFERoomLibrary> = {
  // Single Bedroom library for ALL bedrooms (Master, Guest, Girls, Boys)
  bedroom: {
    roomType: 'bedroom',
    name: 'Bedroom',
    categories: [
      {
        id: 'FLOORING',
        name: 'Flooring',
        order: 1,
        items: [
          { id: 'bedroom_hardwood', name: 'Bedroom Hardwood Flooring', category: 'FLOORING', isRequired: true, order: 1 },
          { id: 'bedroom_carpet', name: 'Bedroom Carpet', category: 'FLOORING', isRequired: false, order: 2 },
          { id: 'bedroom_area_rug', name: 'Bedroom Area Rug', category: 'FLOORING', isRequired: false, order: 3 }
        ]
      },
      {
        id: 'FURNITURE',
        name: 'Furniture',
        order: 5,
        items: [
          {
            id: 'bed',
            name: 'Bed',
            category: 'FURNITURE',
            isRequired: true,
            order: 1,
            logicRules: [
              {
                trigger: 'standard',
                expandsTo: [
                  { id: 'bed_selection', name: 'Bed Selection', type: 'selection', options: ['King Platform Bed', 'Queen Upholstered Bed', 'Full Sleigh Bed'], isRequired: true }
                ]
              },
              {
                trigger: 'custom',
                expandsTo: [
                  { id: 'bed_size', name: 'Size', type: 'selection', options: ['Twin', 'Full', 'Queen', 'King'], isRequired: true },
                  { id: 'bed_material', name: 'Material', type: 'selection', options: ['Wood', 'Metal', 'Upholstered'], isRequired: true },
                  { id: 'bed_color', name: 'Color', type: 'color', isRequired: true },
                  { id: 'headboard_style', name: 'Headboard Style', type: 'selection', options: ['Panel', 'Wingback', 'Tufted', 'None'], isRequired: false }
                ]
              }
            ]
          },
          {
            id: 'nightstands',
            name: 'Nightstands',
            category: 'FURNITURE',
            isRequired: true,
            order: 2,
            logicRules: [
              {
                trigger: 'standard',
                expandsTo: [
                  { id: 'nightstand_selection', name: 'Nightstand Selection', type: 'selection', options: ['2-Drawer Nightstand', 'Floating Nightstand', 'Round Nightstand'], isRequired: true }
                ]
              },
              {
                trigger: 'custom',
                expandsTo: [
                  { id: 'nightstand_style', name: 'Style', type: 'selection', options: ['Modern', 'Traditional', 'Mid-Century'], isRequired: true },
                  { id: 'nightstand_material', name: 'Material', type: 'selection', options: ['Wood', 'Metal', 'Glass'], isRequired: true },
                  { id: 'nightstand_drawers', name: 'Number of Drawers', type: 'selection', options: ['1', '2', '3', 'Open Shelf'], isRequired: true }
                ]
              }
            ]
          },
          { id: 'dresser', name: 'Dresser', category: 'FURNITURE', isRequired: false, order: 3 },
          { id: 'bedroom_desk', name: 'Bedroom Desk', category: 'FURNITURE', isRequired: false, order: 4 },
          { id: 'bedroom_chair', name: 'Bedroom Chair', category: 'FURNITURE', isRequired: false, order: 5 }
        ]
      },
      {
        id: 'LIGHTING',
        name: 'Lighting',
        order: 6,
        items: [
          { id: 'bedroom_ceiling_light', name: 'Bedroom Ceiling Light', category: 'LIGHTING', isRequired: true, order: 1 },
          { id: 'table_lamps', name: 'Table Lamps', category: 'LIGHTING', isRequired: false, order: 2 },
          { id: 'floor_lamp', name: 'Floor Lamp', category: 'LIGHTING', isRequired: false, order: 3 }
        ]
      },
      {
        id: 'ACCESSORIES',
        name: 'Accessories',
        order: 7,
        items: [
          { id: 'window_treatments', name: 'Window Treatments', category: 'ACCESSORIES', isRequired: false, order: 1 },
          { id: 'bedroom_artwork', name: 'Bedroom Artwork', category: 'ACCESSORIES', isRequired: false, order: 2 },
          { id: 'bedroom_mirror', name: 'Bedroom Mirror', category: 'ACCESSORIES', isRequired: false, order: 3 }
        ]
      }
    ]
  },

  // Single Bathroom library for ALL bathrooms (Master, Guest, Powder, etc.)
  bathroom: {
    roomType: 'bathroom',
    name: 'Bathroom',
    categories: [
      {
        id: 'FLOORING',
        name: 'Flooring',
        order: 1,
        items: [
          { id: 'bathroom_tile_flooring', name: 'Bathroom Tile Flooring', category: 'FLOORING', isRequired: true, order: 1 },
          { id: 'heated_floor', name: 'Heated Floor', category: 'FLOORING', isRequired: false, order: 2 }
        ]
      },
      {
        id: 'WALLS',
        name: 'Walls',
        order: 2,
        items: [
          { id: 'wall_tile', name: 'Wall Tile', category: 'WALLS', isRequired: false, order: 1 },
          { id: 'bathroom_paint', name: 'Bathroom Paint', category: 'WALLS', isRequired: true, order: 2 }
        ]
      },
      {
        id: 'PLUMBING',
        name: 'Plumbing',
        order: 4,
        items: [
          {
            id: 'toilet',
            name: 'Toilet',
            category: 'PLUMBING',
            isRequired: true,
            order: 1,
            logicRules: [
              {
                trigger: 'standard',
                expandsTo: [
                  { id: 'toilet_selection', name: 'Toilet Selection', type: 'selection', options: ['Standard Two-Piece', 'One-Piece', 'Comfort Height'], isRequired: true }
                ]
              },
              {
                trigger: 'custom', // Wall-Mounted = 4 items
                expandsTo: [
                  { id: 'toilet_carrier', name: 'Carrier System', type: 'selection', options: ['Geberit Duofix', 'TOTO In-Wall', 'Kohler In-Wall'], isRequired: true },
                  { id: 'flush_plate', name: 'Flush Plate', type: 'selection', options: ['Chrome', 'Matte Black', 'White', 'Brass'], isRequired: true },
                  { id: 'toilet_bowl', name: 'Toilet Bowl', type: 'selection', options: ['TOTO Wall-Hung', 'Kohler Veil', 'Duravit Starck'], isRequired: true },
                  { id: 'toilet_seat', name: 'Toilet Seat', type: 'selection', options: ['Standard', 'Soft-Close', 'Bidet', 'Heated'], isRequired: true }
                ]
              }
            ]
          },
          {
            id: 'vanity',
            name: 'Vanity',
            category: 'PLUMBING',
            isRequired: true,
            order: 2,
            logicRules: [
              {
                trigger: 'standard',
                expandsTo: [
                  { id: 'vanity_selection', name: 'Vanity Selection', type: 'selection', options: ['24" Single Sink', '36" Single Sink', '48" Single Sink', '60" Double Sink'], isRequired: true }
                ]
              },
              {
                trigger: 'custom',
                expandsTo: [
                  { id: 'vanity_cabinet', name: 'Cabinet Style', type: 'selection', options: ['Shaker', 'Flat Panel', 'Traditional'], isRequired: true },
                  { id: 'vanity_counter', name: 'Counter Material', type: 'selection', options: ['Quartz', 'Marble', 'Granite'], isRequired: true },
                  { id: 'vanity_sink', name: 'Sink Style', type: 'selection', options: ['Undermount', 'Vessel', 'Integrated'], isRequired: true },
                  { id: 'vanity_faucet', name: 'Faucet', type: 'selection', options: ['Single Handle', 'Widespread', 'Wall Mount'], isRequired: true },
                  { id: 'vanity_handles', name: 'Cabinet Handles', type: 'selection', options: ['Brushed Gold', 'Matte Black', 'Chrome'], isRequired: true }
                ]
              }
            ]
          },
          {
            id: 'bathtub',
            name: 'Bathtub',
            category: 'PLUMBING',
            isRequired: false,
            order: 3,
            logicRules: [
              {
                trigger: 'standard', // Freestanding = 1 item
                expandsTo: [
                  { id: 'tub_selection', name: 'Bathtub Selection', type: 'selection', options: ['Freestanding Soaking Tub', 'Clawfoot Tub', 'Modern Freestanding'], isRequired: true }
                ]
              },
              {
                trigger: 'custom', // Built-in = 3 items
                expandsTo: [
                  { id: 'tub_style', name: 'Tub Style', type: 'selection', options: ['Alcove', 'Drop-in', 'Undermount'], isRequired: true },
                  { id: 'tub_surround', name: 'Tub Surround', type: 'selection', options: ['Tile', 'Stone', 'Acrylic'], isRequired: true },
                  { id: 'tub_filler', name: 'Tub Filler', type: 'selection', options: ['Deck Mount', 'Floor Mount', 'Wall Mount'], isRequired: true }
                ]
              }
            ]
          },
          { id: 'shower', name: 'Shower', category: 'PLUMBING', isRequired: false, order: 4 },
          { id: 'faucet', name: 'Faucet', category: 'PLUMBING', isRequired: false, order: 5 }
        ]
      },
      {
        id: 'LIGHTING',
        name: 'Lighting',
        order: 6,
        items: [
          { id: 'vanity_sconces', name: 'Vanity Sconces', category: 'LIGHTING', isRequired: true, order: 1 },
          { id: 'bathroom_ceiling_light', name: 'Bathroom Ceiling Light', category: 'LIGHTING', isRequired: false, order: 2 },
          { id: 'shower_light', name: 'Shower Light', category: 'LIGHTING', isRequired: false, order: 3 }
        ]
      },
      {
        id: 'ACCESSORIES',
        name: 'Accessories',
        order: 7,
        items: [
          { id: 'bathroom_mirror', name: 'Bathroom Mirror', category: 'ACCESSORIES', isRequired: true, order: 1 },
          { id: 'towel_bars', name: 'Towel Bars', category: 'ACCESSORIES', isRequired: false, order: 2 },
          { id: 'shower_curtain', name: 'Shower Curtain/Door', category: 'ACCESSORIES', isRequired: false, order: 3 }
        ]
      }
    ]
  },

  // Single Kitchen library
  kitchen: {
    roomType: 'kitchen',
    name: 'Kitchen',
    categories: [
      {
        id: 'FLOORING',
        name: 'Flooring',
        order: 1,
        items: [
          { id: 'kitchen_tile_flooring', name: 'Kitchen Tile Flooring', category: 'FLOORING', isRequired: true, order: 1 },
          { id: 'kitchen_hardwood', name: 'Kitchen Hardwood Flooring', category: 'FLOORING', isRequired: false, order: 2 }
        ]
      },
      {
        id: 'WALLS',
        name: 'Walls',
        order: 2,
        items: [
          { id: 'backsplash', name: 'Backsplash', category: 'WALLS', isRequired: true, order: 1 },
          { id: 'kitchen_paint', name: 'Kitchen Paint', category: 'WALLS', isRequired: true, order: 2 }
        ]
      },
      {
        id: 'FURNITURE',
        name: 'Furniture',
        order: 5,
        items: [
          { id: 'cabinets', name: 'Cabinets', category: 'FURNITURE', isRequired: true, order: 1 },
          { id: 'countertops', name: 'Countertops', category: 'FURNITURE', isRequired: true, order: 2 },
          { id: 'island', name: 'Kitchen Island', category: 'FURNITURE', isRequired: false, order: 3 },
          { id: 'bar_stools', name: 'Bar Stools', category: 'FURNITURE', isRequired: false, order: 4 }
        ]
      },
      {
        id: 'LIGHTING',
        name: 'Lighting',
        order: 6,
        items: [
          { id: 'pendant_lights', name: 'Pendant Lights', category: 'LIGHTING', isRequired: false, order: 1 },
          { id: 'under_cabinet', name: 'Under Cabinet Lighting', category: 'LIGHTING', isRequired: false, order: 2 },
          { id: 'kitchen_ceiling_light', name: 'Kitchen Ceiling Light', category: 'LIGHTING', isRequired: true, order: 3 }
        ]
      }
    ]
  },

  // Single Dining Room library
  'dining-room': {
    roomType: 'dining-room',
    name: 'Dining Room',
    categories: [
      {
        id: 'FURNITURE',
        name: 'Furniture',
        order: 5,
        items: [
          { id: 'dining_table', name: 'Dining Table', category: 'FURNITURE', isRequired: true, order: 1 },
          { id: 'dining_chairs', name: 'Dining Chairs', category: 'FURNITURE', isRequired: true, order: 2 },
          { id: 'sideboard', name: 'Sideboard', category: 'FURNITURE', isRequired: false, order: 3 }
        ]
      },
      {
        id: 'LIGHTING',
        name: 'Lighting',
        order: 6,
        items: [
          { id: 'chandelier', name: 'Chandelier', category: 'LIGHTING', isRequired: true, order: 1 }
        ]
      }
    ]
  },

  // Single Living Room library
  'living-room': {
    roomType: 'living-room',
    name: 'Living Room',
    categories: [
      {
        id: 'FURNITURE',
        name: 'Furniture',
        order: 5,
        items: [
          { id: 'sofa', name: 'Sofa', category: 'FURNITURE', isRequired: true, order: 1 },
          { id: 'coffee_table', name: 'Coffee Table', category: 'FURNITURE', isRequired: false, order: 2 },
          { id: 'side_tables', name: 'Side Tables', category: 'FURNITURE', isRequired: false, order: 3 },
          { id: 'lounge_chairs', name: 'Lounge Chairs', category: 'FURNITURE', isRequired: false, order: 4 }
        ]
      }
    ]
  }
}

// Helper Functions
export function getRoomLibrary(roomType: string): FFERoomLibrary | null {
  // Map specific room types to their base library
  const roomTypeMapping: Record<string, string> = {
    'MASTER_BEDROOM': 'bedroom',
    'GUEST_BEDROOM': 'bedroom', 
    'GIRLS_ROOM': 'bedroom',
    'BOYS_ROOM': 'bedroom',
    'BEDROOM': 'bedroom',
    'MASTER_BATHROOM': 'bathroom',
    'POWDER_ROOM': 'bathroom',
    'FAMILY_BATHROOM': 'bathroom',
    'GUEST_BATHROOM': 'bathroom',
    'BATHROOM': 'bathroom',
    'KITCHEN': 'kitchen',
    'DINING_ROOM': 'dining-room',
    'LIVING_ROOM': 'living-room'
  }

  const baseRoomType = roomTypeMapping[roomType] || roomType.toLowerCase()
  return FFE_ROOM_LIBRARIES[baseRoomType] || null
}

export function getCategoryItems(roomType: string, categoryId: string): FFELibraryItem[] {
  const library = getRoomLibrary(roomType)
  if (!library) return []
  
  const category = library.categories.find(cat => cat.id === categoryId)
  return category?.items || []
}

export function getItemLogicRules(roomType: string, itemId: string): FFEItemLogicRule[] {
  const library = getRoomLibrary(roomType)
  if (!library) return []
  
  for (const category of library.categories) {
    const item = category.items.find(i => i.id === itemId)
    if (item?.logicRules) return item.logicRules
  }
  
  return []
}

export function getAllAvailableRoomTypes(): string[] {
  return Object.keys(FFE_ROOM_LIBRARIES)
}

export function getAllStandardCategories(): typeof STANDARD_CATEGORIES {
  return STANDARD_CATEGORIES
}
// Room-specific FFE (Furniture, Fixtures & Equipment) Configuration
// This defines the different categories and items that are typically needed for each room type

export interface FFEItemTemplate {
  id: string
  name: string
  category: string
  description?: string
  isRequired: boolean
  isStandard: boolean // true = single confirmation, false = expands to sub-items
  subItems?: FFESubItem[]
  conditionalOn?: string[] // item IDs this depends on
  estimatedPrice?: number
  leadTimeWeeks?: number
  priority: 'high' | 'medium' | 'low'
  notes?: string
}

export interface FFESubItem {
  id: string
  name: string
  description?: string
  isRequired: boolean
  estimatedPrice?: number
}

export interface FFECategory {
  id: string
  name: string
  icon: string
  color: string
  description: string
  order: number
}

export interface RoomFFEConfig {
  roomType: string
  displayName: string
  categories: FFECategory[]
  items: FFEItemTemplate[]
  completionCriteria: {
    requiredItemsCount: number
    requiredCategories: string[]
    customMessage?: string
  }
}

// FFE Categories used across different room types
export const FFE_CATEGORIES: Record<string, FFECategory> = {
  FURNITURE: {
    id: 'FURNITURE',
    name: 'Furniture',
    icon: '🛋️',
    color: 'from-amber-500 to-orange-500',
    description: 'Seating, tables, storage, and other furniture pieces',
    order: 1
  },
  LIGHTING: {
    id: 'LIGHTING',
    name: 'Lighting',
    icon: '💡',
    color: 'from-yellow-400 to-amber-500',
    description: 'Ceiling lights, lamps, sconces, and light fixtures',
    order: 2
  },
  TEXTILES: {
    id: 'TEXTILES',
    name: 'Textiles',
    icon: '🧵',
    color: 'from-pink-500 to-rose-500',
    description: 'Curtains, rugs, pillows, and fabric elements',
    order: 3
  },
  HARDWARE: {
    id: 'HARDWARE',
    name: 'Hardware',
    icon: '⚙️',
    color: 'from-gray-500 to-slate-600',
    description: 'Cabinet handles, faucets, hooks, and hardware elements',
    order: 4
  },
  FINISHES: {
    id: 'FINISHES',
    name: 'Finishes',
    icon: '🎨',
    color: 'from-purple-500 to-indigo-500',
    description: 'Paint, tiles, countertops, and surface finishes',
    order: 5
  },
  ACCESSORIES: {
    id: 'ACCESSORIES',
    name: 'Accessories',
    icon: '✨',
    color: 'from-emerald-500 to-teal-500',
    description: 'Art, mirrors, decorative objects, and styling elements',
    order: 6
  },
  PLUMBING: {
    id: 'PLUMBING',
    name: 'Plumbing',
    icon: '🚿',
    color: 'from-blue-500 to-cyan-500',
    description: 'Faucets, showers, toilets, and plumbing fixtures',
    order: 7
  },
  APPLIANCES: {
    id: 'APPLIANCES',
    name: 'Appliances',
    icon: '📱',
    color: 'from-indigo-500 to-purple-500',
    description: 'Kitchen appliances, laundry, and built-in equipment',
    order: 8
  }
}

// Room-specific FFE configurations
export const ROOM_FFE_CONFIGS: Record<string, RoomFFEConfig> = {
  // BEDROOMS
  MASTER_BEDROOM: {
    roomType: 'MASTER_BEDROOM',
    displayName: 'Master Bedroom',
    categories: [FFE_CATEGORIES.FURNITURE, FFE_CATEGORIES.LIGHTING, FFE_CATEGORIES.TEXTILES, FFE_CATEGORIES.ACCESSORIES],
    items: [
      {
        id: 'mb_bed_frame',
        name: 'Bed Frame',
        category: 'FURNITURE',
        description: 'King or queen size bed frame',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'mb_bed_frame_type', name: 'Frame Type', isRequired: true },
          { id: 'mb_bed_frame_material', name: 'Material', isRequired: true },
          { id: 'mb_bed_frame_finish', name: 'Finish', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 2500,
        leadTimeWeeks: 12
      },
      {
        id: 'mb_headboard',
        name: 'Headboard',
        category: 'FURNITURE',
        description: 'Upholstered or wooden headboard',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'mb_headboard_style', name: 'Style', isRequired: true },
          { id: 'mb_headboard_fabric', name: 'Fabric/Material', isRequired: true },
          { id: 'mb_headboard_size', name: 'Size', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 1200,
        leadTimeWeeks: 8
      },
      {
        id: 'mb_nightstands',
        name: 'Nightstands (Set of 2)',
        category: 'FURNITURE',
        description: 'Matching bedside tables',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'mb_nightstands_style', name: 'Style', isRequired: true },
          { id: 'mb_nightstands_material', name: 'Material', isRequired: true },
          { id: 'mb_nightstands_hardware', name: 'Hardware', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 800,
        leadTimeWeeks: 10
      },
      {
        id: 'mb_dresser',
        name: 'Dresser',
        category: 'FURNITURE',
        isRequired: false,
        isStandard: false,
        subItems: [
          { id: 'mb_dresser_size', name: 'Size', isRequired: true },
          { id: 'mb_dresser_material', name: 'Material', isRequired: true },
          { id: 'mb_dresser_hardware', name: 'Hardware', isRequired: true }
        ],
        priority: 'medium',
        estimatedPrice: 1500,
        leadTimeWeeks: 12
      },
      {
        id: 'mb_table_lamps',
        name: 'Table Lamps (Set of 2)',
        category: 'LIGHTING',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'mb_lamps_base', name: 'Base Material', isRequired: true },
          { id: 'mb_lamps_shade', name: 'Shade', isRequired: true },
          { id: 'mb_lamps_bulb', name: 'Bulb Type', isRequired: true }
        ],
        conditionalOn: ['mb_nightstands'],
        priority: 'high',
        estimatedPrice: 400,
        leadTimeWeeks: 6
      },
      {
        id: 'mb_chandelier',
        name: 'Chandelier/Ceiling Light',
        category: 'LIGHTING',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'mb_chandelier_style', name: 'Style', isRequired: true },
          { id: 'mb_chandelier_size', name: 'Size', isRequired: true },
          { id: 'mb_chandelier_finish', name: 'Finish', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 1200,
        leadTimeWeeks: 8
      },
      {
        id: 'mb_area_rug',
        name: 'Area Rug',
        category: 'TEXTILES',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'mb_rug_size', name: 'Size', isRequired: true },
          { id: 'mb_rug_material', name: 'Material', isRequired: true },
          { id: 'mb_rug_pattern', name: 'Pattern/Color', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 800,
        leadTimeWeeks: 4
      },
      {
        id: 'mb_window_treatments',
        name: 'Window Treatments',
        category: 'TEXTILES',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'mb_window_type', name: 'Type (Curtains/Blinds)', isRequired: true },
          { id: 'mb_window_fabric', name: 'Fabric/Material', isRequired: true },
          { id: 'mb_window_hardware', name: 'Hardware', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 600,
        leadTimeWeeks: 6
      },
      {
        id: 'mb_mirror',
        name: 'Mirror',
        category: 'ACCESSORIES',
        isRequired: false,
        isStandard: false,
        subItems: [
          { id: 'mb_mirror_size', name: 'Size', isRequired: true },
          { id: 'mb_mirror_frame', name: 'Frame Style', isRequired: true }
        ],
        priority: 'medium',
        estimatedPrice: 300,
        leadTimeWeeks: 4
      },
      {
        id: 'mb_artwork',
        name: 'Artwork',
        category: 'ACCESSORIES',
        isRequired: false,
        isStandard: true,
        priority: 'low',
        estimatedPrice: 500,
        leadTimeWeeks: 2
      }
    ],
    completionCriteria: {
      requiredItemsCount: 6,
      requiredCategories: ['FURNITURE', 'LIGHTING', 'TEXTILES'],
      customMessage: 'Master bedroom requires bed, lighting, and window treatments as minimum'
    }
  },

  BOYS_ROOM: {
    roomType: 'BOYS_ROOM',
    displayName: 'Boys Room',
    categories: [FFE_CATEGORIES.FURNITURE, FFE_CATEGORIES.LIGHTING, FFE_CATEGORIES.TEXTILES, FFE_CATEGORIES.ACCESSORIES],
    items: [
      {
        id: 'br_bed_frame',
        name: 'Bed Frame',
        category: 'FURNITURE',
        description: 'Twin, full, or bunk bed frame',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'br_bed_size', name: 'Size', isRequired: true },
          { id: 'br_bed_style', name: 'Style', isRequired: true },
          { id: 'br_bed_material', name: 'Material', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 800,
        leadTimeWeeks: 8
      },
      {
        id: 'br_desk',
        name: 'Study Desk',
        category: 'FURNITURE',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'br_desk_size', name: 'Size', isRequired: true },
          { id: 'br_desk_material', name: 'Material', isRequired: true },
          { id: 'br_desk_storage', name: 'Storage Features', isRequired: false }
        ],
        priority: 'high',
        estimatedPrice: 600,
        leadTimeWeeks: 6
      },
      {
        id: 'br_chair',
        name: 'Desk Chair',
        category: 'FURNITURE',
        isRequired: true,
        isStandard: false,
        conditionalOn: ['br_desk'],
        subItems: [
          { id: 'br_chair_style', name: 'Style', isRequired: true },
          { id: 'br_chair_material', name: 'Material', isRequired: true },
          { id: 'br_chair_adjustable', name: 'Adjustability', isRequired: false }
        ],
        priority: 'high',
        estimatedPrice: 200,
        leadTimeWeeks: 4
      },
      {
        id: 'br_storage',
        name: 'Storage Solution',
        category: 'FURNITURE',
        description: 'Dresser, bookshelf, or toy storage',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'br_storage_type', name: 'Type', isRequired: true },
          { id: 'br_storage_size', name: 'Size', isRequired: true },
          { id: 'br_storage_material', name: 'Material', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 700,
        leadTimeWeeks: 8
      },
      {
        id: 'br_ceiling_light',
        name: 'Ceiling Light',
        category: 'LIGHTING',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'br_ceiling_style', name: 'Style', isRequired: true },
          { id: 'br_ceiling_size', name: 'Size', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 300,
        leadTimeWeeks: 4
      },
      {
        id: 'br_desk_lamp',
        name: 'Desk Lamp',
        category: 'LIGHTING',
        isRequired: true,
        isStandard: true,
        conditionalOn: ['br_desk'],
        priority: 'high',
        estimatedPrice: 80,
        leadTimeWeeks: 2
      },
      {
        id: 'br_area_rug',
        name: 'Area Rug',
        category: 'TEXTILES',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'br_rug_size', name: 'Size', isRequired: true },
          { id: 'br_rug_material', name: 'Material', isRequired: true },
          { id: 'br_rug_design', name: 'Design/Theme', isRequired: true }
        ],
        priority: 'medium',
        estimatedPrice: 200,
        leadTimeWeeks: 3
      },
      {
        id: 'br_window_treatments',
        name: 'Window Treatments',
        category: 'TEXTILES',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'br_window_type', name: 'Type', isRequired: true },
          { id: 'br_window_color', name: 'Color/Pattern', isRequired: true },
          { id: 'br_window_blackout', name: 'Blackout Feature', isRequired: false }
        ],
        priority: 'high',
        estimatedPrice: 250,
        leadTimeWeeks: 4
      }
    ],
    completionCriteria: {
      requiredItemsCount: 6,
      requiredCategories: ['FURNITURE', 'LIGHTING'],
      customMessage: 'Boys room needs bed, desk, storage, and lighting as essentials'
    }
  },

  DINING_ROOM: {
    roomType: 'DINING_ROOM',
    displayName: 'Dining Room',
    categories: [FFE_CATEGORIES.FURNITURE, FFE_CATEGORIES.LIGHTING, FFE_CATEGORIES.TEXTILES, FFE_CATEGORIES.ACCESSORIES],
    items: [
      {
        id: 'dr_dining_table',
        name: 'Dining Table',
        category: 'FURNITURE',
        description: 'Main dining table for the room',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'dr_table_shape', name: 'Shape', isRequired: true },
          { id: 'dr_table_size', name: 'Size (seats)', isRequired: true },
          { id: 'dr_table_material', name: 'Material', isRequired: true },
          { id: 'dr_table_finish', name: 'Finish', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 2500,
        leadTimeWeeks: 12
      },
      {
        id: 'dr_dining_chairs',
        name: 'Dining Chairs',
        category: 'FURNITURE',
        description: 'Set of dining chairs',
        isRequired: true,
        isStandard: false,
        conditionalOn: ['dr_dining_table'],
        subItems: [
          { id: 'dr_chairs_style', name: 'Style', isRequired: true },
          { id: 'dr_chairs_material', name: 'Material', isRequired: true },
          { id: 'dr_chairs_upholstery', name: 'Upholstery', isRequired: false },
          { id: 'dr_chairs_quantity', name: 'Quantity', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 1800,
        leadTimeWeeks: 10
      },
      {
        id: 'dr_sideboard',
        name: 'Sideboard/Buffet',
        category: 'FURNITURE',
        description: 'Storage and serving furniture',
        isRequired: false,
        isStandard: false,
        subItems: [
          { id: 'dr_sideboard_size', name: 'Size', isRequired: true },
          { id: 'dr_sideboard_style', name: 'Style', isRequired: true },
          { id: 'dr_sideboard_material', name: 'Material', isRequired: true },
          { id: 'dr_sideboard_hardware', name: 'Hardware', isRequired: true }
        ],
        priority: 'medium',
        estimatedPrice: 1500,
        leadTimeWeeks: 8
      },
      {
        id: 'dr_chandelier',
        name: 'Chandelier',
        category: 'LIGHTING',
        description: 'Main dining room lighting fixture',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'dr_chandelier_style', name: 'Style', isRequired: true },
          { id: 'dr_chandelier_size', name: 'Size', isRequired: true },
          { id: 'dr_chandelier_material', name: 'Material/Finish', isRequired: true },
          { id: 'dr_chandelier_bulbs', name: 'Bulb Type', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 2000,
        leadTimeWeeks: 8
      },
      {
        id: 'dr_sconces',
        name: 'Wall Sconces',
        category: 'LIGHTING',
        description: 'Supplementary wall lighting',
        isRequired: false,
        isStandard: false,
        subItems: [
          { id: 'dr_sconces_style', name: 'Style', isRequired: true },
          { id: 'dr_sconces_quantity', name: 'Quantity', isRequired: true },
          { id: 'dr_sconces_finish', name: 'Finish', isRequired: true }
        ],
        priority: 'medium',
        estimatedPrice: 400,
        leadTimeWeeks: 6
      },
      {
        id: 'dr_area_rug',
        name: 'Area Rug',
        category: 'TEXTILES',
        description: 'Under-table area rug',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'dr_rug_size', name: 'Size', isRequired: true },
          { id: 'dr_rug_material', name: 'Material', isRequired: true },
          { id: 'dr_rug_pattern', name: 'Pattern/Color', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 1200,
        leadTimeWeeks: 6
      },
      {
        id: 'dr_window_treatments',
        name: 'Window Treatments',
        category: 'TEXTILES',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'dr_window_type', name: 'Type', isRequired: true },
          { id: 'dr_window_fabric', name: 'Fabric', isRequired: true },
          { id: 'dr_window_hardware', name: 'Hardware', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 800,
        leadTimeWeeks: 6
      },
      {
        id: 'dr_artwork',
        name: 'Artwork',
        category: 'ACCESSORIES',
        isRequired: false,
        isStandard: true,
        priority: 'medium',
        estimatedPrice: 600,
        leadTimeWeeks: 4
      },
      {
        id: 'dr_centerpiece',
        name: 'Table Centerpiece',
        category: 'ACCESSORIES',
        isRequired: false,
        isStandard: true,
        conditionalOn: ['dr_dining_table'],
        priority: 'low',
        estimatedPrice: 150,
        leadTimeWeeks: 2
      }
    ],
    completionCriteria: {
      requiredItemsCount: 4,
      requiredCategories: ['FURNITURE', 'LIGHTING'],
      customMessage: 'Dining room requires table, chairs, lighting, and area rug as minimum'
    }
  },

  MASTER_BATHROOM: {
    roomType: 'MASTER_BATHROOM',
    displayName: 'Master Bathroom',
    categories: [FFE_CATEGORIES.FURNITURE, FFE_CATEGORIES.LIGHTING, FFE_CATEGORIES.HARDWARE, FFE_CATEGORIES.FINISHES, FFE_CATEGORIES.PLUMBING, FFE_CATEGORIES.ACCESSORIES],
    items: [
      {
        id: 'mb_vanity',
        name: 'Double Vanity',
        category: 'FURNITURE',
        description: 'Master bathroom vanity cabinet',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'mb_vanity_size', name: 'Size', isRequired: true },
          { id: 'mb_vanity_material', name: 'Cabinet Material', isRequired: true },
          { id: 'mb_vanity_finish', name: 'Finish', isRequired: true },
          { id: 'mb_vanity_countertop', name: 'Countertop Material', isRequired: true },
          { id: 'mb_vanity_sinks', name: 'Sink Style', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 3500,
        leadTimeWeeks: 12
      },
      {
        id: 'mb_mirrors',
        name: 'Vanity Mirrors (Set of 2)',
        category: 'ACCESSORIES',
        isRequired: true,
        isStandard: false,
        conditionalOn: ['mb_vanity'],
        subItems: [
          { id: 'mb_mirrors_size', name: 'Size', isRequired: true },
          { id: 'mb_mirrors_frame', name: 'Frame Style', isRequired: true },
          { id: 'mb_mirrors_mounting', name: 'Mounting Type', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 600,
        leadTimeWeeks: 6
      },
      {
        id: 'mb_vanity_sconces',
        name: 'Vanity Sconces',
        category: 'LIGHTING',
        isRequired: true,
        isStandard: false,
        conditionalOn: ['mb_vanity'],
        subItems: [
          { id: 'mb_sconces_style', name: 'Style', isRequired: true },
          { id: 'mb_sconces_finish', name: 'Finish', isRequired: true },
          { id: 'mb_sconces_quantity', name: 'Quantity', isRequired: true },
          { id: 'mb_sconces_bulb', name: 'Bulb Type', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 800,
        leadTimeWeeks: 8
      },
      {
        id: 'mb_shower',
        name: 'Shower System',
        category: 'PLUMBING',
        description: 'Complete shower system',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'mb_shower_head', name: 'Showerhead', isRequired: true },
          { id: 'mb_shower_valve', name: 'Valve System', isRequired: true },
          { id: 'mb_shower_controls', name: 'Controls', isRequired: true },
          { id: 'mb_shower_handheld', name: 'Handheld Shower', isRequired: false }
        ],
        priority: 'high',
        estimatedPrice: 1200,
        leadTimeWeeks: 10
      },
      {
        id: 'mb_bathtub',
        name: 'Bathtub',
        category: 'PLUMBING',
        isRequired: false,
        isStandard: false,
        subItems: [
          { id: 'mb_tub_type', name: 'Tub Type', isRequired: true },
          { id: 'mb_tub_material', name: 'Material', isRequired: true },
          { id: 'mb_tub_faucet', name: 'Tub Filler', isRequired: true }
        ],
        priority: 'medium',
        estimatedPrice: 2500,
        leadTimeWeeks: 12
      },
      {
        id: 'mb_tile',
        name: 'Tile Selection',
        category: 'FINISHES',
        description: 'Floor and wall tiles',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'mb_floor_tile', name: 'Floor Tile', isRequired: true },
          { id: 'mb_wall_tile', name: 'Wall/Shower Tile', isRequired: true },
          { id: 'mb_trim_tile', name: 'Trim/Border Tile', isRequired: false },
          { id: 'mb_grout', name: 'Grout Color', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 1800,
        leadTimeWeeks: 6
      },
      {
        id: 'mb_hardware',
        name: 'Hardware Package',
        category: 'HARDWARE',
        description: 'Towel bars, hooks, and accessories',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'mb_towel_bars', name: 'Towel Bars', isRequired: true },
          { id: 'mb_hooks', name: 'Hooks', isRequired: true },
          { id: 'mb_toilet_paper', name: 'Toilet Paper Holder', isRequired: true },
          { id: 'mb_grab_bars', name: 'Grab Bars', isRequired: false }
        ],
        priority: 'high',
        estimatedPrice: 400,
        leadTimeWeeks: 4
      },
      {
        id: 'mb_ceiling_light',
        name: 'Ceiling Light',
        category: 'LIGHTING',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'mb_ceiling_style', name: 'Style', isRequired: true },
          { id: 'mb_ceiling_finish', name: 'Finish', isRequired: true },
          { id: 'mb_ceiling_fan', name: 'Fan Included', isRequired: false }
        ],
        priority: 'high',
        estimatedPrice: 300,
        leadTimeWeeks: 6
      }
    ],
    completionCriteria: {
      requiredItemsCount: 6,
      requiredCategories: ['FURNITURE', 'LIGHTING', 'PLUMBING', 'FINISHES'],
      customMessage: 'Master bathroom requires vanity, lighting, plumbing fixtures, and finishes'
    }
  },

  KITCHEN: {
    roomType: 'KITCHEN',
    displayName: 'Kitchen',
    categories: [FFE_CATEGORIES.FURNITURE, FFE_CATEGORIES.LIGHTING, FFE_CATEGORIES.HARDWARE, FFE_CATEGORIES.FINISHES, FFE_CATEGORIES.APPLIANCES],
    items: [
      {
        id: 'k_cabinets',
        name: 'Kitchen Cabinets',
        category: 'FURNITURE',
        description: 'Upper and lower kitchen cabinets',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'k_cabinet_style', name: 'Cabinet Style', isRequired: true },
          { id: 'k_cabinet_material', name: 'Cabinet Material', isRequired: true },
          { id: 'k_cabinet_finish', name: 'Finish', isRequired: true },
          { id: 'k_cabinet_layout', name: 'Layout Configuration', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 15000,
        leadTimeWeeks: 16
      },
      {
        id: 'k_countertops',
        name: 'Countertops',
        category: 'FINISHES',
        isRequired: true,
        isStandard: false,
        conditionalOn: ['k_cabinets'],
        subItems: [
          { id: 'k_counter_material', name: 'Material', isRequired: true },
          { id: 'k_counter_edge', name: 'Edge Profile', isRequired: true },
          { id: 'k_counter_backsplash', name: 'Backsplash Height', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 4500,
        leadTimeWeeks: 8
      },
      {
        id: 'k_backsplash',
        name: 'Backsplash Tile',
        category: 'FINISHES',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'k_backsplash_material', name: 'Tile Material', isRequired: true },
          { id: 'k_backsplash_pattern', name: 'Pattern/Layout', isRequired: true },
          { id: 'k_backsplash_grout', name: 'Grout Color', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 1200,
        leadTimeWeeks: 6
      },
      {
        id: 'k_cabinet_hardware',
        name: 'Cabinet Hardware',
        category: 'HARDWARE',
        isRequired: true,
        isStandard: false,
        conditionalOn: ['k_cabinets'],
        subItems: [
          { id: 'k_hardware_style', name: 'Style', isRequired: true },
          { id: 'k_hardware_finish', name: 'Finish', isRequired: true },
          { id: 'k_hardware_type', name: 'Handle vs Knob', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 800,
        leadTimeWeeks: 4
      },
      {
        id: 'k_pendant_lights',
        name: 'Pendant Lights',
        category: 'LIGHTING',
        description: 'Island or counter pendant lighting',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'k_pendant_style', name: 'Style', isRequired: true },
          { id: 'k_pendant_quantity', name: 'Quantity', isRequired: true },
          { id: 'k_pendant_finish', name: 'Finish', isRequired: true },
          { id: 'k_pendant_bulb', name: 'Bulb Type', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 600,
        leadTimeWeeks: 6
      },
      {
        id: 'k_under_cabinet',
        name: 'Under Cabinet Lighting',
        category: 'LIGHTING',
        isRequired: false,
        isStandard: false,
        conditionalOn: ['k_cabinets'],
        subItems: [
          { id: 'k_under_type', name: 'Type (LED Strip/Puck)', isRequired: true },
          { id: 'k_under_color', name: 'Color Temperature', isRequired: true }
        ],
        priority: 'medium',
        estimatedPrice: 400,
        leadTimeWeeks: 4
      },
      {
        id: 'k_sink',
        name: 'Kitchen Sink',
        category: 'APPLIANCES',
        isRequired: true,
        isStandard: false,
        subItems: [
          { id: 'k_sink_style', name: 'Style (Undermount/Farmhouse)', isRequired: true },
          { id: 'k_sink_material', name: 'Material', isRequired: true },
          { id: 'k_sink_size', name: 'Size/Configuration', isRequired: true }
        ],
        priority: 'high',
        estimatedPrice: 800,
        leadTimeWeeks: 6
      },
      {
        id: 'k_faucet',
        name: 'Kitchen Faucet',
        category: 'HARDWARE',
        isRequired: true,
        isStandard: false,
        conditionalOn: ['k_sink'],
        subItems: [
          { id: 'k_faucet_style', name: 'Style', isRequired: true },
          { id: 'k_faucet_finish', name: 'Finish', isRequired: true },
          { id: 'k_faucet_features', name: 'Special Features', isRequired: false }
        ],
        priority: 'high',
        estimatedPrice: 500,
        leadTimeWeeks: 4
      },
      {
        id: 'k_bar_stools',
        name: 'Bar Stools',
        category: 'FURNITURE',
        isRequired: false,
        isStandard: false,
        subItems: [
          { id: 'k_stool_style', name: 'Style', isRequired: true },
          { id: 'k_stool_height', name: 'Height', isRequired: true },
          { id: 'k_stool_material', name: 'Material', isRequired: true },
          { id: 'k_stool_quantity', name: 'Quantity', isRequired: true }
        ],
        priority: 'medium',
        estimatedPrice: 800,
        leadTimeWeeks: 6
      }
    ],
    completionCriteria: {
      requiredItemsCount: 7,
      requiredCategories: ['FURNITURE', 'FINISHES', 'HARDWARE', 'LIGHTING'],
      customMessage: 'Kitchen requires cabinets, countertops, backsplash, hardware, and lighting'
    }
  }
}

// Helper functions
export function getRoomFFEConfig(roomType: string): RoomFFEConfig | null {
  return ROOM_FFE_CONFIGS[roomType] || null
}

export function getFFEItemsByCategory(roomType: string, category: string): FFEItemTemplate[] {
  const config = getRoomFFEConfig(roomType)
  return config?.items.filter(item => item.category === category) || []
}

export function getRequiredFFEItems(roomType: string): FFEItemTemplate[] {
  const config = getRoomFFEConfig(roomType)
  return config?.items.filter(item => item.isRequired) || []
}

export function calculateFFECompletionStatus(roomType: string, completedItems: string[]): {
  isComplete: boolean
  progress: number
  missingRequired: string[]
  message: string
} {
  const config = getRoomFFEConfig(roomType)
  if (!config) {
    return {
      isComplete: false,
      progress: 0,
      missingRequired: [],
      message: 'Unknown room type'
    }
  }

  const requiredItems = getRequiredFFEItems(roomType)
  const completedRequiredItems = requiredItems.filter(item => 
    completedItems.includes(item.id)
  )
  
  const missingRequired = requiredItems
    .filter(item => !completedItems.includes(item.id))
    .map(item => item.name)

  const progress = Math.round((completedRequiredItems.length / requiredItems.length) * 100)
  const isComplete = progress >= 80 && missingRequired.length === 0

  return {
    isComplete,
    progress,
    missingRequired,
    message: isComplete 
      ? `${config.displayName} FFE phase is complete!`
      : `${missingRequired.length} required items remaining`
  }
}
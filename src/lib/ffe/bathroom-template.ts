// Enhanced Bathroom FFE Template with Complete Checklist System
// Supports: ✅ Included, 🚫 Not Needed, ⏳ Pending states
// Standard vs Custom logic with conditional dependencies

export interface FFESubItem {
  id: string
  name: string
  type: 'selection' | 'input' | 'checkbox' | 'color' | 'material' | 'measurement'
  options?: string[]
  isRequired?: boolean
  placeholder?: string
  dependsOn?: string[] // Other sub-items this depends on
  unit?: string // For measurements (e.g., 'inches', 'sq ft')
}

export interface FFEItemTemplate {
  id: string
  name: string
  category: string
  itemType: 'base' | 'standard_or_custom' | 'custom_only' | 'conditional'
  isRequired: boolean
  order: number
  
  // Standard/Custom configuration
  hasStandardOption: boolean
  hasCustomOption: boolean
  
  // Standard option - single selection
  standardConfig?: {
    description: string
    options?: string[]
    allowCustomInput?: boolean
  }
  
  // Custom option - multiple sub-items
  customConfig?: {
    description: string
    subItems: FFESubItem[]
  }
  
  // Conditional display
  showWhen?: {
    itemId: string
    selectionType?: 'standard' | 'custom'
    value?: string
  }

  // Default state
  defaultState?: 'pending' | 'included' | 'not_needed'
}

export interface FFERoomTemplate {
  roomType: string
  name: string
  categories: {
    [categoryName: string]: FFEItemTemplate[]
  }
}

// Complete Bathroom FFE Template
export const BATHROOM_TEMPLATE: FFERoomTemplate = {
  roomType: 'bathroom',
  name: 'Bathroom',
  categories: {
    'Base Finishes': [
      {
        id: 'floor_finish',
        name: 'Floor Finish',
        category: 'Base Finishes',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 1,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'pending',
        standardConfig: {
          description: 'Select from standard floor options',
          options: [
            'Porcelain Tile - 12x24',
            'Ceramic Tile - 12x12', 
            'Natural Stone - Marble',
            'Natural Stone - Travertine',
            'Luxury Vinyl Plank',
            'Heated Floor System + Tile'
          ]
        },
        customConfig: {
          description: 'Custom floor specification',
          subItems: [
            {
              id: 'material',
              name: 'Material Type',
              type: 'selection',
              options: ['Porcelain', 'Ceramic', 'Natural Stone', 'Luxury Vinyl', 'Concrete', 'Wood'],
              isRequired: true
            },
            {
              id: 'stone_type',
              name: 'Stone Type',
              type: 'selection',
              options: ['Marble', 'Travertine', 'Limestone', 'Slate', 'Granite'],
              dependsOn: ['material'],
              isRequired: true
            },
            {
              id: 'tile_size',
              name: 'Tile Size',
              type: 'selection', 
              options: ['2x2 Mosaic', '4x4', '6x6', '12x12', '12x24', '24x24', 'Large Format 24x48'],
              dependsOn: ['material'],
              isRequired: true
            },
            {
              id: 'color',
              name: 'Color/Finish',
              type: 'color',
              isRequired: true
            },
            {
              id: 'heated_floor',
              name: 'Heated Floor System',
              type: 'checkbox',
              options: ['Include heated floor system'],
              isRequired: false
            },
            {
              id: 'square_footage',
              name: 'Square Footage',
              type: 'measurement',
              unit: 'sq ft',
              isRequired: true
            }
          ]
        }
      },
      {
        id: 'wall_finish',
        name: 'Wall Finish',
        category: 'Base Finishes',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 2,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'pending',
        standardConfig: {
          description: 'Select standard wall finish',
          options: [
            'Paint - Satin Finish',
            'Subway Tile - White 3x6',
            'Natural Stone - Marble Slab',
            'Porcelain Tile - Large Format',
            'Wallpaper - Moisture Resistant'
          ]
        },
        customConfig: {
          description: 'Custom wall finish specification',
          subItems: [
            {
              id: 'primary_material',
              name: 'Primary Material',
              type: 'selection',
              options: ['Paint', 'Tile', 'Natural Stone', 'Wallpaper', 'Wood Paneling', 'Mixed Materials'],
              isRequired: true
            },
            {
              id: 'paint_type',
              name: 'Paint Type',
              type: 'selection',
              options: ['Satin', 'Semi-Gloss', 'Gloss', 'Eggshell'],
              dependsOn: ['primary_material'],
              isRequired: true
            },
            {
              id: 'paint_color',
              name: 'Paint Color',
              type: 'color',
              dependsOn: ['primary_material'],
              isRequired: true
            },
            {
              id: 'tile_type',
              name: 'Tile Type',
              type: 'selection',
              options: ['Subway', 'Hexagon', 'Square', 'Rectangular', 'Mosaic', 'Large Format'],
              dependsOn: ['primary_material'],
              isRequired: true
            },
            {
              id: 'tile_size',
              name: 'Tile Size',
              type: 'selection',
              options: ['2x2', '3x6', '4x4', '6x6', '4x12', '12x24'],
              dependsOn: ['primary_material'],
              isRequired: true
            },
            {
              id: 'accent_wall',
              name: 'Accent Wall Treatment',
              type: 'checkbox',
              options: ['Include accent wall with different material'],
              isRequired: false
            },
            {
              id: 'wall_height',
              name: 'Tile/Material Height',
              type: 'selection',
              options: ['Wainscot (36")', 'Half Wall (48")', 'Two-thirds (60")', 'Full Height', 'Ceiling'],
              dependsOn: ['primary_material'],
              isRequired: true
            }
          ]
        }
      },
      {
        id: 'ceiling_finish',
        name: 'Ceiling Finish',
        category: 'Base Finishes',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 3,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'pending',
        standardConfig: {
          description: 'Select standard ceiling finish',
          options: [
            'Paint - Flat White',
            'Paint - Semi-Gloss White',
            'Moisture-Resistant Drywall + Paint'
          ]
        },
        customConfig: {
          description: 'Custom ceiling specification',
          subItems: [
            {
              id: 'material',
              name: 'Ceiling Material',
              type: 'selection',
              options: ['Painted Drywall', 'Plaster', 'Wood Planks', 'Tile', 'Metal'],
              isRequired: true
            },
            {
              id: 'paint_finish',
              name: 'Paint Finish',
              type: 'selection',
              options: ['Flat', 'Satin', 'Semi-Gloss'],
              dependsOn: ['material'],
              isRequired: true
            },
            {
              id: 'color',
              name: 'Color',
              type: 'color',
              isRequired: true
            },
            {
              id: 'special_features',
              name: 'Special Features',
              type: 'checkbox',
              options: ['Coffered Detail', 'Tray Ceiling', 'Exposed Beams', 'Moisture Barrier'],
              isRequired: false
            }
          ]
        }
      },
      {
        id: 'trim_baseboards',
        name: 'Trim & Baseboards',
        category: 'Base Finishes',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 4,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'pending',
        standardConfig: {
          description: 'Standard trim package',
          options: [
            'Painted Wood - 3.5" Baseboard',
            'Painted Wood - 5.5" Baseboard + Crown',
            'Tile Baseboard - Matching Floor'
          ]
        },
        customConfig: {
          description: 'Custom trim specification',
          subItems: [
            {
              id: 'baseboard_material',
              name: 'Baseboard Material',
              type: 'selection',
              options: ['Wood', 'MDF', 'Tile', 'Stone', 'Metal'],
              isRequired: true
            },
            {
              id: 'baseboard_height',
              name: 'Baseboard Height',
              type: 'selection',
              options: ['3"', '3.5"', '4.5"', '5.5"', '6"', 'Custom'],
              isRequired: true
            },
            {
              id: 'crown_molding',
              name: 'Crown Molding',
              type: 'checkbox',
              options: ['Include crown molding'],
              isRequired: false
            },
            {
              id: 'door_trim',
              name: 'Door & Window Trim',
              type: 'selection',
              options: ['2.5" Casing', '3.5" Casing', '4.5" Casing', 'Craftsman Style', 'Modern Flat'],
              isRequired: true
            },
            {
              id: 'finish',
              name: 'Trim Finish',
              type: 'selection',
              options: ['Painted White', 'Painted Custom Color', 'Stained Wood', 'Natural Wood'],
              isRequired: true
            }
          ]
        }
      }
    ],
    'Fixtures': [
      {
        id: 'toilet',
        name: 'Toilet',
        category: 'Fixtures',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 1,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'pending',
        standardConfig: {
          description: 'Standard floor-mounted toilet',
          options: [
            'Standard Two-Piece - White',
            'One-Piece Toilet - White',
            'Comfort Height Two-Piece',
            'Elongated Bowl Two-Piece'
          ]
        },
        customConfig: {
          description: 'Wall-mounted toilet system with carrier',
          subItems: [
            {
              id: 'carrier_system',
              name: 'Carrier System',
              type: 'selection',
              options: ['Geberit Duofix', 'TOTO In-Wall Tank', 'Kohler In-Wall', 'Grohe Rapid SL'],
              isRequired: true
            },
            {
              id: 'flush_plate',
              name: 'Flush Plate',
              type: 'selection',
              options: ['Chrome Dual Flush', 'Matte Black Dual Flush', 'White Dual Flush', 'Brass Dual Flush', 'Custom Color Match'],
              isRequired: true
            },
            {
              id: 'toilet_model',
              name: 'Wall-Hung Toilet Model',
              type: 'selection',
              options: ['TOTO CT418F', 'Kohler Veil K-5401', 'Duravit Starck 3', 'Geberit Aquaclean'],
              isRequired: true
            },
            {
              id: 'toilet_finish',
              name: 'Toilet Finish',
              type: 'selection',
              options: ['White', 'Biscuit', 'Black', 'Custom Color'],
              isRequired: true
            },
            {
              id: 'seat_type',
              name: 'Toilet Seat',
              type: 'selection',
              options: ['Standard Soft-Close', 'Heated Seat', 'Bidet Seat - Basic', 'Bidet Seat - Premium', 'Smart Toilet Integration'],
              isRequired: true
            }
          ]
        }
      },
      {
        id: 'vanity',
        name: 'Vanity',
        category: 'Fixtures',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 2,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'pending',
        standardConfig: {
          description: 'Pre-built vanity options',
          options: [
            '24" Single Sink White Shaker',
            '36" Single Sink White Shaker',
            '48" Single Sink Floating',
            '60" Double Sink White Shaker',
            '72" Double Sink Modern'
          ]
        },
        customConfig: {
          description: 'Custom vanity design',
          subItems: [
            {
              id: 'cabinet_style',
              name: 'Cabinet Style',
              type: 'selection',
              options: ['Shaker', 'Flat Panel', 'Raised Panel', 'Traditional', 'Modern Slab', 'Inset'],
              isRequired: true
            },
            {
              id: 'cabinet_color',
              name: 'Cabinet Color/Finish',
              type: 'color',
              isRequired: true
            },
            {
              id: 'width',
              name: 'Vanity Width',
              type: 'measurement',
              unit: 'inches',
              isRequired: true
            },
            {
              id: 'height',
              name: 'Vanity Height',
              type: 'selection',
              options: ['Standard 32"', 'Comfort 34"', 'Counter Height 36"', 'Custom'],
              isRequired: true
            },
            {
              id: 'mounting',
              name: 'Mounting Style',
              type: 'selection',
              options: ['Floor Mounted', 'Wall Hung/Floating', 'Furniture Legs'],
              isRequired: true
            },
            {
              id: 'countertop',
              name: 'Countertop Material',
              type: 'selection',
              options: ['Quartz', 'Marble', 'Granite', 'Solid Surface', 'Concrete', 'Porcelain Slab'],
              isRequired: true
            },
            {
              id: 'countertop_edge',
              name: 'Countertop Edge',
              type: 'selection',
              options: ['Straight', 'Beveled', 'Bullnose', 'Ogee', 'Waterfall Edge'],
              isRequired: true
            },
            {
              id: 'sink_count',
              name: 'Number of Sinks',
              type: 'selection',
              options: ['Single', 'Double'],
              isRequired: true
            },
            {
              id: 'sink_style',
              name: 'Sink Style',
              type: 'selection',
              options: ['Undermount', 'Vessel', 'Integrated', 'Drop-in', 'Farmhouse'],
              isRequired: true
            },
            {
              id: 'hardware',
              name: 'Cabinet Hardware',
              type: 'selection',
              options: ['Brushed Gold', 'Matte Black', 'Polished Chrome', 'Brushed Nickel', 'Oil Rubbed Bronze', 'Brass'],
              isRequired: true
            },
            {
              id: 'storage_features',
              name: 'Storage Features',
              type: 'checkbox',
              options: ['Soft Close Drawers', 'Pull-Out Shelves', 'Drawer Dividers', 'Medicine Cabinet Integration'],
              isRequired: false
            }
          ]
        }
      },
      {
        id: 'mirror',
        name: 'Mirror',
        category: 'Fixtures',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 3,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'pending',
        standardConfig: {
          description: 'Standard mirror options',
          options: [
            'Frameless Rectangle - 24x36',
            'Frameless Rectangle - 30x42',
            'Round Mirror - 30" Diameter',
            'Medicine Cabinet - Recessed'
          ]
        },
        customConfig: {
          description: 'Custom mirror specification',
          subItems: [
            {
              id: 'mirror_type',
              name: 'Mirror Type',
              type: 'selection',
              options: ['Standard Mirror', 'Medicine Cabinet', 'LED Mirror', 'Smart Mirror'],
              isRequired: true
            },
            {
              id: 'shape',
              name: 'Shape',
              type: 'selection',
              options: ['Rectangle', 'Round', 'Oval', 'Arched', 'Custom Shape'],
              isRequired: true
            },
            {
              id: 'size',
              name: 'Size',
              type: 'measurement',
              unit: 'inches',
              placeholder: 'Width x Height',
              isRequired: true
            },
            {
              id: 'frame',
              name: 'Frame',
              type: 'selection',
              options: ['Frameless', 'Metal Frame', 'Wood Frame', 'Decorative Frame'],
              isRequired: true
            },
            {
              id: 'frame_finish',
              name: 'Frame Finish',
              type: 'selection',
              options: ['Brushed Gold', 'Matte Black', 'Chrome', 'Brass', 'Wood Stain', 'Painted'],
              dependsOn: ['frame'],
              isRequired: true
            },
            {
              id: 'features',
              name: 'Additional Features',
              type: 'checkbox',
              options: ['LED Backlighting', 'Defogging', 'Beveled Edge', 'Magnification Section'],
              isRequired: false
            }
          ]
        }
      },
      {
        id: 'bathtub',
        name: 'Bathtub',
        category: 'Fixtures',
        itemType: 'conditional',
        isRequired: false,
        order: 4,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'not_needed',
        standardConfig: {
          description: 'Standard bathtub options',
          options: [
            'Alcove Tub - 60" Standard',
            'Corner Tub - Acrylic',
            'Freestanding Tub - Modern'
          ]
        },
        customConfig: {
          description: 'Custom bathtub specification',
          subItems: [
            {
              id: 'tub_type',
              name: 'Tub Type',
              type: 'selection',
              options: ['Alcove/Built-in', 'Freestanding', 'Corner', 'Drop-in', 'Undermount'],
              isRequired: true
            },
            {
              id: 'material',
              name: 'Tub Material',
              type: 'selection',
              options: ['Acrylic', 'Fiberglass', 'Cast Iron', 'Stone Resin', 'Copper', 'Natural Stone'],
              isRequired: true
            },
            {
              id: 'size',
              name: 'Tub Size',
              type: 'selection',
              options: ['Standard 60"', 'Large 66"', 'Extra Large 72"', 'Compact 54"', 'Custom Size'],
              isRequired: true
            },
            {
              id: 'features',
              name: 'Features',
              type: 'checkbox',
              options: ['Jets/Whirlpool', 'Air Bath', 'Heated Surface', 'Overflow Drain', 'Built-in Armrests'],
              isRequired: false
            },
            {
              id: 'faucet_location',
              name: 'Faucet Location',
              type: 'selection',
              options: ['Deck Mount', 'Wall Mount', 'Floor Mount', 'Tub Rim'],
              isRequired: true
            }
          ]
        }
      },
      {
        id: 'shower',
        name: 'Shower',
        category: 'Fixtures',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 5,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'pending',
        standardConfig: {
          description: 'Standard shower systems',
          options: [
            'Standard Shower with Glass Door',
            'Walk-in Shower - 36x48',
            'Tub/Shower Combo'
          ]
        },
        customConfig: {
          description: 'Custom shower design',
          subItems: [
            {
              id: 'shower_type',
              name: 'Shower Type',
              type: 'selection',
              options: ['Walk-in Shower', 'Shower Stall', 'Wet Room', 'Steam Shower', 'Tub/Shower Combo'],
              isRequired: true
            },
            {
              id: 'size',
              name: 'Shower Dimensions',
              type: 'measurement',
              unit: 'inches',
              placeholder: 'Width x Depth',
              isRequired: true
            },
            {
              id: 'wall_material',
              name: 'Shower Wall Material',
              type: 'selection',
              options: ['Tile', 'Natural Stone', 'Solid Surface', 'Glass', 'Cultured Marble'],
              isRequired: true
            },
            {
              id: 'floor_material',
              name: 'Shower Floor',
              type: 'selection',
              options: ['Matching Wall Tile', 'Mosaic Tile', 'Natural Stone', 'Linear Drain', 'Custom Pan'],
              isRequired: true
            },
            {
              id: 'door_enclosure',
              name: 'Door/Enclosure',
              type: 'selection',
              options: ['Frameless Glass', 'Semi-Frameless', 'Framed Glass', 'Curved Glass', 'No Door/Open'],
              isRequired: true
            },
            {
              id: 'glass_type',
              name: 'Glass Type',
              type: 'selection',
              options: ['Clear', 'Rain Glass', 'Frosted', 'Tinted', 'Low Iron'],
              dependsOn: ['door_enclosure'],
              isRequired: true
            },
            {
              id: 'shower_system',
              name: 'Shower System',
              type: 'selection',
              options: ['Standard Single Head', 'Rainfall System', 'Multi-Head System', 'Steam System', 'Body Sprays'],
              isRequired: true
            },
            {
              id: 'bench_niche',
              name: 'Built-in Features',
              type: 'checkbox',
              options: ['Built-in Bench', 'Shower Niche', 'Corner Shelves', 'Grab Bars', 'Foot Rest'],
              isRequired: false
            }
          ]
        }
      }
    ],
    'Accessories': [
      {
        id: 'towel_bars',
        name: 'Towel Bars & Rods',
        category: 'Accessories',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 1,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'pending',
        standardConfig: {
          description: 'Standard towel bar package',
          options: [
            'Chrome - 24" Towel Bar + Ring',
            'Brushed Nickel - 30" Bar + Ring',
            'Matte Black - Modern Set'
          ]
        },
        customConfig: {
          description: 'Custom towel bar configuration',
          subItems: [
            {
              id: 'finish',
              name: 'Finish',
              type: 'selection',
              options: ['Chrome', 'Brushed Nickel', 'Matte Black', 'Brushed Gold', 'Oil Rubbed Bronze', 'Brass'],
              isRequired: true
            },
            {
              id: 'main_towel_bar',
              name: 'Main Towel Bar Size',
              type: 'selection',
              options: ['18"', '24"', '30"', '36"', 'Double Bar'],
              isRequired: true
            },
            {
              id: 'towel_ring',
              name: 'Towel Ring',
              type: 'checkbox',
              options: ['Include towel ring'],
              isRequired: false
            },
            {
              id: 'hand_towel_bar',
              name: 'Hand Towel Bar',
              type: 'selection',
              options: ['16" Bar', '18" Bar', 'Ring Only', 'None'],
              isRequired: false
            }
          ]
        }
      },
      {
        id: 'hooks',
        name: 'Hooks',
        category: 'Accessories',
        itemType: 'standard_or_custom',
        isRequired: false,
        order: 2,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'not_needed',
        standardConfig: {
          description: 'Standard hook package',
          options: [
            '2 Single Hooks - Matching Finish',
            '1 Double Hook - Matching Finish',
            'Robe Hook - Matching Finish'
          ]
        },
        customConfig: {
          description: 'Custom hook configuration',
          subItems: [
            {
              id: 'hook_quantity',
              name: 'Number of Hooks',
              type: 'selection',
              options: ['1', '2', '3', '4', '5+'],
              isRequired: true
            },
            {
              id: 'hook_style',
              name: 'Hook Style',
              type: 'selection',
              options: ['Single Hook', 'Double Hook', 'Robe Hook', 'Decorative Hook', 'Multi-Prong'],
              isRequired: true
            },
            {
              id: 'finish',
              name: 'Finish',
              type: 'selection',
              options: ['Chrome', 'Brushed Nickel', 'Matte Black', 'Brushed Gold', 'Oil Rubbed Bronze'],
              isRequired: true
            }
          ]
        }
      },
      {
        id: 'toilet_paper_holder',
        name: 'Toilet Paper Holder',
        category: 'Accessories',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 3,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'pending',
        standardConfig: {
          description: 'Standard toilet paper holder',
          options: [
            'Standard Wall Mount - Chrome',
            'Standard Wall Mount - Brushed Nickel',
            'Recessed - Matching Finish'
          ]
        },
        customConfig: {
          description: 'Custom toilet paper holder',
          subItems: [
            {
              id: 'mount_type',
              name: 'Mount Type',
              type: 'selection',
              options: ['Wall Mount', 'Recessed', 'Free Standing', 'Tank Mount'],
              isRequired: true
            },
            {
              id: 'style',
              name: 'Style',
              type: 'selection',
              options: ['Standard Roller', 'Spring Loaded', 'Covered/Closed', 'Reserve Roll Storage', 'Decorative'],
              isRequired: true
            },
            {
              id: 'finish',
              name: 'Finish',
              type: 'selection',
              options: ['Chrome', 'Brushed Nickel', 'Matte Black', 'Brushed Gold', 'Oil Rubbed Bronze'],
              isRequired: true
            }
          ]
        }
      },
      {
        id: 'towel_warmers',
        name: 'Towel Warmers',
        category: 'Accessories',
        itemType: 'conditional',
        isRequired: false,
        order: 4,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'not_needed',
        standardConfig: {
          description: 'Standard towel warmer options',
          options: [
            'Electric Wall Mount - Chrome',
            'Hydronic Floor Stand - Brushed Nickel'
          ]
        },
        customConfig: {
          description: 'Custom towel warmer system',
          subItems: [
            {
              id: 'power_type',
              name: 'Power Type',
              type: 'selection',
              options: ['Electric', 'Hydronic/Hot Water', 'Dual Fuel'],
              isRequired: true
            },
            {
              id: 'mount_style',
              name: 'Mount Style',
              type: 'selection',
              options: ['Wall Mount', 'Floor Standing', 'Recessed'],
              isRequired: true
            },
            {
              id: 'size',
              name: 'Size',
              type: 'selection',
              options: ['Small (20" W)', 'Medium (24" W)', 'Large (30" W)', 'Extra Large (36" W)'],
              isRequired: true
            },
            {
              id: 'finish',
              name: 'Finish',
              type: 'selection',
              options: ['Chrome', 'Brushed Nickel', 'Matte Black', 'White', 'Stainless Steel'],
              isRequired: true
            },
            {
              id: 'controls',
              name: 'Controls',
              type: 'selection',
              options: ['Basic On/Off', 'Timer', 'Thermostat', 'Smart/WiFi'],
              isRequired: true
            }
          ]
        }
      }
    ],
    'Lighting': [
      {
        id: 'vanity_lighting',
        name: 'Vanity Lighting/Sconces',
        category: 'Lighting',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 1,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'pending',
        standardConfig: {
          description: 'Standard vanity lighting',
          options: [
            '2-Light Chrome Sconces',
            '3-Light Brushed Nickel Bar',
            '2-Light Matte Black Modern Sconces'
          ]
        },
        customConfig: {
          description: 'Custom vanity lighting design',
          subItems: [
            {
              id: 'fixture_type',
              name: 'Fixture Type',
              type: 'selection',
              options: ['Wall Sconces', 'Linear Bath Bar', 'Pendant Lights', 'Backlit Mirror', 'Strip Lighting'],
              isRequired: true
            },
            {
              id: 'quantity',
              name: 'Number of Fixtures',
              type: 'selection',
              options: ['1', '2', '3', '4'],
              isRequired: true
            },
            {
              id: 'finish',
              name: 'Finish',
              type: 'selection',
              options: ['Chrome', 'Brushed Nickel', 'Matte Black', 'Brushed Gold', 'Oil Rubbed Bronze', 'Brass'],
              isRequired: true
            },
            {
              id: 'style',
              name: 'Style',
              type: 'selection',
              options: ['Modern', 'Traditional', 'Transitional', 'Industrial', 'Contemporary', 'Art Deco'],
              isRequired: true
            },
            {
              id: 'light_direction',
              name: 'Light Direction',
              type: 'selection',
              options: ['Up/Down', 'Downlight Only', 'Side Light', 'Ambient', 'Task Focused'],
              isRequired: true
            },
            {
              id: 'dimming',
              name: 'Dimming',
              type: 'checkbox',
              options: ['Include dimming capability'],
              isRequired: false
            }
          ]
        }
      },
      {
        id: 'recessed_lighting',
        name: 'Recessed Lighting/Spots',
        category: 'Lighting',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 2,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'pending',
        standardConfig: {
          description: 'Standard recessed lighting package',
          options: [
            '4 LED Recessed Lights - 4" Trim',
            '6 LED Recessed Lights - 6" Trim',
            '4 Adjustable Spot Lights'
          ]
        },
        customConfig: {
          description: 'Custom recessed lighting layout',
          subItems: [
            {
              id: 'light_count',
              name: 'Number of Lights',
              type: 'selection',
              options: ['2', '4', '6', '8', '10+'],
              isRequired: true
            },
            {
              id: 'light_type',
              name: 'Light Type',
              type: 'selection',
              options: ['Standard Recessed', 'Adjustable Spot', 'Shower Rated', 'IC Rated', 'LED Integrated'],
              isRequired: true
            },
            {
              id: 'size',
              name: 'Light Size',
              type: 'selection',
              options: ['3"', '4"', '5"', '6"', '8"'],
              isRequired: true
            },
            {
              id: 'trim_style',
              name: 'Trim Style',
              type: 'selection',
              options: ['Baffle', 'Reflector', 'Open', 'Pinhole', 'Square', 'Decorative'],
              isRequired: true
            },
            {
              id: 'trim_color',
              name: 'Trim Color',
              type: 'selection',
              options: ['White', 'Black', 'Brushed Nickel', 'Chrome', 'Bronze'],
              isRequired: true
            },
            {
              id: 'zones',
              name: 'Lighting Zones',
              type: 'checkbox',
              options: ['Separate switch for vanity area', 'Separate switch for shower', 'Separate switch for toilet area'],
              isRequired: false
            },
            {
              id: 'dimming',
              name: 'Dimming Controls',
              type: 'checkbox',
              options: ['Include dimming switches'],
              isRequired: false
            }
          ]
        }
      },
      {
        id: 'ambient_lighting',
        name: 'Ambient/LED Lighting',
        category: 'Lighting',
        itemType: 'conditional',
        isRequired: false,
        order: 3,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'not_needed',
        standardConfig: {
          description: 'Standard ambient lighting',
          options: [
            'Under-Cabinet LED Strip',
            'Cove Lighting - Warm White',
            'Toe-Kick LED Lighting'
          ]
        },
        customConfig: {
          description: 'Custom ambient lighting system',
          subItems: [
            {
              id: 'lighting_locations',
              name: 'Lighting Locations',
              type: 'checkbox',
              options: ['Under Vanity', 'Behind Mirror', 'Toe Kick', 'Cove/Ceiling', 'Floor/Step', 'Shower Niche'],
              isRequired: true
            },
            {
              id: 'led_type',
              name: 'LED Type',
              type: 'selection',
              options: ['Strip Lights', 'Tape Lights', 'Rope Lights', 'Linear Fixtures', 'Accent Spots'],
              isRequired: true
            },
            {
              id: 'color_temperature',
              name: 'Color Temperature',
              type: 'selection',
              options: ['Warm White (2700K)', 'Soft White (3000K)', 'Cool White (4000K)', 'Daylight (5000K)', 'Color Changing RGB'],
              isRequired: true
            },
            {
              id: 'controls',
              name: 'Controls',
              type: 'selection',
              options: ['Simple Switch', 'Dimmer Switch', 'Smart Controls', 'Motion Sensor', 'Timer'],
              isRequired: true
            },
            {
              id: 'waterproofing',
              name: 'Waterproof Rating',
              type: 'selection',
              options: ['Basic (Dry Areas)', 'Splash Proof (IP44)', 'Waterproof (IP65)', 'Submersible (IP68)'],
              isRequired: true
            }
          ]
        }
      },
      {
        id: 'exhaust_fan',
        name: 'Exhaust Fan with Light',
        category: 'Lighting',
        itemType: 'standard_or_custom',
        isRequired: true,
        order: 4,
        hasStandardOption: true,
        hasCustomOption: true,
        defaultState: 'pending',
        standardConfig: {
          description: 'Standard exhaust fan with light',
          options: [
            'Standard 80CFM with Light',
            'Quiet 110CFM with LED Light',
            'Premium 150CFM with Night Light'
          ]
        },
        customConfig: {
          description: 'Custom ventilation and lighting',
          subItems: [
            {
              id: 'cfm_rating',
              name: 'CFM Rating',
              type: 'selection',
              options: ['50 CFM', '80 CFM', '110 CFM', '150 CFM', '200+ CFM'],
              isRequired: true
            },
            {
              id: 'noise_level',
              name: 'Noise Level',
              type: 'selection',
              options: ['Ultra Quiet (<0.5 sones)', 'Quiet (<1.0 sones)', 'Standard (<2.0 sones)', 'Basic (>2.0 sones)'],
              isRequired: true
            },
            {
              id: 'features',
              name: 'Additional Features',
              type: 'checkbox',
              options: ['LED Light', 'Night Light', 'Heater', 'Humidity Sensor', 'Motion Sensor', 'Bluetooth Speaker'],
              isRequired: false
            },
            {
              id: 'mounting',
              name: 'Mounting Type',
              type: 'selection',
              options: ['Ceiling Mount', 'Wall Mount', 'Inline/Remote', 'Through Wall'],
              isRequired: true
            },
            {
              id: 'controls',
              name: 'Control Type',
              type: 'selection',
              options: ['Wall Switch', 'Pull Chain', 'Remote Control', 'Smart/WiFi', 'Timer Switch'],
              isRequired: true
            }
          ]
        }
      }
    ]
  }
}

// Enhanced item state types
export type FFEItemState = 'pending' | 'included' | 'not_needed' | 'custom_expanded'

// Helper functions for conditional logic
export function isItemVisible(item: FFEItemTemplate, otherItems: Record<string, any>): boolean {
  if (!item.showWhen) return true
  
  const dependentItem = otherItems[item.showWhen.itemId]
  if (!dependentItem) return false
  
  if (item.showWhen.selectionType) {
    return dependentItem.selectionType === item.showWhen.selectionType
  }
  
  if (item.showWhen.value) {
    return dependentItem.value === item.showWhen.value
  }
  
  return dependentItem.state === 'included' || dependentItem.state === 'custom_expanded'
}

export function getVisibleSubItems(item: FFEItemTemplate, currentSelections?: Record<string, any>): FFESubItem[] {
  if (!item.customConfig) return []
  
  return item.customConfig.subItems.filter(subItem => {
    if (!subItem.dependsOn || !currentSelections) return true
    
    return subItem.dependsOn.some(dependency => {
      const selectedValue = currentSelections[dependency]
      return selectedValue && selectedValue !== ''
    })
  })
}

// Validation helpers
export function validateItemConfiguration(item: FFEItemTemplate, status: any): string[] {
  const errors: string[] = []
  
  if (item.isRequired && status.state !== 'included' && status.state !== 'custom_expanded') {
    errors.push(`${item.name} is required but not included`)
  }
  
  if (status.state === 'custom_expanded' && item.customConfig) {
    const requiredSubItems = item.customConfig.subItems.filter(sub => sub.isRequired)
    
    requiredSubItems.forEach(subItem => {
      const subValue = status.customOptions?.[subItem.id]
      if (!subValue || subValue === '') {
        errors.push(`${item.name}: ${subItem.name} is required`)
      }
    })
  }
  
  return errors
}

// Template registry
export const FFE_ROOM_TEMPLATES: Record<string, FFERoomTemplate> = {
  'bathroom': BATHROOM_TEMPLATE,
  'master_bathroom': BATHROOM_TEMPLATE,
  'family_bathroom': BATHROOM_TEMPLATE,
  'guest_bathroom': BATHROOM_TEMPLATE,
  'powder_room': BATHROOM_TEMPLATE
}

export function getTemplateForRoomType(roomType: string): FFERoomTemplate | undefined {
  const normalizedType = roomType.toLowerCase().replace(/_/g, '_')
  return FFE_ROOM_TEMPLATES[normalizedType]
}
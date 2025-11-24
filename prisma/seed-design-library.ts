import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Universal Design Concept Item Library
// This library applies to ALL room types - Aaron can pick and choose what's relevant per room
const DESIGN_LIBRARY = [
  // FLOORING CATEGORY
  {
    category: 'flooring',
    categoryName: 'Flooring',
    items: [
      { name: 'Hardwood Flooring', icon: 'PanelTop', description: 'Wood plank flooring' },
      { name: 'Engineered Wood', icon: 'PanelTop', description: 'Engineered wood planks' },
      { name: 'Laminate Flooring', icon: 'LayoutGrid', description: 'Laminate floor covering' },
      { name: 'Vinyl Flooring', icon: 'Grid2x2', description: 'Vinyl plank or sheet' },
      { name: 'Tile Flooring', icon: 'Grid3x3', description: 'Ceramic or porcelain tile' },
      { name: 'Stone Flooring', icon: 'Mountain', description: 'Natural stone tiles' },
      { name: 'Carpet', icon: 'SquareStack', description: 'Wall-to-wall carpeting' },
      { name: 'Area Rug', icon: 'RectangleHorizontal', description: 'Accent or area rug' },
      { name: 'Runner Rug', icon: 'Minus', description: 'Hallway runner rug' },
      { name: 'Cork Flooring', icon: 'Layers', description: 'Cork floor tiles' },
      { name: 'Bamboo Flooring', icon: 'PanelTop', description: 'Bamboo planks' },
      { name: 'Padding/Underlayment', icon: 'Layers', description: 'Floor padding' },
    ]
  },
  
  // WALL TREATMENTS CATEGORY
  {
    category: 'wall-treatments',
    categoryName: 'Wall Treatments',
    items: [
      { name: 'Paint Color', icon: 'Paintbrush', description: 'Wall paint selection' },
      { name: 'Accent Wall Paint', icon: 'Paintbrush', description: 'Feature wall color' },
      { name: 'Wallpaper', icon: 'FileImage', description: 'Wall covering' },
      { name: 'Accent Wallpaper', icon: 'FileImage', description: 'Feature wall wallpaper' },
      { name: 'Wall Tile', icon: 'Grid3x3', description: 'Ceramic/porcelain wall tile' },
      { name: 'Wall Paneling', icon: 'Columns', description: 'Wood or decorative paneling' },
      { name: 'Wainscoting', icon: 'Rows', description: 'Lower wall paneling' },
      { name: 'Shiplap', icon: 'Rows', description: 'Horizontal board siding' },
      { name: 'Board & Batten', icon: 'Rows', description: 'Vertical wall treatment' },
      { name: 'Stone Veneer', icon: 'Mountain', description: 'Stone wall cladding' },
      { name: 'Brick Veneer', icon: 'Box', description: 'Brick wall facing' },
    ]
  },
  
  // CEILING CATEGORY
  {
    category: 'ceiling',
    categoryName: 'Ceiling',
    items: [
      { name: 'Ceiling Paint', icon: 'Paintbrush', description: 'Ceiling color' },
      { name: 'Crown Molding', icon: 'Frame', description: 'Decorative ceiling trim' },
      { name: 'Ceiling Medallion', icon: 'Circle', description: 'Decorative ceiling accent' },
      { name: 'Coffered Ceiling', icon: 'Grid3x3', description: 'Recessed panel ceiling' },
      { name: 'Tray Ceiling', icon: 'Square', description: 'Recessed ceiling design' },
      { name: 'Ceiling Beams', icon: 'Minus', description: 'Exposed or decorative beams' },
      { name: 'Ceiling Texture', icon: 'Sparkles', description: 'Textured finish' },
    ]
  },
  
  // FURNITURE CATEGORY
  {
    category: 'furniture',
    categoryName: 'Furniture',
    items: [
      { name: 'Sofa', icon: 'Sofa', description: 'Living room seating' },
      { name: 'Sectional Sofa', icon: 'Sofa', description: 'L-shaped or modular seating' },
      { name: 'Loveseat', icon: 'Sofa', description: 'Two-seat sofa' },
      { name: 'Armchair', icon: 'Armchair', description: 'Accent chair' },
      { name: 'Recliner', icon: 'Armchair', description: 'Reclining chair' },
      { name: 'Wingback Chair', icon: 'Armchair', description: 'High-back accent chair' },
      { name: 'Chaise Lounge', icon: 'Sofa', description: 'Lounging chair' },
      { name: 'Coffee Table', icon: 'Coffee', description: 'Center table' },
      { name: 'End Table', icon: 'Table', description: 'Side table' },
      { name: 'Side Table', icon: 'Table', description: 'Accent table' },
      { name: 'Console Table', icon: 'LayoutDashboard', description: 'Entry or hallway table' },
      { name: 'Sofa Table', icon: 'Table', description: 'Behind-sofa table' },
      { name: 'Dining Table', icon: 'Table', description: 'Main dining surface' },
      { name: 'Dining Chairs', icon: 'Armchair', description: 'Dining seating' },
      { name: 'Dining Bench', icon: 'RectangleHorizontal', description: 'Dining bench seating' },
      { name: 'Bar Stool', icon: 'Armchair', description: 'Counter height seating' },
      { name: 'Counter Stool', icon: 'Armchair', description: 'Kitchen counter seating' },
      { name: 'Bed Frame', icon: 'Bed', description: 'Bedroom bed' },
      { name: 'Headboard', icon: 'RectangleVertical', description: 'Bed headboard' },
      { name: 'Nightstand', icon: 'Table', description: 'Bedside table' },
      { name: 'Dresser', icon: 'Box', description: 'Clothing storage' },
      { name: 'Chest of Drawers', icon: 'Box', description: 'Tall dresser' },
      { name: 'Wardrobe', icon: 'Box', description: 'Clothing armoire' },
      { name: 'Desk', icon: 'Laptop', description: 'Work surface' },
      { name: 'Office Chair', icon: 'Armchair', description: 'Desk chair' },
      { name: 'Bookshelf', icon: 'BookOpen', description: 'Book storage' },
      { name: 'Bookcase', icon: 'BookOpen', description: 'Tall book storage' },
      { name: 'Shelving Unit', icon: 'Rows', description: 'Open shelving' },
      { name: 'TV Stand', icon: 'Tv', description: 'Media console' },
      { name: 'Entertainment Center', icon: 'Tv', description: 'Media storage unit' },
      { name: 'Credenza', icon: 'LayoutDashboard', description: 'Low cabinet' },
      { name: 'Sideboard', icon: 'LayoutDashboard', description: 'Dining room storage' },
      { name: 'Buffet', icon: 'LayoutDashboard', description: 'Serving cabinet' },
      { name: 'China Cabinet', icon: 'Box', description: 'Display cabinet' },
      { name: 'Bench', icon: 'RectangleHorizontal', description: 'Seating bench' },
      { name: 'Ottoman', icon: 'Square', description: 'Footrest or seating' },
      { name: 'Pouf', icon: 'Circle', description: 'Soft ottoman' },
      { name: 'Storage Ottoman', icon: 'Square', description: 'Ottoman with storage' },
      { name: 'Vanity', icon: 'Box', description: 'Bathroom or dressing vanity' },
      { name: 'Vanity Stool', icon: 'Circle', description: 'Vanity seating' },
      { name: 'Kitchen Island', icon: 'Square', description: 'Center kitchen island' },
      { name: 'Kitchen Cart', icon: 'ShoppingCart', description: 'Mobile kitchen storage' },
      { name: 'Bar Cart', icon: 'ShoppingCart', description: 'Beverage cart' },
      { name: 'Coat Rack', icon: 'Columns', description: 'Standing coat storage' },
      { name: 'Hall Tree', icon: 'Columns', description: 'Entryway organizer' },
    ]
  },
  
  // PLUMBING FIXTURES
  {
    category: 'plumbing',
    categoryName: 'Plumbing Fixtures',
    items: [
      { name: 'Toilet', icon: 'CircleDot', description: 'Water closet' },
      { name: 'Vanity & Sink', icon: 'SquareDashed', description: 'Bathroom vanity unit' },
      { name: 'Sink', icon: 'Circle', description: 'Basin or wash basin' },
      { name: 'Faucet', icon: 'Droplets', description: 'Sink faucet' },
      { name: 'Shower', icon: 'Droplets', description: 'Shower system' },
      { name: 'Shower Head', icon: 'Droplet', description: 'Shower fixture' },
      { name: 'Shower Valve', icon: 'CircleDot', description: 'Shower control valve' },
      { name: 'Shower Door', icon: 'RectangleVertical', description: 'Glass shower enclosure' },
      { name: 'Bathtub', icon: 'Bath', description: 'Soaking tub' },
      { name: 'Tub Faucet', icon: 'Droplets', description: 'Bathtub faucet' },
      { name: 'Drain', icon: 'CircleDot', description: 'Plumbing drain' },
      { name: 'Bidet', icon: 'CircleDot', description: 'Bidet fixture' },
      { name: 'Towel Bar', icon: 'Minus', description: 'Towel rack' },
      { name: 'Towel Ring', icon: 'Circle', description: 'Towel ring' },
      { name: 'Robe Hook', icon: 'CircleDot', description: 'Wall hook' },
      { name: 'Toilet Paper Holder', icon: 'Circle', description: 'TP holder' },
      { name: 'Towel Warmer', icon: 'Waves', description: 'Heated towel rack' },
      { name: 'Kitchen Sink', icon: 'RectangleHorizontal', description: 'Kitchen basin' },
      { name: 'Kitchen Faucet', icon: 'Droplets', description: 'Kitchen faucet' },
      { name: 'Laundry Sink', icon: 'Square', description: 'Utility sink' },
      { name: 'Soap Dispenser', icon: 'CircleDot', description: 'Soap dispenser' },
      { name: 'Soap Dish', icon: 'Circle', description: 'Soap dish' },
    ]
  },
  
  // LIGHTING
  {
    category: 'lighting',
    categoryName: 'Lighting',
    items: [
      { name: 'Pendant Light', icon: 'Lightbulb', description: 'Hanging fixture' },
      { name: 'Chandelier', icon: 'Sparkles', description: 'Statement lighting' },
      { name: 'Sconce', icon: 'Lamp', description: 'Wall light' },
      { name: 'Table Lamp', icon: 'LampDesk', description: 'Portable lighting' },
      { name: 'Floor Lamp', icon: 'LampFloor', description: 'Standing lamp' },
      { name: 'Ceiling Light', icon: 'Circle', description: 'Flush mount' },
      { name: 'Recessed Lighting', icon: 'CircleDot', description: 'Can lights' },
      { name: 'Track Lighting', icon: 'Minus', description: 'Adjustable spots' },
      { name: 'Under Cabinet Lighting', icon: 'Lightbulb', description: 'Task lighting' },
      { name: 'Vanity Light', icon: 'Lamp', description: 'Bathroom lighting' },
    ]
  },
  
  // TEXTILES & SOFT GOODS
  {
    category: 'textiles',
    categoryName: 'Textiles & Soft Goods',
    items: [
      { name: 'Curtains', icon: 'PanelTopDashed', description: 'Window treatments' },
      { name: 'Drapes', icon: 'PanelTop', description: 'Heavy window coverings' },
      { name: 'Blinds', icon: 'Minus', description: 'Window blinds' },
      { name: 'Shades', icon: 'RectangleVertical', description: 'Window shades' },
      { name: 'Shutters', icon: 'PanelTopOpen', description: 'Window shutters' },
      { name: 'Curtain Rods', icon: 'Minus', description: 'Drapery hardware' },
      { name: 'Valances', icon: 'RectangleHorizontal', description: 'Decorative top treatment' },
      { name: 'Rug', icon: 'RectangleHorizontal', description: 'Area rug' },
      { name: 'Bedding Set', icon: 'Bed', description: 'Complete bed linens' },
      { name: 'Sheets', icon: 'RectangleHorizontal', description: 'Bed sheets' },
      { name: 'Duvet', icon: 'RectangleHorizontal', description: 'Comforter insert' },
      { name: 'Duvet Cover', icon: 'Square', description: 'Duvet cover' },
      { name: 'Pillows', icon: 'Square', description: 'Bed pillows' },
      { name: 'Throw Pillows', icon: 'Square', description: 'Decorative cushions' },
      { name: 'Throw Blanket', icon: 'RectangleHorizontal', description: 'Accent blanket' },
      { name: 'Bath Towels', icon: 'RectangleVertical', description: 'Bath towels' },
      { name: 'Hand Towels', icon: 'Square', description: 'Hand towels' },
      { name: 'Washcloths', icon: 'Square', description: 'Washcloths' },
      { name: 'Bath Mat', icon: 'RectangleHorizontal', description: 'Bathroom floor mat' },
      { name: 'Shower Curtain', icon: 'RectangleVertical', description: 'Shower curtain' },
      { name: 'Table Runner', icon: 'Minus', description: 'Dining table runner' },
      { name: 'Placemats', icon: 'RectangleHorizontal', description: 'Dining placemats' },
      { name: 'Napkins', icon: 'Square', description: 'Table napkins' },
      { name: 'Upholstery Fabric', icon: 'Palette', description: 'Furniture fabric selection' },
    ]
  },
  
  // DECOR & ACCESSORIES
  {
    category: 'decor',
    categoryName: 'Decor & Accessories',
    items: [
      { name: 'Mirror', icon: 'Frame', description: 'Wall or decorative mirror' },
      { name: 'Artwork', icon: 'Frame', description: 'Wall art or painting' },
      { name: 'Sculpture', icon: 'Box', description: 'Decorative object' },
      { name: 'Vase', icon: 'Wine', description: 'Decorative vessel' },
      { name: 'Plant', icon: 'Leaf', description: 'Indoor greenery' },
      { name: 'Clock', icon: 'Clock', description: 'Wall or table clock' },
      { name: 'Decorative Bowl', icon: 'Circle', description: 'Accent piece' },
      { name: 'Candles', icon: 'Flame', description: 'Decorative candles' },
      { name: 'Photo Frame', icon: 'Frame', description: 'Picture frame' },
      { name: 'Decorative Tray', icon: 'RectangleHorizontal', description: 'Styling tray' },
    ]
  },
  
  // APPLIANCES
  {
    category: 'appliances',
    categoryName: 'Appliances',
    items: [
      { name: 'Refrigerator', icon: 'RectangleVertical', description: 'Kitchen fridge' },
      { name: 'Freezer', icon: 'RectangleVertical', description: 'Standalone freezer' },
      { name: 'Range', icon: 'Flame', description: 'Stove and oven combo' },
      { name: 'Oven', icon: 'Box', description: 'Wall oven' },
      { name: 'Cooktop', icon: 'Flame', description: 'Stovetop' },
      { name: 'Dishwasher', icon: 'Square', description: 'Built-in dishwasher' },
      { name: 'Microwave', icon: 'RectangleHorizontal', description: 'Microwave oven' },
      { name: 'Range Hood', icon: 'Wind', description: 'Ventilation hood' },
      { name: 'Garbage Disposal', icon: 'CircleDot', description: 'Sink disposal unit' },
      { name: 'Wine Cooler', icon: 'Wine', description: 'Wine refrigerator' },
      { name: 'Washer', icon: 'Circle', description: 'Washing machine' },
      { name: 'Dryer', icon: 'Circle', description: 'Clothes dryer' },
      { name: 'Coffee Maker', icon: 'Coffee', description: 'Coffee machine' },
    ]
  },
  
  // HARDWARE & FINISHES
  {
    category: 'hardware',
    categoryName: 'Hardware & Details',
    items: [
      { name: 'Door Handles', icon: 'Grip', description: 'Door lever handles' },
      { name: 'Door Knobs', icon: 'CircleDot', description: 'Door knobs' },
      { name: 'Door Locks', icon: 'Lock', description: 'Door lock hardware' },
      { name: 'Cabinet Hardware', icon: 'Minus', description: 'Cabinet pulls and knobs' },
      { name: 'Cabinet Pulls', icon: 'Grip', description: 'Drawer pulls' },
      { name: 'Cabinet Knobs', icon: 'CircleDot', description: 'Cabinet knobs' },
      { name: 'Drawer Pulls', icon: 'Minus', description: 'Drawer hardware' },
      { name: 'Hinges', icon: 'MoveVertical', description: 'Door hinges' },
      { name: 'Soft Close Hardware', icon: 'CircleDot', description: 'Soft-close mechanism' },
      { name: 'Switch Plates', icon: 'Square', description: 'Light switch covers' },
      { name: 'Outlet Covers', icon: 'Plug', description: 'Electrical outlet plates' },
      { name: 'Curtain Rod', icon: 'Minus', description: 'Drapery hardware' },
      { name: 'Hooks', icon: 'CircleDot', description: 'Wall hooks' },
      { name: 'Door Stops', icon: 'CircleDot', description: 'Door stop hardware' },
    ]
  },
  
  // MATERIALS & FINISHES
  {
    category: 'materials',
    categoryName: 'Materials & Finishes',
    items: [
      { name: 'Paint Color', icon: 'Paintbrush', description: 'Wall paint selection' },
      { name: 'Accent Wall Paint', icon: 'Palette', description: 'Feature wall color' },
      { name: 'Wallpaper', icon: 'Image', description: 'Wall covering' },
      { name: 'Tile', icon: 'Grid3x3', description: 'Floor or wall tile' },
      { name: 'Backsplash', icon: 'Grid2x2', description: 'Kitchen or bath tile' },
      { name: 'Stone', icon: 'Mountain', description: 'Natural stone' },
      { name: 'Countertop', icon: 'RectangleHorizontal', description: 'Surface material' },
      { name: 'Countertop Edge', icon: 'Minus', description: 'Edge profile' },
      { name: 'Cabinetry', icon: 'LayoutGrid', description: 'Kitchen/bath cabinets' },
      { name: 'Cabinet Finish', icon: 'Palette', description: 'Cabinet color/stain' },
      { name: 'Baseboard', icon: 'Minus', description: 'Base trim molding' },
      { name: 'Crown Molding', icon: 'Frame', description: 'Ceiling trim' },
      { name: 'Chair Rail', icon: 'Minus', description: 'Mid-wall molding' },
      { name: 'Door Trim', icon: 'Frame', description: 'Door casing' },
      { name: 'Window Trim', icon: 'Frame', description: 'Window casing' },
    ]
  },
  
  // GENERAL - Plans & Documents
  {
    category: 'general',
    categoryName: 'Plans & Documents',
    items: [
      { name: 'Floor Plans', icon: 'LayoutGrid', description: 'Room layout drawings' },
      { name: 'Elevations', icon: 'Layers', description: 'Wall elevation drawings' },
      { name: 'Sections', icon: 'RectangleVertical', description: 'Section cut drawings' },
      { name: 'Details', icon: 'ZoomIn', description: 'Detail drawings' },
      { name: 'Specifications', icon: 'FileText', description: 'Project specifications' },
      { name: 'Material Schedule', icon: 'ListChecks', description: 'Materials list' },
      { name: 'Finish Schedule', icon: 'Palette', description: 'Finish selections' },
      { name: 'Door Schedule', icon: 'DoorClosed', description: 'Door types and locations' },
      { name: 'Window Schedule', icon: 'SquareDashed', description: 'Window types and locations' },
      { name: 'RCP (Ceiling Plan)', icon: 'Circle', description: 'Reflected ceiling plan' },
      { name: 'Lighting Plan', icon: 'Lightbulb', description: 'Lighting layout' },
      { name: 'Electrical Plan', icon: 'Zap', description: 'Electrical outlets and switches' },
      { name: 'Plumbing Plan', icon: 'Droplets', description: 'Plumbing fixtures and lines' },
    ]
  }
]

async function main() {
  console.log('🎨 Starting Design Concept Library Seed...\n')
  
  let totalCreated = 0
  let totalUpdated = 0
  
  for (const category of DESIGN_LIBRARY) {
    console.log(`📦 Seeding category: ${category.categoryName}`)
    
    let order = 0
    for (const item of category.items) {
      order++
      
      const existingItem = await prisma.designConceptItemLibrary.findFirst({
        where: {
          name: item.name,
          category: category.category
        }
      })
      
      if (existingItem) {
        await prisma.designConceptItemLibrary.update({
          where: { id: existingItem.id },
          data: {
            description: item.description,
            icon: item.icon,
            order,
            isActive: true
          }
        })
        totalUpdated++
        console.log(`  ↻ Updated: ${item.name}`)
      } else {
        await prisma.designConceptItemLibrary.create({
          data: {
            name: item.name,
            category: category.category,
            description: item.description,
            icon: item.icon,
            order,
            isActive: true
          }
        })
        totalCreated++
        console.log(`  ✓ Created: ${item.name}`)
      }
    }
    console.log(`  ${category.items.length} items processed\n`)
  }
  
  // Summary
  console.log('════════════════════════════════════════════════════')
  console.log('✅ Design Concept Library Seed Complete!')
  console.log(`📊 Created: ${totalCreated} items`)
  console.log(`↻ Updated: ${totalUpdated} items`)
  console.log(`📦 Total categories: ${DESIGN_LIBRARY.length}`)
  console.log('════════════════════════════════════════════════════\n')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

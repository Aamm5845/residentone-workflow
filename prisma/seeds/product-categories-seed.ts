import { PrismaClient } from '@prisma/client'

// Default product categories with icons from Lucide
const defaultCategories = [
  {
    name: 'Furniture',
    slug: 'furniture',
    icon: 'Sofa',
    color: '#8B5CF6',
    order: 1,
    children: [
      { name: 'Seating', slug: 'seating', icon: 'Armchair', order: 1 },
      { name: 'Tables', slug: 'tables', icon: 'Table', order: 2 },
      { name: 'Storage', slug: 'storage', icon: 'Archive', order: 3 },
      { name: 'Beds', slug: 'beds', icon: 'Bed', order: 4 },
      { name: 'Desks', slug: 'desks', icon: 'Monitor', order: 5 },
    ]
  },
  {
    name: 'Lighting',
    slug: 'lighting',
    icon: 'Lightbulb',
    color: '#F59E0B',
    order: 2,
    children: [
      { name: 'Pendants', slug: 'pendants', icon: 'Lamp', order: 1 },
      { name: 'Chandeliers', slug: 'chandeliers', icon: 'Sparkles', order: 2 },
      { name: 'Floor Lamps', slug: 'floor-lamps', icon: 'LampFloor', order: 3 },
      { name: 'Table Lamps', slug: 'table-lamps', icon: 'LampDesk', order: 4 },
      { name: 'Wall Sconces', slug: 'wall-sconces', icon: 'LampWallDown', order: 5 },
      { name: 'Recessed', slug: 'recessed', icon: 'Circle', order: 6 },
    ]
  },
  {
    name: 'Textiles',
    slug: 'textiles',
    icon: 'Shirt',
    color: '#EC4899',
    order: 3,
    children: [
      { name: 'Rugs', slug: 'rugs', icon: 'Square', order: 1 },
      { name: 'Curtains & Drapes', slug: 'curtains', icon: 'PanelRight', order: 2 },
      { name: 'Bedding', slug: 'bedding', icon: 'BedDouble', order: 3 },
      { name: 'Cushions & Throws', slug: 'cushions', icon: 'Pilcrow', order: 4 },
      { name: 'Upholstery', slug: 'upholstery', icon: 'Layers', order: 5 },
    ]
  },
  {
    name: 'Plumbing',
    slug: 'plumbing',
    icon: 'Droplet',
    color: '#06B6D4',
    order: 4,
    children: [
      { name: 'Faucets', slug: 'faucets', icon: 'Droplets', order: 1 },
      { name: 'Sinks', slug: 'sinks', icon: 'Bath', order: 2 },
      { name: 'Toilets', slug: 'toilets', icon: 'Toilet', order: 3 },
      { name: 'Bathtubs', slug: 'bathtubs', icon: 'Bath', order: 4 },
      { name: 'Showers', slug: 'showers', icon: 'ShowerHead', order: 5 },
      { name: 'Accessories', slug: 'plumbing-accessories', icon: 'Grip', order: 6 },
    ]
  },
  {
    name: 'Hardware',
    slug: 'hardware',
    icon: 'Wrench',
    color: '#64748B',
    order: 5,
    children: [
      { name: 'Door Hardware', slug: 'door-hardware', icon: 'DoorOpen', order: 1 },
      { name: 'Cabinet Hardware', slug: 'cabinet-hardware', icon: 'Grip', order: 2 },
      { name: 'Window Hardware', slug: 'window-hardware', icon: 'AppWindow', order: 3 },
      { name: 'Hooks & Hangers', slug: 'hooks', icon: 'Anchor', order: 4 },
    ]
  },
  {
    name: 'Appliances',
    slug: 'appliances',
    icon: 'Refrigerator',
    color: '#10B981',
    order: 6,
    children: [
      { name: 'Kitchen Appliances', slug: 'kitchen-appliances', icon: 'UtensilsCrossed', order: 1 },
      { name: 'Laundry', slug: 'laundry', icon: 'WashingMachine', order: 2 },
      { name: 'Climate Control', slug: 'climate', icon: 'Thermometer', order: 3 },
    ]
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    icon: 'Flower2',
    color: '#F97316',
    order: 7,
    children: [
      { name: 'Mirrors', slug: 'mirrors', icon: 'Scan', order: 1 },
      { name: 'Art & Frames', slug: 'art', icon: 'Frame', order: 2 },
      { name: 'Decorative Objects', slug: 'decor', icon: 'Star', order: 3 },
      { name: 'Vases & Planters', slug: 'vases', icon: 'Flower', order: 4 },
      { name: 'Clocks', slug: 'clocks', icon: 'Clock', order: 5 },
    ]
  },
  {
    name: 'Flooring',
    slug: 'flooring',
    icon: 'LayoutGrid',
    color: '#78716C',
    order: 8,
    children: [
      { name: 'Hardwood', slug: 'hardwood', icon: 'TreeDeciduous', order: 1 },
      { name: 'Tile', slug: 'tile', icon: 'Grid3x3', order: 2 },
      { name: 'Carpet', slug: 'carpet', icon: 'Square', order: 3 },
      { name: 'Vinyl & Laminate', slug: 'vinyl', icon: 'Layers', order: 4 },
      { name: 'Stone', slug: 'stone', icon: 'Mountain', order: 5 },
    ]
  },
  {
    name: 'Wall Finishes',
    slug: 'wall-finishes',
    icon: 'PaintBucket',
    color: '#A855F7',
    order: 9,
    children: [
      { name: 'Paint', slug: 'paint', icon: 'Paintbrush', order: 1 },
      { name: 'Wallpaper', slug: 'wallpaper', icon: 'Newspaper', order: 2 },
      { name: 'Wall Tile', slug: 'wall-tile', icon: 'Grid2x2', order: 3 },
      { name: 'Paneling', slug: 'paneling', icon: 'PanelLeft', order: 4 },
    ]
  },
  {
    name: 'Window Treatments',
    slug: 'window-treatments',
    icon: 'PanelTop',
    color: '#0EA5E9',
    order: 10,
    children: [
      { name: 'Blinds', slug: 'blinds', icon: 'AlignJustify', order: 1 },
      { name: 'Shades', slug: 'shades', icon: 'PanelTopClose', order: 2 },
      { name: 'Shutters', slug: 'shutters', icon: 'PanelRightClose', order: 3 },
    ]
  },
  {
    name: 'Outdoor',
    slug: 'outdoor',
    icon: 'TreePine',
    color: '#22C55E',
    order: 11,
    children: [
      { name: 'Outdoor Furniture', slug: 'outdoor-furniture', icon: 'Armchair', order: 1 },
      { name: 'Planters', slug: 'planters', icon: 'Flower2', order: 2 },
      { name: 'Outdoor Lighting', slug: 'outdoor-lighting', icon: 'Sun', order: 3 },
    ]
  },
]

async function upsertCategory(
  prisma: PrismaClient,
  data: {
    slug: string
    name: string
    icon?: string
    color?: string
    order: number
    parentId?: string
  }
) {
  // Find existing category with null orgId
  const existing = await prisma.productCategory.findFirst({
    where: {
      slug: data.slug,
      orgId: null
    }
  })
  
  if (existing) {
    return prisma.productCategory.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        icon: data.icon,
        color: data.color,
        order: data.order,
        parentId: data.parentId,
        isDefault: true,
      }
    })
  } else {
    return prisma.productCategory.create({
      data: {
        orgId: null,
        slug: data.slug,
        name: data.name,
        icon: data.icon,
        color: data.color,
        order: data.order,
        parentId: data.parentId,
        isDefault: true,
        isActive: true,
      }
    })
  }
}

export async function seedProductCategories(prisma: PrismaClient) {
  console.log('🌱 Seeding product categories...')
  
  for (const category of defaultCategories) {
    const { children, ...parentData } = category
    
    // Create parent category (global - no orgId)
    const parent = await upsertCategory(prisma, {
      slug: category.slug,
      name: parentData.name,
      icon: parentData.icon,
      color: parentData.color,
      order: parentData.order,
    })
    
    console.log(`  ✓ ${parent.name}`)
    
    // Create child categories
    if (children) {
      for (const child of children) {
        await upsertCategory(prisma, {
          slug: child.slug,
          name: child.name,
          icon: child.icon,
          order: child.order,
          parentId: parent.id,
        })
        console.log(`    - ${child.name}`)
      }
    }
  }
  
  console.log('✅ Product categories seeded successfully!')
}

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createSampleTemplates() {
  try {
    
    // Get the first organization (you can modify this to target your specific org)
    const org = await prisma.organization.findFirst()
    if (!org) {
      console.error('❌ No organization found. Please create an organization first.')
      return
    }

    // Get the first user (for created/updated fields)
    const user = await prisma.user.findFirst({ where: { orgId: org.id } })
    if (!user) {
      console.error('❌ No user found in organization.')
      return
    }

    // Template 1: Basic Bedroom
    const bedroomTemplate = await prisma.fFETemplate.create({
      data: {
        orgId: org.id,
        name: 'Basic Bedroom',
        description: 'Standard bedroom furniture and fixtures',
        status: 'ACTIVE',
        isDefault: false,
        version: 1,
        tags: ['bedroom', 'furniture'],
        createdById: user.id,
        updatedById: user.id,
        sections: {
          create: [
            {
              name: 'Furniture',
              description: 'Main bedroom furniture pieces',
              order: 1,
              isRequired: false,
              isCollapsible: true,
              items: {
                create: [
                  {
                    name: 'Bed Frame',
                    description: 'Primary bed for the room',
                    defaultState: 'PENDING',
                    isRequired: true,
                    order: 1,
                    tags: ['bed', 'furniture']
                  },
                  {
                    name: 'Nightstands',
                    description: 'Bedside tables (pair)',
                    defaultState: 'PENDING',
                    isRequired: false,
                    order: 2,
                    tags: ['nightstand', 'furniture']
                  },
                  {
                    name: 'Dresser',
                    description: 'Clothing storage dresser',
                    defaultState: 'PENDING',
                    isRequired: false,
                    order: 3,
                    tags: ['dresser', 'storage']
                  }
                ]
              }
            },
            {
              name: 'Lighting',
              description: 'Bedroom lighting fixtures',
              order: 2,
              isRequired: false,
              isCollapsible: true,
              items: {
                create: [
                  {
                    name: 'Ceiling Light',
                    description: 'Main room lighting',
                    defaultState: 'PENDING',
                    isRequired: true,
                    order: 1,
                    tags: ['lighting', 'ceiling']
                  },
                  {
                    name: 'Table Lamps',
                    description: 'Bedside lighting (pair)',
                    defaultState: 'PENDING',
                    isRequired: false,
                    order: 2,
                    tags: ['lighting', 'table']
                  }
                ]
              }
            }
          ]
        }
      }
    })

    // Template 2: Basic Bathroom
    const bathroomTemplate = await prisma.fFETemplate.create({
      data: {
        orgId: org.id,
        name: 'Basic Bathroom',
        description: 'Essential bathroom fixtures and fittings',
        status: 'ACTIVE',
        isDefault: false,
        version: 1,
        tags: ['bathroom', 'fixtures'],
        createdById: user.id,
        updatedById: user.id,
        sections: {
          create: [
            {
              name: 'Plumbing Fixtures',
              description: 'Main bathroom plumbing items',
              order: 1,
              isRequired: true,
              isCollapsible: true,
              items: {
                create: [
                  {
                    name: 'Toilet',
                    description: 'Primary toilet fixture',
                    defaultState: 'PENDING',
                    isRequired: true,
                    order: 1,
                    tags: ['toilet', 'plumbing']
                  },
                  {
                    name: 'Vanity',
                    description: 'Bathroom vanity with sink',
                    defaultState: 'PENDING',
                    isRequired: true,
                    order: 2,
                    tags: ['vanity', 'sink']
                  },
                  {
                    name: 'Bathtub',
                    description: 'Bath fixture',
                    defaultState: 'PENDING',
                    isRequired: false,
                    order: 3,
                    tags: ['bathtub', 'bath']
                  },
                  {
                    name: 'Shower',
                    description: 'Shower fixture and surround',
                    defaultState: 'PENDING',
                    isRequired: false,
                    order: 4,
                    tags: ['shower', 'bath']
                  }
                ]
              }
            },
            {
              name: 'Lighting & Accessories',
              description: 'Bathroom lighting and accessories',
              order: 2,
              isRequired: false,
              isCollapsible: true,
              items: {
                create: [
                  {
                    name: 'Vanity Lighting',
                    description: 'Mirror/vanity area lighting',
                    defaultState: 'PENDING',
                    isRequired: true,
                    order: 1,
                    tags: ['lighting', 'vanity']
                  },
                  {
                    name: 'Exhaust Fan',
                    description: 'Bathroom ventilation fan',
                    defaultState: 'PENDING',
                    isRequired: true,
                    order: 2,
                    tags: ['ventilation', 'fan']
                  },
                  {
                    name: 'Towel Bar',
                    description: 'Towel hanging fixture',
                    defaultState: 'PENDING',
                    isRequired: false,
                    order: 3,
                    tags: ['accessories', 'towel']
                  }
                ]
              }
            }
          ]
        }
      }
    })

    // Template 3: Kitchen Essentials
    const kitchenTemplate = await prisma.fFETemplate.create({
      data: {
        orgId: org.id,
        name: 'Kitchen Essentials',
        description: 'Basic kitchen fixtures and appliances',
        status: 'ACTIVE',
        isDefault: false,
        version: 1,
        tags: ['kitchen', 'appliances'],
        createdById: user.id,
        updatedById: user.id,
        sections: {
          create: [
            {
              name: 'Cabinetry',
              description: 'Kitchen storage and cabinetry',
              order: 1,
              isRequired: true,
              isCollapsible: true,
              items: {
                create: [
                  {
                    name: 'Upper Cabinets',
                    description: 'Wall-mounted kitchen cabinets',
                    defaultState: 'PENDING',
                    isRequired: true,
                    order: 1,
                    tags: ['cabinets', 'storage']
                  },
                  {
                    name: 'Lower Cabinets',
                    description: 'Base kitchen cabinets',
                    defaultState: 'PENDING',
                    isRequired: true,
                    order: 2,
                    tags: ['cabinets', 'storage']
                  },
                  {
                    name: 'Countertops',
                    description: 'Kitchen work surfaces',
                    defaultState: 'PENDING',
                    isRequired: true,
                    order: 3,
                    tags: ['countertops', 'surface']
                  }
                ]
              }
            },
            {
              name: 'Appliances',
              description: 'Kitchen appliances',
              order: 2,
              isRequired: false,
              isCollapsible: true,
              items: {
                create: [
                  {
                    name: 'Range/Cooktop',
                    description: 'Cooking appliance',
                    defaultState: 'PENDING',
                    isRequired: false,
                    order: 1,
                    tags: ['appliances', 'cooking']
                  },
                  {
                    name: 'Refrigerator',
                    description: 'Food storage appliance',
                    defaultState: 'PENDING',
                    isRequired: false,
                    order: 2,
                    tags: ['appliances', 'refrigeration']
                  }
                ]
              }
            }
          ]
        }
      }
    })

  } catch (error) {
    console.error('❌ Error creating sample templates:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
createSampleTemplates()
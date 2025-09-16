import { PrismaClient, UserRole, RoomType, ProjectType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create organization
  const org = await prisma.organization.upsert({
    where: { slug: 'interior-design-studio' },
    update: {},
    create: {
      name: 'Interior Design Studio',
      slug: 'interior-design-studio',
    },
  })

  console.log('✅ Created organization')

  // Create users
  const hashedPassword = await bcrypt.hash('password', 12)

  const aaron = await prisma.user.create({
    data: {
      name: 'Aaron (Designer)',
      email: 'aaron@example.com',
      password: hashedPassword,
      role: UserRole.DESIGNER,
      orgId: org.id,
    },
  })

  const vitor = await prisma.user.create({
    data: {
      name: 'Vitor (Renderer)',
      email: 'vitor@example.com',
      password: hashedPassword,
      role: UserRole.RENDERER,
      orgId: org.id,
    },
  })

  const sammy = await prisma.user.create({
    data: {
      name: 'Sammy (Drafter)',
      email: 'sammy@example.com',
      password: hashedPassword,
      role: UserRole.DRAFTER,
      orgId: org.id,
    },
  })

  const shaya = await prisma.user.create({
    data: {
      name: 'Shaya (FFE)',
      email: 'shaya@example.com',
      password: hashedPassword,
      role: UserRole.FFE,
      orgId: org.id,
    },
  })

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      role: UserRole.OWNER,
      orgId: org.id,
    },
  })

  console.log('✅ Created users')

  // Create clients
  const client1 = await prisma.client.create({
    data: {
      name: 'John & Jane Resident',
      email: 'john@residentone.com',
      phone: '(555) 123-4567',
      orgId: org.id,
    },
  })

  const client2 = await prisma.client.create({
    data: {
      name: 'Michael & Sarah Smith',
      email: 'michael@example.com',
      phone: '(555) 987-6543',
      orgId: org.id,
    },
  })

  console.log('✅ Created clients')

  // Create projects
  const project1 = await prisma.project.create({
    data: {
      name: 'ResidentOne',
      description: 'Complete residential renovation',
      type: ProjectType.RESIDENTIAL,
      status: 'IN_PROGRESS',
      clientId: client1.id,
      budget: 150000,
      orgId: org.id,
      createdById: admin.id,
      dueDate: new Date('2024-06-01'),
    },
  })

  const project2 = await prisma.project.create({
    data: {
      name: 'Smith Residence',
      description: 'Kitchen and living room redesign',
      type: ProjectType.RESIDENTIAL,
      status: 'IN_PROGRESS',
      clientId: client2.id,
      budget: 80000,
      orgId: org.id,
      createdById: admin.id,
      dueDate: new Date('2024-04-15'),
    },
  })

  console.log('✅ Created projects')

  // Create rooms for ResidentOne project
  const masterBedroom = await prisma.room.create({
    data: {
      projectId: project1.id,
      type: RoomType.MASTER_BEDROOM,
      status: 'IN_PROGRESS',
      currentStage: 'DESIGN',
    },
  })

  const livingRoom = await prisma.room.create({
    data: {
      projectId: project1.id,
      type: RoomType.LIVING_ROOM,
      status: 'NOT_STARTED',
    },
  })

  const diningRoom = await prisma.room.create({
    data: {
      projectId: project1.id,
      type: RoomType.DINING_ROOM,
      status: 'NOT_STARTED',
    },
  })

  const kitchen = await prisma.room.create({
    data: {
      projectId: project2.id,
      type: RoomType.KITCHEN,
      status: 'IN_PROGRESS',
      currentStage: 'THREE_D',
    },
  })

  console.log('✅ Created rooms')

  // Create stages for rooms
  await prisma.stage.createMany({
    data: [
      // Master Bedroom stages
      {
        roomId: masterBedroom.id,
        type: 'DESIGN',
        status: 'IN_PROGRESS',
        assignedTo: aaron.id,
      },
      {
        roomId: masterBedroom.id,
        type: 'THREE_D',
        status: 'NOT_STARTED',
        assignedTo: vitor.id,
      },
      {
        roomId: masterBedroom.id,
        type: 'CLIENT_APPROVAL',
        status: 'NOT_STARTED',
      },
      {
        roomId: masterBedroom.id,
        type: 'DRAWINGS',
        status: 'NOT_STARTED',
        assignedTo: sammy.id,
      },
      {
        roomId: masterBedroom.id,
        type: 'FFE',
        status: 'NOT_STARTED',
        assignedTo: shaya.id,
      },
      // Living Room stages
      {
        roomId: livingRoom.id,
        type: 'DESIGN',
        status: 'NOT_STARTED',
        assignedTo: aaron.id,
      },
      {
        roomId: livingRoom.id,
        type: 'THREE_D',
        status: 'NOT_STARTED',
        assignedTo: vitor.id,
      },
      {
        roomId: livingRoom.id,
        type: 'CLIENT_APPROVAL',
        status: 'NOT_STARTED',
      },
      {
        roomId: livingRoom.id,
        type: 'DRAWINGS',
        status: 'NOT_STARTED',
        assignedTo: sammy.id,
      },
      {
        roomId: livingRoom.id,
        type: 'FFE',
        status: 'NOT_STARTED',
        assignedTo: shaya.id,
      },
    ],
  })

  console.log('✅ Created stages')

  // Create design sections for master bedroom
  await prisma.designSection.createMany({
    data: [
      {
        stageId: (await prisma.stage.findFirst({
          where: { roomId: masterBedroom.id, type: 'DESIGN' }
        }))!.id,
        type: 'WALLS',
        content: 'Feature wall behind the bed with custom millwork and integrated lighting. Soft neutral paint colors throughout.',
      },
      {
        stageId: (await prisma.stage.findFirst({
          where: { roomId: masterBedroom.id, type: 'DESIGN' }
        }))!.id,
        type: 'FURNITURE',
        content: 'King bed with upholstered headboard, matching nightstands, dresser with mirror, and reading chair by window.',
      },
      {
        stageId: (await prisma.stage.findFirst({
          where: { roomId: masterBedroom.id, type: 'DESIGN' }
        }))!.id,
        type: 'LIGHTING',
        content: 'Combination of ambient, task, and accent lighting. Pendant lights for bedside reading, recessed ceiling lights, and table lamps.',
      },
      {
        stageId: (await prisma.stage.findFirst({
          where: { roomId: masterBedroom.id, type: 'DESIGN' }
        }))!.id,
        type: 'GENERAL',
        content: 'Creating a serene, hotel-like atmosphere with luxury finishes and thoughtful storage solutions.',
      },
    ],
  })

  console.log('✅ Created design sections')

  // Create FFE items for master bedroom
  await prisma.fFEItem.createMany({
    data: [
      {
        roomId: masterBedroom.id,
        name: 'King Size Bed Frame',
        category: 'Furniture',
        status: 'SOURCING',
        price: 2500,
      },
      {
        roomId: masterBedroom.id,
        name: 'Upholstered Headboard',
        category: 'Furniture',
        status: 'PROPOSED',
        price: 1200,
        supplierLink: 'https://example.com/headboard',
      },
      {
        roomId: masterBedroom.id,
        name: 'Nightstands (Set of 2)',
        category: 'Furniture',
        status: 'NOT_STARTED',
        price: 800,
      },
      {
        roomId: masterBedroom.id,
        name: 'Table Lamps (Set of 2)',
        category: 'Lighting',
        status: 'SOURCING',
        price: 400,
      },
      {
        roomId: masterBedroom.id,
        name: 'Area Rug',
        category: 'Accessories',
        status: 'NOT_STARTED',
        price: 600,
      },
      {
        roomId: masterBedroom.id,
        name: 'Window Treatments',
        category: 'Textiles',
        status: 'NOT_STARTED',
        price: 800,
      },
    ],
  })

  console.log('✅ Created FFE items')

  // Create room presets
  await prisma.roomPreset.createMany({
    data: [
      {
        roomType: RoomType.MASTER_BEDROOM,
        name: 'Default Master Bedroom',
        description: 'Standard master bedroom preset with essential items',
        ffeItems: JSON.stringify([
          'King Size Bed Frame',
          'Upholstered Headboard',
          'Mattress',
          'Bedding Set',
          'Nightstands (Set of 2)',
          'Table Lamps (Set of 2)',
          'Dresser',
          'Mirror',
          'Area Rug',
          'Window Treatments',
          'Artwork',
          'Bench',
          'Accent Chair',
          'Hardware',
          'Paint/Wallcovering',
          'Accessories'
        ]),
        sections: JSON.stringify(['WALLS', 'FURNITURE', 'LIGHTING', 'GENERAL']),
        isDefault: true,
      },
      {
        roomType: RoomType.LIVING_ROOM,
        name: 'Default Living Room',
        description: 'Standard living room preset',
        ffeItems: JSON.stringify([
          'Sofa',
          'Lounge Chairs',
          'Coffee Table',
          'Side Tables',
          'Table/Floor Lamps',
          'Media Unit',
          'Area Rug',
          'Window Treatments',
          'Artwork',
          'Accessories'
        ]),
        sections: JSON.stringify(['WALLS', 'FURNITURE', 'LIGHTING', 'GENERAL']),
        isDefault: true,
      },
    ],
  })

  console.log('✅ Created room presets')

  console.log('🎉 Database seeding completed!')
  console.log('\n📋 Demo credentials:')
  console.log('Admin: admin@example.com / password')
  console.log('Aaron (Designer): aaron@example.com / password')  
  console.log('Vitor (Renderer): vitor@example.com / password')
  console.log('Sammy (Drafter): sammy@example.com / password')
  console.log('Shaya (FFE): shaya@example.com / password')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

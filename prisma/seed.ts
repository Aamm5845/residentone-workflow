import { PrismaClient, UserRole, RoomType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database with baseline data...')

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

  // Create team member accounts - kept as requested
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

  console.log('✅ Created team accounts')

  // Create room presets (standard templates without fake data)
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
  console.log('\n📋 System accounts:')
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

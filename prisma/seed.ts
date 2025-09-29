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

  // No hardcoded room presets or FFE items - all user-managed
  // await prisma.roomPreset.createMany({ data: [] })

  console.log('✅ Skipped hardcoded room presets - all user-managed')

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

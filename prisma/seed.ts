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

  // Create admin account only - team members are handled by setup-team-members.ts
  const hashedPassword = await bcrypt.hash('password', 12)

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      role: UserRole.OWNER,
      orgId: org.id,
    },
  })

  console.log('✅ Created admin account')

  // No hardcoded room presets or FFE items - all user-managed
  // await prisma.roomPreset.createMany({ data: [] })

  console.log('✅ Skipped hardcoded room presets - all user-managed')

  console.log('🎉 Database seeding completed!')
  console.log('\n📋 System accounts:')
  console.log('Admin: admin@example.com / password')
  console.log('\n👥 Team members should be set up using: npm run setup-team-members')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

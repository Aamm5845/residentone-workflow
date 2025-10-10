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

  // Skip admin creation - use setup-team-members.ts instead

  console.log('✅ Skipped admin creation - use setup-team-members.ts instead')

  // No hardcoded room presets or FFE items - all user-managed
  // await prisma.roomPreset.createMany({ data: [] })

  console.log('✅ Skipped hardcoded room presets - all user-managed')

  console.log('🎉 Database seeding completed!')
  console.log('\n👥 Team members should be set up using: npm run setup-team-members')
  console.log('   This will create the actual team with real email addresses.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

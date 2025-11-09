import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkIcons() {
  const items = await prisma.designConceptItemLibrary.findMany({
    select: {
      name: true,
      icon: true,
    },
    take: 10
  })

  console.log('First 10 items in database:')
  items.forEach(item => {
    console.log(`  ${item.name}: "${item.icon}"`)
  })

  await prisma.$disconnect()
}

checkIcons()

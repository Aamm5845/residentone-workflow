import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkFFEItems() {
  // Get the most recent template
  const template = await prisma.fFETemplate.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      sections: {
        include: {
          items: true
        },
        orderBy: { order: 'asc' }
      }
    }
  })

  if (!template) {
    console.log('No templates found')
    return
  }

  console.log('\n📋 Template:', template.name)
  console.log('─'.repeat(60))

  for (const section of template.sections) {
    console.log(`\n📁 Section: ${section.name} (${section.items.length} items)`)
    console.log('─'.repeat(60))
    
    if (section.items.length === 0) {
      console.log('   ⚠️  No items in this section')
    } else {
      section.items.forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.name}`)
        if (item.description) {
          console.log(`      Description: ${item.description}`)
        }
        console.log(`      Required: ${item.isRequired}`)
        console.log(`      Order: ${item.order}`)
        if (item.customFields) {
          console.log(`      Custom Fields:`, JSON.stringify(item.customFields, null, 2))
        }
        console.log()
      })
    }
  }
}

checkFFEItems()
  .then(() => {
    console.log('\n✅ Done')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

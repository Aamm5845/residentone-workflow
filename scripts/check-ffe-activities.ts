import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking ALL recent activities in database...\n')
  
  const ffeActivities = await prisma.activityLog.findMany({
    include: {
      actor: {
        select: { name: true, email: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 15
  })

  if (ffeActivities.length === 0) {
    console.log('❌ No activities found')
  } else {
    console.log(`✅ Found ${ffeActivities.length} recent activities:\n`)
    
    ffeActivities.forEach((activity, i) => {
      console.log(`Activity #${i + 1}:`)
      console.log(`  Actor: ${activity.actor?.name || 'Unknown'}`)
      console.log(`  Action: "${activity.action}"`)
      console.log(`  Entity: "${activity.entity}"`)
      console.log(`  Details:`, JSON.stringify(activity.details, null, 2))
      console.log(`  Created: ${activity.createdAt}`)
      console.log('---')
    })
  }

  await prisma.$disconnect()
}

main()

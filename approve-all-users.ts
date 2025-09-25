import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function approveAllUsers() {
  console.log('👥 Approving all pending users...')
  
  try {
    // Get all users with PENDING approval status
    const pendingUsers = await prisma.user.findMany({
      where: {
        approvalStatus: 'PENDING',
        email: {
          not: {
            startsWith: 'deleted_'
          }
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        approvalStatus: true
      }
    })
    
    console.log(`\n📋 Found ${pendingUsers.length} pending users to approve:`)
    pendingUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.name}) - ${user.role}`)
    })
    
    if (pendingUsers.length === 0) {
      console.log('ℹ️  No pending users to approve.')
      return
    }
    
    // Update all pending users to APPROVED status
    const result = await prisma.user.updateMany({
      where: {
        approvalStatus: 'PENDING',
        email: {
          not: {
            startsWith: 'deleted_'
          }
        }
      },
      data: {
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        updatedAt: new Date()
      }
    })
    
    console.log(`\n✅ Successfully approved ${result.count} users!`)
    
    // Display final summary
    const allActiveUsers = await prisma.user.findMany({
      where: {
        email: {
          not: {
            startsWith: 'deleted_'
          }
        },
        approvalStatus: 'APPROVED'
      },
      select: {
        email: true,
        name: true,
        role: true,
        approvalStatus: true
      }
    })
    
    console.log(`\n🎉 All active approved users (can login with password123):`)
    allActiveUsers.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`)
      console.log(`   Name: ${user.name}`)
      console.log(`   Role: ${user.role}`)
      console.log(`   Status: ${user.approvalStatus}`)
      console.log(`   Password: password123`)
      console.log('')
    })

  } catch (error) {
    console.error('❌ Error approving users:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the approval
approveAllUsers()
  .then(() => {
    console.log('✅ User approval completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ User approval failed:', error)
    process.exit(1)
  })
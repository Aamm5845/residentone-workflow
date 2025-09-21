const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkUsers() {
  try {
    console.log('🔍 Checking existing users in database...')
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        orgId: true,
        organization: {
          select: {
            name: true
          }
        }
      }
    })
    
    console.log(`\n📊 Found ${users.length} users:`)
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. User:`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Name: ${user.name || 'No name'}`)
      console.log(`   Role: ${user.role}`)
      console.log(`   Organization: ${user.organization?.name || 'No org'}`)
      console.log(`   Created: ${user.createdAt.toLocaleDateString()}`)
    })

    // Check organizations
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            projects: true
          }
        }
      }
    })

    console.log(`\n🏢 Found ${orgs.length} organizations:`)
    orgs.forEach((org, index) => {
      console.log(`\n${index + 1}. Organization:`)
      console.log(`   Name: ${org.name}`)
      console.log(`   Slug: ${org.slug}`)
      console.log(`   Users: ${org._count.users}`)
      console.log(`   Projects: ${org._count.projects}`)
      console.log(`   Created: ${org.createdAt.toLocaleDateString()}`)
    })

  } catch (error) {
    console.error('❌ Error checking database:', error.message)
    console.error('Full error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUsers()
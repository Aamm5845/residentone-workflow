const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function debugClientAccess() {
  try {
    console.log('🔍 Checking database connection...')
    await prisma.$connect()
    console.log('✅ Database connected')

    console.log('\n🔍 Checking if ClientAccessToken table exists...')
    const tokenCount = await prisma.clientAccessToken.count()
    console.log(`✅ ClientAccessToken table exists with ${tokenCount} records`)

    console.log('\n🔍 Checking for existing projects...')
    const projects = await prisma.project.findMany({
      include: {
        client: true
      },
      take: 5
    })
    console.log(`✅ Found ${projects.length} projects`)

    if (projects.length > 0) {
      console.log('\n📋 Projects found:')
      projects.forEach((project, index) => {
        console.log(`  ${index + 1}. ${project.name} (Client: ${project.client.name})`)
        console.log(`     ID: ${project.id}`)
        console.log(`     Status: ${project.status}`)
      })
    }

    console.log('\n🔍 Checking for existing client access tokens...')
    const tokens = await prisma.clientAccessToken.findMany({
      include: {
        project: {
          include: {
            client: true
          }
        },
        createdBy: true
      },
      take: 5
    })
    
    if (tokens.length > 0) {
      console.log(`✅ Found ${tokens.length} existing tokens:`)
      tokens.forEach((token, index) => {
        console.log(`  ${index + 1}. ${token.name || 'Unnamed'}`)
        console.log(`     Token: ${token.token.substring(0, 10)}...`)
        console.log(`     Project: ${token.project.name}`)
        console.log(`     Active: ${token.active}`)
        console.log(`     Created: ${token.createdAt}`)
        console.log(`     Access count: ${token.accessCount}`)
        console.log(`     Test URL: /client-progress/${token.token}`)
      })
    } else {
      console.log('ℹ️  No existing tokens found - this is normal for a new setup')
    }

    console.log('\n🔍 Testing nanoid dependency...')
    const { nanoid } = require('nanoid')
    const testToken = nanoid(32)
    console.log(`✅ nanoid working - generated test token: ${testToken}`)

  } catch (error) {
    console.error('❌ Debug failed:', error)
    if (error.code === 'P2021') {
      console.error('💡 The table `ClientAccessToken` does not exist in the current database.')
      console.error('   Run: npx prisma db push')
    }
  } finally {
    await prisma.$disconnect()
  }
}

debugClientAccess()
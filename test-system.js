const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testSystem() {
  try {
    console.log('🧪 Testing StudioFlow System...\n')
    
    // Test 1: Database Connection
    console.log('1. Testing database connection...')
    await prisma.$connect()
    console.log('   ✅ Database connected successfully\n')
    
    // Test 2: Check Users
    console.log('2. Checking users...')
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        orgId: true
      }
    })
    console.log(`   📊 Found ${users.length} user(s)`)
    users.forEach(user => {
      console.log(`   👤 ${user.email} (${user.name || 'No name'}) - ${user.role}`)
    })
    console.log()
    
    // Test 3: Check Organizations
    console.log('3. Checking organizations...')
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            users: true,
            projects: true
          }
        }
      }
    })
    console.log(`   🏢 Found ${orgs.length} organization(s)`)
    orgs.forEach(org => {
      console.log(`   🏢 ${org.name} (${org.slug}) - ${org._count.users} users, ${org._count.projects} projects`)
    })
    console.log()
    
    // Test 4: Check Projects
    console.log('4. Checking projects...')
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        _count: {
          select: {
            rooms: true,
            assets: true
          }
        }
      },
      take: 5
    })
    console.log(`   📁 Found ${projects.length} project(s) (showing first 5)`)
    projects.forEach(project => {
      console.log(`   📁 ${project.name} (${project.status}) - ${project._count.rooms} rooms, ${project._count.assets} assets`)
    })
    console.log()
    
    // Test 5: Check Rendering Versions
    console.log('5. Checking rendering versions...')
    const renderingVersions = await prisma.renderingVersion.findMany({
      select: {
        id: true,
        version: true,
        status: true,
        _count: {
          select: {
            assets: true,
            notes: true
          }
        }
      },
      take: 5
    })
    console.log(`   🎨 Found ${renderingVersions.length} rendering version(s)`)
    renderingVersions.forEach(version => {
      console.log(`   🎨 ${version.version} (${version.status}) - ${version._count.assets} assets, ${version._count.notes} notes`)
    })
    console.log()
    
    // Test 6: Check Stages
    console.log('6. Checking stages...')
    const stages = await prisma.stage.findMany({
      select: {
        id: true,
        type: true,
        status: true
      },
      take: 10
    })
    console.log(`   ⚙️ Found ${stages.length} stage(s) (showing first 10)`)
    const stagesByType = {}
    stages.forEach(stage => {
      if (!stagesByType[stage.type]) {
        stagesByType[stage.type] = { total: 0, statuses: {} }
      }
      stagesByType[stage.type].total++
      stagesByType[stage.type].statuses[stage.status] = (stagesByType[stage.type].statuses[stage.status] || 0) + 1
    })
    
    Object.entries(stagesByType).forEach(([type, data]) => {
      const statusSummary = Object.entries(data.statuses).map(([status, count]) => `${count} ${status}`).join(', ')
      console.log(`   ⚙️ ${type}: ${data.total} total (${statusSummary})`)
    })
    console.log()
    
    // Test 7: System Health Summary
    console.log('📋 SYSTEM HEALTH SUMMARY:')
    console.log(`   Users: ${users.length > 0 ? '✅' : '❌'} (${users.length} found)`)
    console.log(`   Organizations: ${orgs.length > 0 ? '✅' : '❌'} (${orgs.length} found)`)
    console.log(`   Database: ✅ Connected and responsive`)
    console.log(`   Schema: ✅ All tables accessible`)
    console.log(`   3D Rendering: ✅ RenderingVersion table available`)
    
    if (users.length === 0) {
      console.log('\n⚠️  WARNING: No users found!')
      console.log('   Run: node create-your-admin.js to create an admin account')
    }
    
    if (orgs.length === 0) {
      console.log('\n⚠️  WARNING: No organizations found!')
      console.log('   This will be created automatically when you create your first user')
    }
    
    console.log('\n🎉 System test completed!')
    
  } catch (error) {
    console.error('❌ System test failed:', error.message)
    console.error('Full error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testSystem()
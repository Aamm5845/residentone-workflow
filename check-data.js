const { PrismaClient } = require('@prisma/client')

async function checkData() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔍 Checking current database state...\n')
    
    // Check users
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true }
    })
    console.log('👥 Users:', users.length)
    users.forEach(user => console.log(`   - ${user.email} (${user.role})`))
    
    // Check organizations
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true }
    })
    console.log('\n🏢 Organizations:', orgs.length)
    orgs.forEach(org => console.log(`   - ${org.name} (${org.slug})`))
    
    // Check clients
    const clients = await prisma.client.findMany({
      select: { id: true, name: true, email: true }
    })
    console.log('\n👤 Clients:', clients.length)
    clients.forEach(client => console.log(`   - ${client.name} (${client.email})`))
    
    // Check projects
    const projects = await prisma.project.findMany({
      include: { client: { select: { name: true } } }
    })
    console.log('\n📁 Projects:', projects.length)
    projects.forEach(project => console.log(`   - ${project.name} (${project.status}) - Client: ${project.client?.name || 'None'}`))
    
    // Check rooms
    const rooms = await prisma.room.findMany({
      include: { project: { select: { name: true } } }
    })
    console.log('\n🏠 Rooms:', rooms.length)
    rooms.forEach(room => console.log(`   - ${room.name || room.type} in ${room.project.name}`))
    
    // Check contractors (new table)
    const contractors = await prisma.contractor.findMany({
      select: { id: true, businessName: true, type: true, specialty: true }
    })
    console.log('\n👷 Contractors:', contractors.length)
    contractors.forEach(contractor => console.log(`   - ${contractor.businessName} (${contractor.type}) - ${contractor.specialty || 'No specialty'}`))
    
    console.log('\n✅ Data check complete!')
    
  } catch (error) {
    console.error('❌ Error checking data:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkData()
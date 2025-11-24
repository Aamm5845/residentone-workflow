const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'aaron@meisnerinteriors.com' },
      include: { Organization: true }
    });
    
    if (user) {
      console.log('✅ User found:');
      console.log(`  - ID: ${user.id}`);
      console.log(`  - Name: ${user.name}`);
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Role: ${user.role}`);
      console.log(`  - Password hash: ${user.password ? 'EXISTS' : 'MISSING'}`);
      console.log(`  - Organization: ${user.Organization?.name || 'NOT FOUND'}`);
      console.log('\n✅ You should be able to log in now!');
    } else {
      console.log('❌ User not found');
    }
    
    const counts = {
      users: await prisma.user.count(),
      projects: await prisma.project.count(),
      rooms: await prisma.room.count(),
      clients: await prisma.client.count()
    };
    
    console.log('\n📊 Database summary:');
    console.log(`  - Users: ${counts.users}`);
    console.log(`  - Projects: ${counts.projects}`);
    console.log(`  - Rooms: ${counts.rooms}`);
    console.log(`  - Clients: ${counts.clients}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verify();

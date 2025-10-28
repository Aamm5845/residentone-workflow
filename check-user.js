const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'aaron@meisnerinteriors.com' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        approvalStatus: true,
        orgId: true,
        password: true,
      }
    });
    
    if (user) {
      console.log('User found:');
      console.log(JSON.stringify({
        ...user,
        password: user.password ? '(password exists)' : '(no password)',
      }, null, 2));
    } else {
      console.log('User NOT found in database');
    }
    
    // Also check all users to see what's in the database
    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true, name: true }
    });
    console.log('\nAll users in database:');
    console.log(JSON.stringify(allUsers, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();

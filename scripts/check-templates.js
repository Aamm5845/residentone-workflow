const { PrismaClient } = require('@prisma/client');

async function checkTemplates() {
  const prisma = new PrismaClient();

  try {
    
    const templates = await prisma.fFETemplate.findMany({
      include: {
        sections: {
          include: {
            items: true
          }
        }
      }
    });

    if (templates.length === 0) {
      
    } else {
      templates.forEach((template, index) => {

      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplates();
const { PrismaClient } = require('@prisma/client');

async function checkTemplates() {
  const prisma = new PrismaClient();

  try {
    console.log('🔍 Checking FFE Templates in database...');
    
    const templates = await prisma.fFETemplate.findMany({
      include: {
        sections: {
          include: {
            items: true
          }
        }
      }
    });

    console.log(`📊 Found ${templates.length} templates:`);
    
    if (templates.length === 0) {
      console.log('❌ No templates found in the database!');
    } else {
      templates.forEach((template, index) => {
        console.log(`\n${index + 1}. ${template.name}`);
        console.log(`   - ID: ${template.id}`);
        console.log(`   - Description: ${template.description || 'None'}`);
        console.log(`   - Status: ${template.status}`);
        console.log(`   - Organization ID: ${template.orgId}`);
        console.log(`   - Sections: ${template.sections.length}`);
        console.log(`   - Total Items: ${template.sections.reduce((sum, section) => sum + section.items.length, 0)}`);
      });
    }

    console.log('\n🔍 Checking FFE Template API endpoint...');
    console.log('You can test the API by visiting:');
    console.log('GET /api/ffe/v2/templates?orgId=YOUR_ORG_ID');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplates();
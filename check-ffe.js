const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const templates = await prisma.fFETemplate.count();
  const sections = await prisma.fFETemplateSection.count();
  const items = await prisma.fFETemplateItem.count();
  const lib = await prisma.fFESectionLibrary.count();
  const roomItems = await prisma.roomFFEItem.count();
  
  console.log('\n✅ FFE Data Status:');
  console.log(`  📋 FFE Templates: ${templates}`);
  console.log(`  📑 FFE Template Sections: ${sections}`);
  console.log(`  🔧 FFE Template Items: ${items}`);
  console.log(`  📚 FFE Section Library: ${lib}`);
  console.log(`  🏠 Room FFE Items: ${roomItems}`);
  
  console.log('\n📊 Expected from backup:');
  console.log('  📋 FFE Templates: 3');
  console.log('  📑 FFE Template Sections: 23');
  console.log('  🔧 FFE Template Items: 110');
  console.log('  📚 FFE Section Library: 18');
  console.log('  🏠 Room FFE Items: 67');
  
  await prisma.$disconnect();
})();

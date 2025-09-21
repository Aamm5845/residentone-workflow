const { PrismaClient } = require('@prisma/client')

async function restoreCoverImages() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🖼️ Restoring cover images for projects...\n')
    
    const projects = await prisma.project.findMany({
      select: { id: true, name: true, coverImages: true }
    })
    
    console.log('Found projects:')
    projects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name}`)
      console.log(`   Current cover images: ${JSON.stringify(project.coverImages) || 'None'}`)
    })
    
    console.log('\n📋 To restore cover images:')
    console.log('1. Upload new cover images through the UI, OR')
    console.log('2. Use this script to set them manually')
    
    // Example of how to restore if you have the URLs:
    console.log('\n💡 Example restoration (uncomment and modify):')
    console.log('// const feldmanImages = ["https://example.com/feldman1.jpg", "https://example.com/feldman2.jpg"]')
    console.log('// await prisma.project.update({')
    console.log('//   where: { name: "Feldman" },')
    console.log('//   data: { coverImages: feldmanImages }')
    console.log('// })')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

restoreCoverImages()
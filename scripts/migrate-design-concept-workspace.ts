import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateDesignConceptWorkspace() {
  console.log('🚀 Starting Design Concept Workspace migration...')

  try {
    // 1. Get all organizations to create default tags
    const organizations = await prisma.organization.findMany()
    
    console.log(`📊 Found ${organizations.length} organizations`)

    // 2. Create default tags for each organization
    for (const org of organizations) {
      console.log(`🏢 Processing organization: ${org.name}`)

      // Check if default tags already exist
      const existingTags = await prisma.tag.findMany({
        where: { orgId: org.id }
      })

      if (existingTags.length === 0) {
        const defaultTags = [
          {
            name: 'Must Have',
            type: 'MUST_HAVE' as const,
            color: '#EF4444', // Red
            description: 'Essential items that must be included in the design'
          },
          {
            name: 'Optional',
            type: 'OPTIONAL' as const,
            color: '#F59E0B', // Amber
            description: 'Nice-to-have items that can be considered'
          },
          {
            name: 'Explore',
            type: 'EXPLORE' as const,
            color: '#10B981', // Emerald
            description: 'Ideas to explore and potentially develop further'
          }
        ]

        for (const tag of defaultTags) {
          await prisma.tag.create({
            data: {
              ...tag,
              orgId: org.id
            }
          })
        }

        console.log(`  ✅ Created ${defaultTags.length} default tags`)
      } else {
        console.log(`  ⏭️  Tags already exist (${existingTags.length} found)`)
      }
    }

    // 3. Find all DESIGN_CONCEPT stages and ensure they have all 4 sections
    const designConceptStages = await prisma.stage.findMany({
      where: { 
        type: 'DESIGN_CONCEPT' 
      },
      include: {
        designSections: true,
        room: {
          include: {
            project: true
          }
        }
      }
    })

    console.log(`🎨 Found ${designConceptStages.length} Design Concept stages`)

    const requiredSections = [
      {
        type: 'GENERAL' as const,
        name: 'General',
        description: 'Overall design concept, mood, and styling direction'
      },
      {
        type: 'WALL_COVERING' as const,
        name: 'Wall Covering',
        description: 'Wall treatments, paint colors, wallpaper, and finishes'
      },
      {
        type: 'CEILING' as const,
        name: 'Ceiling',
        description: 'Ceiling design, treatments, lighting integration, and details'
      },
      {
        type: 'FLOOR' as const,
        name: 'Floor',
        description: 'Flooring materials, patterns, transitions, and area rugs'
      }
    ]

    for (const stage of designConceptStages) {
      const projectName = stage.room?.project?.name || 'Unknown Project'
      const roomName = stage.room?.name || stage.room?.type || 'Unknown Room'
      
      console.log(`  📋 Processing stage: ${projectName} - ${roomName}`)

      // Check which sections are missing
      const existingSectionTypes = stage.designSections.map(s => s.type)
      const missingSections = requiredSections.filter(
        req => !existingSectionTypes.includes(req.type)
      )

      if (missingSections.length > 0) {
        for (const section of missingSections) {
          await prisma.designSection.create({
            data: {
              stageId: stage.id,
              type: section.type,
              content: `# ${section.name}\n\n${section.description}\n\n*Add your design notes here...*`,
              completed: false,
              createdById: stage.createdById || undefined
            }
          })
        }

        console.log(`    ✅ Created ${missingSections.length} missing sections`)
      } else {
        console.log(`    ⏭️  All sections already exist`)
      }
    }

    // 4. Since the enum has been updated, we just need to ensure all design concept stages have the new sections
    // The old sections would have been handled by the db push command
    console.log('✅ Section type migration handled by database schema update')

    console.log('🎉 Design Concept Workspace migration completed successfully!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
if (require.main === module) {
  migrateDesignConceptWorkspace()
    .then(() => {
      console.log('Migration completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Migration failed:', error)
      process.exit(1)
    })
}

export { migrateDesignConceptWorkspace }
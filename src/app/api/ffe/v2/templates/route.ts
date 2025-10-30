import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/auth';
import { prisma } from '@/lib/prisma';

// Default preset items for each section type
const SECTION_PRESET_ITEMS: Record<string, any[]> = {
  'Plumbing': [
    { name: 'Toilet', description: 'Toilet fixture', isRequired: true, order: 1 },
    { name: 'Vanity & Sink', description: 'Vanity cabinet and sink', isRequired: true, order: 2 },
    { name: 'Bathtub', description: 'Bathtub fixture', isRequired: false, order: 3 },
    { name: 'Shower', description: 'Shower fixture and enclosure', isRequired: false, order: 4 },
    { name: 'Faucets', description: 'All faucets and fixtures', isRequired: true, order: 5 }
  ],
  'Lighting': [
    { name: 'Overhead Lighting', description: 'Main ceiling light fixture', isRequired: true, order: 1 },
    { name: 'Task Lighting', description: 'Focused work area lighting', isRequired: false, order: 2 },
    { name: 'Accent Lighting', description: 'Decorative or ambient lighting', isRequired: false, order: 3 }
  ],
  'Flooring': [
    { name: 'Primary Flooring', description: 'Main floor covering', isRequired: true, order: 1 },
    { name: 'Area Rug', description: 'Accent rug or carpet', isRequired: false, order: 2 }
  ],
  'Wall Treatments': [
    { name: 'Wall Paint/Finish', description: 'Primary wall treatment', isRequired: true, order: 1 },
    { name: 'Accent Wall', description: 'Special wall treatment or feature', isRequired: false, order: 2 }
  ],
  'Furniture': [
    { name: 'Primary Furniture', description: 'Main furniture pieces', isRequired: false, order: 1 },
    { name: 'Storage Furniture', description: 'Cabinets, shelving, etc.', isRequired: false, order: 2 },
    { name: 'Seating', description: 'Chairs, benches, etc.', isRequired: false, order: 3 }
  ],
  'Ceiling': [
    { name: 'Ceiling Finish', description: 'Ceiling paint or treatment', isRequired: true, order: 1 },
    { name: 'Crown Molding', description: 'Decorative ceiling molding', isRequired: false, order: 2 }
  ],
  'Window Treatments': [
    { name: 'Window Coverings', description: 'Curtains, blinds, or shades', isRequired: false, order: 1 }
  ],
  'Accessories': [
    { name: 'Decorative Items', description: 'Art, plants, decorative objects', isRequired: false, order: 1 },
    { name: 'Functional Accessories', description: 'Mirrors, storage baskets, etc.', isRequired: false, order: 2 }
  ],
  'Hardware': [
    { name: 'Door Hardware', description: 'Door handles and locks', isRequired: false, order: 1 },
    { name: 'Cabinet Hardware', description: 'Pulls, knobs, and handles', isRequired: false, order: 2 }
  ]
};

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get orgId from email if missing
    let orgId = session.user.orgId;
    
    if (!orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      });
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      orgId = user.orgId;
    }

    // Fetch templates from database
    const templates = await prisma.fFETemplate.findMany({
      where: {
        orgId: orgId
      },
      include: {
        sections: {
          include: {
            items: true
          },
          orderBy: { order: 'asc' }
        },
        createdBy: { select: { name: true, email: true } },
        updatedBy: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });


    return NextResponse.json({
      success: true,
      data: templates,
      count: templates.length
    });

  } catch (error) {
    console.error('Error fetching FFE templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user info from email if id/orgId are missing
    let userId = session.user.id;
    let orgId = session.user.orgId;
    
    if (!userId || !orgId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true }
      });
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      userId = user.id;
      orgId = user.orgId;
    }

    const data = await request.json();
    
    const { name, description, isDefault = false, sections = [] } = data;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Create template with sections and items in database using a transaction
    const template = await prisma.$transaction(async (tx) => {
      // Create the template
      const newTemplate = await tx.fFETemplate.create({
        data: {
          orgId: orgId,
          name,
          description,
          status: 'ACTIVE',
          isDefault,
          version: 1,
          tags: [],
          createdById: userId,
          updatedById: userId
        }
      });

      // Create sections and their items
      for (const sectionData of sections) {
        const section = await tx.fFETemplateSection.create({
          data: {
            templateId: newTemplate.id,
            name: sectionData.name,
            description: sectionData.description,
            order: sectionData.order || 0,
            isRequired: false,
            isCollapsible: true
          }
        });

        // Determine which items to use: provided items or preset items
        let itemsToCreate = sectionData.items || [];
        
        // If no items provided, use preset items for this section
        if (itemsToCreate.length === 0 && SECTION_PRESET_ITEMS[sectionData.name]) {
          itemsToCreate = SECTION_PRESET_ITEMS[sectionData.name];
        }

        // Create items for this section
        for (const itemData of itemsToCreate) {
          await tx.fFETemplateItem.create({
            data: {
              sectionId: section.id,
              name: itemData.name,
              description: itemData.description,
              defaultState: itemData.defaultState || 'PENDING',
              isRequired: itemData.isRequired || false,
              order: itemData.order || 0,
              tags: [],
              customFields: {
                linkedItems: itemData.linkedItems || [],
                notes: itemData.notes || ''
              }
            }
          });
        }
      }

      // Return the complete template with relations
      return await tx.fFETemplate.findUnique({
        where: { id: newTemplate.id },
        include: {
          sections: {
            include: {
              items: true
            },
            orderBy: { order: 'asc' }
          },
          createdBy: { select: { name: true, email: true } },
          updatedBy: { select: { name: true, email: true } }
        }
      });
    });

    return NextResponse.json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('Error creating FFE template:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create template', 
        details: error.message
      },
      { status: 500 }
    );
  }
}

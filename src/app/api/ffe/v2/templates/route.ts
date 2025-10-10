import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/auth';
import { prisma } from '@/lib/prisma';

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

        // Create items for this section
        if (sectionData.items && sectionData.items.length > 0) {
          for (const itemData of sectionData.items) {
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

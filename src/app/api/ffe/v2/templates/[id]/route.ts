import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const templateId = resolvedParams.id;

    // Find template in database
    const template = await prisma.fFETemplate.findFirst({
      where: {
        id: templateId,
        orgId: session.user.orgId
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
      }
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('Error fetching FFE template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const templateId = resolvedParams.id;
    const data = await request.json();
    console.log('Updating template:', templateId, 'with data:', data);
    
    // Update template in database using transaction
    const updatedTemplate = await prisma.$transaction(async (tx) => {
      // Check if template exists and belongs to user's org
      const existingTemplate = await tx.fFETemplate.findFirst({
        where: {
          id: templateId,
          orgId: session.user.orgId
        }
      });
      
      if (!existingTemplate) {
        throw new Error('Template not found');
      }

      // Update the template basic info
      const template = await tx.fFETemplate.update({
        where: { id: templateId },
        data: {
          name: data.name || existingTemplate.name,
          description: data.description !== undefined ? data.description : existingTemplate.description,
          status: data.status || existingTemplate.status,
          isDefault: data.isDefault !== undefined ? data.isDefault : existingTemplate.isDefault,
          updatedById: session.user.id
        }
      });

      // If sections are provided, update them
      if (data.sections) {
        // Delete existing sections and items (cascade will handle items)
        await tx.fFETemplateSection.deleteMany({
          where: { templateId }
        });

        // Create new sections and items
        for (const sectionData of data.sections) {
          const section = await tx.fFETemplateSection.create({
            data: {
              templateId,
              name: sectionData.name,
              description: sectionData.description,
              order: sectionData.order || 0,
              isRequired: false,
              isCollapsible: true
            }
          });

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
      }

      // Return updated template with relations
      return await tx.fFETemplate.findUnique({
        where: { id: templateId },
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
      data: updatedTemplate
    });

  } catch (error) {
    console.error('Error updating FFE template:', error);
    
    if (error.message === 'Template not found') {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { error: 'Failed to update template', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const templateId = resolvedParams.id;
    console.log('Deleting template:', templateId);
    
    // Hard delete template and all related data
    const deletedTemplate = await prisma.fFETemplate.deleteMany({
      where: {
        id: templateId,
        orgId: session.user.orgId
      }
    });
    
    if (deletedTemplate.count === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting FFE template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template', details: error.message },
      { status: 500 }
    );
  }
}

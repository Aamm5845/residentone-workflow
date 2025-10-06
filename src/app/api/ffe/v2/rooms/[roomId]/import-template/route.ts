import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    console.log('🔍 POST /api/ffe/v2/rooms/[roomId]/import-template - Starting request');
    const session = await getSession()
    console.log('🔍 Session user:', session?.user);
    
    if (!session?.user) {
      console.log('❌ No session user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get user info from email if id/orgId are missing
    let userId = session.user.id;
    let orgId = session.user.orgId;
    
    if (!userId || !orgId) {
      console.log('⚠️ Missing user ID or orgId, looking up from email:', session.user.email);
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true }
      });
      
      if (!user) {
        console.log('❌ User not found in database');
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      userId = user.id;
      orgId = user.orgId;
      console.log('✅ Retrieved user info:', { userId, orgId });
    }
    
    const { roomId } = await params
    const { templateId } = await request.json()
    
    console.log('🔍 Import request:', { roomId, templateId, orgId });

    if (!roomId || !templateId) {
      return NextResponse.json({ error: 'Room ID and Template ID are required' }, { status: 400 })
    }

    // Verify room belongs to user's organization
    console.log('🔍 Looking for room:', { roomId, orgId });
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        project: {
          orgId: orgId
        }
      }
    })
    
    console.log('🔍 Room found:', room ? 'YES' : 'NO');

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get the template with all sections and items
    console.log('🔍 Looking for template:', { templateId, orgId });
    const template = await prisma.fFETemplate.findFirst({
      where: {
        id: templateId,
        orgId: orgId
      },
      include: {
        sections: {
          include: {
            items: true
          },
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!template) {
      console.log('❌ Template not found');
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    
    console.log('✅ Template found with', template.sections.length, 'sections');

    // Check if room instance already exists
    let roomInstance = await prisma.roomFFEInstance.findUnique({
      where: { roomId },
      include: {
        sections: {
          include: { items: true },
          orderBy: { order: 'asc' }
        }
      }
    })

    // Create room instance if it doesn't exist
    if (!roomInstance) {
      roomInstance = await prisma.roomFFEInstance.create({
        data: {
          roomId,
          templateId: template.id,
          name: `${template.name} - ${room.name || room.type}`,
          status: 'NOT_STARTED',
          progress: 0,
          createdById: userId,
          updatedById: userId
        },
        include: {
          sections: {
            include: { items: true },
            orderBy: { order: 'asc' }
          }
        }
      })
    }

    // Import sections and items from template
    await prisma.$transaction(async (tx) => {
      for (const templateSection of template.sections) {
        // Create section in room instance
        const roomSection = await tx.roomFFESection.create({
          data: {
            instanceId: roomInstance.id,
            templateSectionId: templateSection.id,
            name: templateSection.name,
            description: templateSection.description,
            order: templateSection.order,
            isExpanded: true,
            isCompleted: false
          }
        })

        // Create items in room section
        for (const templateItem of templateSection.items) {
          await tx.roomFFEItem.create({
            data: {
              sectionId: roomSection.id,
              templateItemId: templateItem.id,
              name: templateItem.name,
              description: templateItem.description,
              state: templateItem.defaultState || 'PENDING',
              isRequired: templateItem.isRequired,
              isCustom: false,
              order: templateItem.order,
              quantity: 1,
              unitCost: templateItem.estimatedCost,
              notes: templateItem.customFields ? JSON.stringify(templateItem.customFields) : null,
              createdById: userId,
              updatedById: userId
            }
          })
        }
      }

      // Update room instance to reference the template
      await tx.roomFFEInstance.update({
        where: { id: roomInstance.id },
        data: {
          templateId: template.id,
          status: 'IN_PROGRESS',
          updatedById: userId
        }
      })
    })

    // Fetch updated room instance
    const updatedInstance = await prisma.roomFFEInstance.findUnique({
      where: { roomId },
      include: {
        room: true,
        template: true,
        sections: {
          include: {
            items: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedInstance
    })

  } catch (error) {
    console.error('Error importing template:', error)
    return NextResponse.json(
      { error: 'Failed to import template' },
      { status: 500 }
    )
  }
}
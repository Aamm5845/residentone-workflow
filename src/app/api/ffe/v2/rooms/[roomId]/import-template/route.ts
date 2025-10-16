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
    const { templateId, selectedItemIds } = await request.json()
    
    console.log('🔍 Import request:', { roomId, templateId, selectedItemIds: selectedItemIds?.length || 'all', orgId });

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
        // Filter items based on selection if provided
        const itemsToImport = selectedItemIds && selectedItemIds.length > 0 
          ? templateSection.items.filter(item => selectedItemIds.includes(item.id))
          : templateSection.items;
        
        // Skip creating section if no items to import
        if (itemsToImport.length === 0) {
          console.log(`⚠️ Skipping section "${templateSection.name}" - no items selected`);
          continue;
        }

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
        
        // Prepare all items data for bulk insert
        const allItemsData = [];
        let itemOrder = 0;
        
        for (const templateItem of itemsToImport) {
          // Main item data
          const mainItemData = {
            sectionId: roomSection.id,
            templateItemId: templateItem.id,
            name: templateItem.name,
            description: templateItem.description,
            state: templateItem.defaultState || 'PENDING',
            visibility: 'HIDDEN', // Default to hidden - user must explicitly choose to use
            isRequired: templateItem.isRequired,
            isCustom: false,
            order: itemOrder++,
            quantity: 1,
            unitCost: templateItem.estimatedCost,
            notes: templateItem.customFields?.notes || null,
            customFields: templateItem.customFields?.linkedItems ? {
              linkedItems: templateItem.customFields.linkedItems,
              hasChildren: true
            } : null,
            createdById: userId,
            updatedById: userId
          };
          
          allItemsData.push(mainItemData);
          
          // Add linked items data if they exist
          if (templateItem.customFields?.linkedItems && Array.isArray(templateItem.customFields.linkedItems)) {
            let childOrder = 0;
            for (const linkedItemName of templateItem.customFields.linkedItems) {
              if (linkedItemName && linkedItemName.trim()) {
                allItemsData.push({
                  sectionId: roomSection.id,
                  templateItemId: null,
                  name: linkedItemName.trim(),
                  description: null,
                  state: 'PENDING',
                  visibility: 'HIDDEN',
                  isRequired: false,
                  isCustom: true,
                  order: itemOrder + (childOrder * 0.1),
                  quantity: 1,
                  customFields: {
                    isLinkedItem: true,
                    parentName: templateItem.name
                  },
                  createdById: userId,
                  updatedById: userId
                });
                childOrder++;
              }
            }
          }
        }
        
        // Bulk create all items for this section
        await tx.roomFFEItem.createMany({
          data: allItemsData
        });
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
    }, {
      timeout: 15000 // 15 second timeout (maximum allowed by Prisma Accelerate)
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
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
    return NextResponse.json(
      { 
        error: 'Failed to import template',
        details: error.message,
        type: error.name
      },
      { status: 500 }
    )
  }
}
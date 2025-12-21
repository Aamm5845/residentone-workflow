import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    
    const session = await getServerSession(authOptions);
    console.log('📝 Full session:', JSON.stringify(session, null, 2));
    
    if (!session?.user) {
      
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for visibility filter query parameter
    const { searchParams } = new URL(request.url)
    const includeHidden = searchParams.get('includeHidden') === 'true'
    const onlyVisible = searchParams.get('onlyVisible') === 'true'
    
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

    const resolvedParams = await params;
    const roomId = resolvedParams.roomId;
    
    // Find existing FFE instance for this room
    const instance = await prisma.roomFFEInstance.findUnique({
      where: {
        roomId: roomId
      },
      include: {
        template: {
          include: {
            sections: {
              include: {
                items: true
              },
              orderBy: { order: 'asc' }
            }
          }
        },
        sections: {
          include: {
            items: {
              ...(onlyVisible ? { where: { visibility: 'VISIBLE' } } : {}),
              include: {
                templateItem: true,
                // Include linked specs for "chosen" status in FFE Workspace (legacy one-to-many)
                linkedSpecs: {
                  select: {
                    id: true,
                    name: true,
                    brand: true,
                    sku: true,
                    isOption: true,
                    optionNumber: true,
                    specStatus: true
                  }
                },
                // Include linked specs via new many-to-many relationship (FFESpecLink)
                ffeLinks: {
                  include: {
                    specItem: {
                      select: {
                        id: true,
                        name: true,
                        brand: true,
                        sku: true,
                        isOption: true,
                        optionNumber: true,
                        specStatus: true
                      }
                    }
                  }
                }
              },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        },
        room: {
          include: {
            project: true
          }
        },
        createdBy: { select: { name: true, email: true } },
        updatedBy: { select: { name: true, email: true } }
      }
    });

    if (!instance) {
      // Return empty state if no instance exists yet
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No FFE instance found for this room'
      });
    }

    // Check user has access to this room's project
    if (instance.room.project.orgId !== orgId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Merge ffeLinks (new many-to-many) into linkedSpecs for the frontend
    // This ensures both old and new linking methods work with the existing frontend code
    if (instance.sections) {
      instance.sections.forEach((section: any) => {
        section.items.forEach((item: any) => {
          // Get specs from new many-to-many relationship
          const newLinkedSpecs = (item.ffeLinks || []).map((link: any) => link.specItem)
          
          // Merge with existing linkedSpecs (old one-to-many relationship)
          const existingLinkedSpecs = item.linkedSpecs || []
          
          // Combine and dedupe by ID
          const allLinkedSpecs = [...existingLinkedSpecs]
          newLinkedSpecs.forEach((newSpec: any) => {
            if (!allLinkedSpecs.some((s: any) => s.id === newSpec.id)) {
              allLinkedSpecs.push(newSpec)
            }
          })
          
          // Update item with merged linkedSpecs
          item.linkedSpecs = allLinkedSpecs
          
          // Remove ffeLinks from response (frontend uses linkedSpecs)
          delete item.ffeLinks
        })
      })
    }

    // Debug: Log items with their linkedSpecs for troubleshooting
    let totalLinkedSpecs = 0
    if (instance.sections) {
      instance.sections.forEach((section: any) => {
        section.items.forEach((item: any) => {
          if (item.linkedSpecs && item.linkedSpecs.length > 0) {
            totalLinkedSpecs += item.linkedSpecs.length
            console.log('[FFE API] Item with linkedSpecs:', {
              itemId: item.id,
              itemName: item.name,
              isSpecItem: item.isSpecItem,
              linkedSpecsCount: item.linkedSpecs.length,
              linkedSpecs: item.linkedSpecs.map((s: any) => ({ id: s.id, name: s.name }))
            })
          }
        })
      })
    }
    console.log('[FFE API] Total items with linkedSpecs:', totalLinkedSpecs)

    return NextResponse.json({
      success: true,
      data: instance
    });

  } catch (error) {
    console.error('Error fetching room FFE instance:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    
    const session = await getServerSession(authOptions);
    
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

    const resolvedParams = await params;
    const roomId = resolvedParams.roomId;
    const data = await request.json();
    
    const { templateId, name, estimatedBudget, notes } = data;

    // Check if room exists and belongs to user's organization
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        project: {
          orgId: orgId
        }
      }
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Check if instance already exists
    const existingInstance = await prisma.roomFFEInstance.findUnique({
      where: { roomId }
    });

    if (existingInstance) {
      return NextResponse.json(
        { error: 'FFE instance already exists for this room' },
        { status: 409 }
      );
    }

    // Create the instance using a transaction
    const instance = await prisma.$transaction(async (tx) => {
      // Create the room FFE instance
      const newInstance = await tx.roomFFEInstance.create({
        data: {
          roomId,
          templateId,
          name: name || `${room.name || room.type} FFE`,
          status: 'NOT_STARTED',
          progress: 0,
          estimatedBudget: estimatedBudget || 0,
          notes,
          createdById: userId,
          updatedById: userId
        }
      });

      // If a template was provided, copy its structure
      if (templateId) {
        const template = await tx.fFETemplate.findUnique({
          where: { id: templateId },
          include: {
            sections: {
              include: {
                items: true
              },
              orderBy: { order: 'asc' }
            }
          }
        });

        if (template) {
          // Create sections for this room instance
          for (const templateSection of template.sections) {
            const roomSection = await tx.roomFFESection.create({
              data: {
                instanceId: newInstance.id,
                templateSectionId: templateSection.id,
                name: templateSection.name,
                description: templateSection.description,
                order: templateSection.order,
                isExpanded: true,
                isCompleted: false
              }
            });

            // Create items for this section
            for (const templateItem of templateSection.items) {
              await tx.roomFFEItem.create({
                data: {
                  sectionId: roomSection.id,
                  templateItemId: templateItem.id,
                  name: templateItem.name,
                  description: templateItem.description,
                  state: templateItem.defaultState,
                  visibility: 'HIDDEN', // Default to hidden - items must be explicitly added to workspace
                  isRequired: templateItem.isRequired,
                  order: templateItem.order,
                  quantity: 1,
                  // Preserve customFields (linkedItems and notes) from template
                  customFields: templateItem.customFields || {},
                  createdById: userId,
                  updatedById: userId
                }
              });
            }
          }
        }
      }

      // Return the complete instance with relations
      return await tx.roomFFEInstance.findUnique({
        where: { id: newInstance.id },
        include: {
          template: {
            include: {
              sections: {
                include: {
                  items: true
                },
                orderBy: { order: 'asc' }
              }
            }
          },
          sections: {
            include: {
              items: {
                include: {
                  templateItem: true
                },
                orderBy: { order: 'asc' }
              }
            },
            orderBy: { order: 'asc' }
          },
          room: {
            include: {
              project: true
            }
          },
          createdBy: { select: { name: true, email: true } },
          updatedBy: { select: { name: true, email: true } }
        }
      });
    });

    return NextResponse.json({
      success: true,
      data: instance
    });

  } catch (error) {
    console.error('Error creating room FFE instance:', error);
    return NextResponse.json(
      { error: 'Failed to create room FFE instance', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user info from email if id/orgId are missing
    let userId = session.user.id;
    
    if (!userId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
      });
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      userId = user.id;
    }

    const resolvedParams = await params;
    const roomId = resolvedParams.roomId;
    const data = await request.json();
    
    // If programaLink is being updated, sync it across all rooms in the project
    if (data.programaLink !== undefined) {
      // Get the room to find the project
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { projectId: true }
      });

      if (room) {
        // Find all rooms in the same project
        const projectRooms = await prisma.room.findMany({
          where: { projectId: room.projectId },
          select: { id: true }
        });

        // Update programaLink for all FFE instances in this project
        await prisma.roomFFEInstance.updateMany({
          where: {
            roomId: { in: projectRooms.map(r => r.id) }
          },
          data: {
            programaLink: data.programaLink
          }
        });

        console.log(`✅ Synced programaLink to ${projectRooms.length} rooms in project ${room.projectId}`);
      }
    }
    
    // Update the room FFE instance (with all other data)
    const instance = await prisma.roomFFEInstance.update({
      where: { roomId },
      data: {
        ...data,
        updatedById: userId
      },
      include: {
        template: {
          include: {
            sections: {
              include: {
                items: true
              },
              orderBy: { order: 'asc' }
            }
          }
        },
        sections: {
          include: {
            items: {
              include: {
                templateItem: true
              },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        },
        room: {
          include: {
            project: true
          }
        },
        createdBy: { select: { name: true, email: true } },
        updatedBy: { select: { name: true, email: true } }
      }
    });

    return NextResponse.json({
      success: true,
      data: instance
    });

  } catch (error) {
    console.error('Error updating room FFE instance:', error);
    return NextResponse.json(
      { error: 'Failed to update room FFE instance', details: error.message },
      { status: 500 }
    );
  }
}
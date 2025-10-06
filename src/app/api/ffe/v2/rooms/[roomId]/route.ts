import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    console.log('📝 GET /api/ffe/v2/rooms/[roomId] - Getting session...');
    const session = await getServerSession(authOptions);
    console.log('📝 Full session:', JSON.stringify(session, null, 2));
    
    if (!session?.user) {
      console.log('❌ Unauthorized - no session user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get orgId from email if missing
    let orgId = session.user.orgId;
    
    if (!orgId) {
      console.log('⚠️ Missing orgId, looking up from email:', session.user.email);
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      });
      
      if (!user) {
        console.log('❌ User not found in database');
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      orgId = user.orgId;
      console.log('✅ Retrieved orgId:', orgId);
    }

    const resolvedParams = await params;
    const roomId = resolvedParams.roomId;
    console.log('📝 Fetching room FFE instance for room:', roomId);

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
    console.log('📝 POST /api/ffe/v2/rooms/[roomId] - Creating room FFE instance...');
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      console.log('❌ Unauthorized - no session user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const resolvedParams = await params;
    const roomId = resolvedParams.roomId;
    const data = await request.json();
    console.log('Creating room FFE instance with data:', data);

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

    console.log('Room FFE instance created successfully:', instance.id);

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
    console.log('Updating room FFE instance with data:', data);

    // Update the room FFE instance
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
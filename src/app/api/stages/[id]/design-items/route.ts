import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logActivity, ActivityActions, EntityTypes, type AuthSession } from '@/lib/attribution';
import { notifyItemAdded } from '@/lib/notifications/design-concept-notification-service';

// GET /api/stages/[id]/design-items - Get all design items for a stage
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stageId } = await params;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const items = await prisma.designConceptItem.findMany({
      where: { stageId },
      include: {
        libraryItem: true,
        images: { orderBy: { order: 'asc' } },
        links: { orderBy: { order: 'asc' } },
        attachments: { orderBy: { order: 'asc' } },
        itemNotes: {
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        completedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { order: 'asc' },
    });

    // Calculate progress
    const total = items.length;
    const completed = items.filter(item => item.completedByRenderer).length;
    const pending = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return NextResponse.json({
      items,
      progress: {
        total,
        completed,
        pending,
        percentage,
      },
    });
  } catch (error) {
    console.error('[Design Items] Error fetching items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}

// POST /api/stages/[id]/design-items - Add item to stage
const createSchema = z.object({
  libraryItemId: z.string(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stageId } = await params;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const data = createSchema.parse(body);

    // Check if item already exists for this stage
    const existingItem = await prisma.designConceptItem.findFirst({
      where: {
        stageId,
        libraryItemId: data.libraryItemId,
      },
    });

    if (existingItem) {
      return NextResponse.json(
        { error: 'This item is already added to the design concept' },
        { status: 400 }
      );
    }

    // Get library item details
    const libraryItem = await prisma.designConceptItemLibrary.findUnique({
      where: { id: data.libraryItemId },
    });

    if (!libraryItem) {
      return NextResponse.json(
        { error: 'Library item not found' },
        { status: 404 }
      );
    }

    // Get the current max order for this stage
    const maxOrder = await prisma.designConceptItem.aggregate({
      where: { stageId },
      _max: { order: true },
    });

    // Get stage info for notifications
    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: {
        assignedUser: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        room: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
    }

    // Create the item
    const item = await prisma.designConceptItem.create({
      data: {
        stageId,
        libraryItemId: data.libraryItemId,
        order: (maxOrder._max.order ?? -1) + 1,
        createdById: user.id,
      },
      include: {
        libraryItem: true,
        images: { orderBy: { order: 'asc' } },
        links: { orderBy: { order: 'asc' } },
        attachments: { orderBy: { order: 'asc' } },
        itemNotes: {
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
        completedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Log activity
    await logActivity({
      session: session as AuthSession,
      action: ActivityActions.CREATE,
      entity: EntityTypes.DESIGN_CONCEPT_ITEM,
      entityId: item.id,
      details: {
        stageId,
        itemName: libraryItem.name,
        libraryItemId: data.libraryItemId,
        category: libraryItem.category,
      },
    });

    // Notify assigned renderer if exists
    const assignedRenderer = stage.assignedUser;
    if (assignedRenderer && assignedRenderer.id !== user.id) {
      await prisma.notification.create({
        data: {
          userId: assignedRenderer.id,
          type: 'DESIGN_CONCEPT_UPDATE',
          title: 'New Design Concept Item Added',
          message: `${user.name || user.email} added "${libraryItem.name}" to ${stage.room.name || stage.room.type} design concept`,
          link: `/projects/${stage.room.project.id}?stage=${stageId}`,
          read: false,
        },
      });
    }

    // Send email notification to Vitor (renderer)
    await notifyItemAdded({
      itemName: libraryItem.name,
      projectName: stage.room.project.name,
      roomName: stage.room.name || stage.room.type,
      addedBy: {
        name: user.name || '',
        email: user.email,
      },
      stageId,
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error('[Design Items] Error creating item:', error);
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    );
  }
}
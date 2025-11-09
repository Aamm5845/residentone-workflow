import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// PUT /api/design-items/[itemId] - Update item
const updateSchema = z.object({
  notes: z.string().optional(),
  order: z.number().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params
  
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
    const data = updateSchema.parse(body)

    const item = await prisma.designConceptItem.update({
      where: { id: itemId },
      data: {
        ...data,
        updatedById: user.id,
      },
      include: {
        libraryItem: true,
        images: { orderBy: { order: 'asc' } },
        links: { orderBy: { order: 'asc' } },
        createdBy: { select: { name: true, email: true } },
        completedBy: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error('[Design Item] Error updating item:', error);
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    );
  }
}

// DELETE /api/design-items/[itemId] - Delete item
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params
  
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

    // Get item first to log activity
    const item = await prisma.designConceptItem.findUnique({
      where: { id: itemId },
      include: { 
        libraryItem: true, 
        stage: {
          include: {
            room: true
          }
        } 
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Delete item (cascades to images and links)
    await prisma.designConceptItem.delete({
      where: { id: itemId },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'DESIGN_CONCEPT_ITEM_REMOVED',
        entity: 'STAGE',
        entityId: item.stageId,
        actorId: user.id,
        details: {
          itemName: item.libraryItem.name,
          category: item.libraryItem.category,
          roomName: item.stage.room.name || item.stage.room.type,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Design Item] Error deleting item:', error);
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    );
  }
}

// PATCH /api/design-items/[itemId]/complete - Toggle completion
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params
  
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
    const { completed } = body

    const item = await prisma.designConceptItem.update({
      where: { id: itemId },
      data: {
        completedByRenderer: completed,
        completedAt: completed ? new Date() : null,
        completedById: completed ? user.id : null,
      },
      include: {
        libraryItem: true,
        images: { orderBy: { order: 'asc' } },
        links: { orderBy: { order: 'asc' } },
        createdBy: { select: { name: true, email: true } },
        completedBy: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error('[Design Item] Error toggling completion:', error);
    return NextResponse.json(
      { error: 'Failed to toggle completion' },
      { status: 500 }
    );
  }
}

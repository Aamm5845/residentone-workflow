import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logActivity, ActivityActions, EntityTypes, type AuthSession } from '@/lib/attribution';
import { notifyItemCompleted } from '@/lib/notifications/design-concept-notification-service';

// PATCH /api/design-items/[itemId]/complete - Toggle completion status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { completed } = body;

    // Get user info
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update the item
    const item = await prisma.designConceptItem.update({
      where: { id: itemId },
      data: {
        completedByRenderer: completed,
        completedAt: completed ? new Date() : null,
        completedById: completed ? user.id : null,
      },
      include: {
        libraryItem: {
          select: {
            id: true,
            name: true,
            category: true,
          }
        },
        completedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    // Log activity
    await logActivity({
      session: session as AuthSession,
      action: ActivityActions.COMPLETE,
      entity: EntityTypes.DESIGN_CONCEPT_ITEM,
      entityId: itemId,
      details: {
        stageId: item.stageId,
        itemName: item.libraryItem.name,
        completed,
      },
    });

    // If item was just completed (not unmarked), send notification to Aaron
    if (completed) {
      // Get stage and project info for notification
      const stageWithDetails = await prisma.stage.findUnique({
        where: { id: item.stageId },
        include: {
          room: {
            include: {
              project: { select: { name: true } },
            },
          },
        },
      });

      if (stageWithDetails) {
        await notifyItemCompleted({
          itemName: item.libraryItem.name,
          projectName: stageWithDetails.room.project.name,
          roomName: stageWithDetails.room.name || stageWithDetails.room.type,
          completedBy: {
            name: user.name || '',
            email: user.email,
          },
          stageId: item.stageId,
        });
      }
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('[Design Item Complete] Error toggling completion:', error);
    return NextResponse.json(
      { error: 'Failed to update completion status' },
      { status: 500 }
    );
  }
}

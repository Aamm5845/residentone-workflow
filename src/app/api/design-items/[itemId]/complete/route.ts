import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';

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

    // Update the item
    const item = await prisma.designConceptItem.update({
      where: { id: itemId },
      data: {
        completedByRenderer: completed,
        completedAt: completed ? new Date() : null,
        completedById: completed ? session.user.id : null,
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

    return NextResponse.json(item);
  } catch (error) {
    console.error('[Design Item Complete] Error toggling completion:', error);
    return NextResponse.json(
      { error: 'Failed to update completion status' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { EntityTypes } from '@/lib/attribution';

// GET /api/stages/[id]/design-activity - Get activity logs for design concept items
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

    // Get limit from query params
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Fetch activity logs for design concept items in this stage
    const logs = await prisma.activityLog.findMany({
      where: {
        entity: EntityTypes.DESIGN_CONCEPT_ITEM,
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // Filter by stageId in details (since details is JSON)
    const filteredLogs = logs.filter((log) => {
      if (log.details && typeof log.details === 'object') {
        const details = log.details as any;
        return details.stageId === stageId;
      }
      return false;
    });

    return NextResponse.json({ logs: filteredLogs });
  } catch (error) {
    console.error('[Design Activity] Error fetching activity logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity logs' },
      { status: 500 }
    );
  }
}

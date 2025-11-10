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
      take: 200, // Fetch more initially, then filter
    });

    console.log(`[Design Activity] Found ${logs.length} total design concept logs`);

    // Filter by stageId in details (since details is JSON or string)
    const filteredLogs = logs.filter((log) => {
      if (!log.details) return false;
      
      try {
        // Parse details if it's a string
        let details = log.details;
        if (typeof details === 'string') {
          details = JSON.parse(details);
        }
        
        return details && (details as any).stageId === stageId;
      } catch (error) {
        console.error('[Design Activity] Error parsing log details:', error);
        return false;
      }
    }).slice(0, limit); // Limit after filtering

    console.log(`[Design Activity] Filtered to ${filteredLogs.length} logs for stage ${stageId}`);

    return NextResponse.json({ logs: filteredLogs });
  } catch (error) {
    console.error('[Design Activity] Error fetching activity logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity logs' },
      { status: 500 }
    );
  }
}

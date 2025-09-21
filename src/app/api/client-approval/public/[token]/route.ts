import { NextRequest, NextResponse } from 'next/server';
import { verifyClientApprovalToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    
    // Verify and decode the token
    const payload = verifyClientApprovalToken(token);
    
    // Get the client approval version with assets
    const version = await prisma.clientApprovalVersion.findUnique({
      where: { id: payload.versionId },
      include: {
        assets: true,
        stage: {
          include: {
            room: {
              include: {
                project: true
              }
            }
          }
        },
        emailLogs: {
          orderBy: { sentAt: 'desc' },
          take: 1
        }
      }
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Approval version not found' },
        { status: 404 }
      );
    }

    // Check if already decided
    if (version.status === 'CLIENT_APPROVED' || version.status === 'REVISION_REQUESTED') {
      return NextResponse.json(
        { error: 'This approval request has already been completed' },
        { status: 400 }
      );
    }

    const data = {
      versionId: version.id,
      projectName: version.stage.room.project.name,
      clientName: payload.clientName,
      status: version.status,
      assets: version.assets,
      sentAt: version.emailLogs[0]?.sentAt || version.createdAt
    };

    return NextResponse.json({ data });

  } catch (error) {
    console.error('Error fetching client approval data:', error);
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    );
  }
}
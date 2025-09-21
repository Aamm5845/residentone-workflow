import { NextRequest, NextResponse } from 'next/server';
import { verifyClientApprovalToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, decision, comments } = body;

    if (!token || !decision || !['APPROVED', 'REVISION_REQUESTED'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    // Verify and decode the token
    const payload = verifyClientApprovalToken(token);
    
    // Get the client approval version
    const version = await prisma.clientApprovalVersion.findUnique({
      where: { id: payload.versionId },
      include: {
        stage: {
          include: {
            room: {
              include: {
                project: true
              }
            }
          }
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

    const now = new Date();

    // Update the version status
    await prisma.clientApprovalVersion.update({
      where: { id: version.id },
      data: {
        status: decision === 'APPROVED' ? 'CLIENT_APPROVED' : 'REVISION_REQUESTED',
        notes: comments || null,
        updatedAt: now
      }
    });

    // Create approval record
    await prisma.clientApproval.create({
      data: {
        versionId: version.id,
        approvedBy: payload.clientEmail,
        approvedAt: now,
        decision: decision,
        comments: comments || null
      }
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        stageId: version.stageId,
        type: 'CLIENT_DECISION',
        message: decision === 'APPROVED' 
          ? `Client approved all renderings${comments ? ` with comments: "${comments}"` : ''}` 
          : `Client requested revisions${comments ? `: "${comments}"` : ''}`,
        userId: null, // Client decision
        timestamp: now
      }
    });

    // Create notification for assigned team member
    const assignedUser = await prisma.user.findFirst({
      where: { email: version.stage.assignedTo }
    });

    if (assignedUser) {
      await prisma.notification.create({
        data: {
          userId: assignedUser.id,
          title: decision === 'APPROVED' ? 'Client Approved Renderings' : 'Client Requested Revisions',
          message: `${payload.clientName} has ${decision === 'APPROVED' ? 'approved' : 'requested revisions for'} the renderings for ${version.stage.room.project.name}`,
          type: 'CLIENT_DECISION',
          entityId: version.stageId,
          entityType: 'STAGE'
        }
      });
    }

    // If approved, potentially auto-advance the stage
    if (decision === 'APPROVED') {
      await prisma.stage.update({
        where: { id: version.stageId },
        data: {
          status: 'COMPLETED',
          completedAt: now
        }
      });

      // Create activity for stage completion
      await prisma.activity.create({
        data: {
          stageId: version.stageId,
          type: 'STAGE_COMPLETED',
          message: 'Client Approval stage completed - client approved all renderings',
          userId: null,
          timestamp: now
        }
      });
    }

    console.log(`✅ Client decision processed: ${decision} for version ${version.id}`);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error processing client decision:', error);
    return NextResponse.json(
      { error: 'Failed to process decision' },
      { status: 500 }
    );
  }
}

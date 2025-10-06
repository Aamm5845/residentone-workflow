import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { ffeTemplateService } from '@/lib/services/ffe-template-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user role - only ADMIN and DESIGNER can copy templates
    const userRole = session.user.role;
    if (!userRole || !['ADMIN', 'DESIGNER', 'FFE'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only Admin, Designer, and FFE users can copy templates.' },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const templateId = resolvedParams.id;
    const data = await request.json();
    const { name } = data;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    console.log('Copying template:', templateId, 'with new name:', name);

    // Copy the template using the service
    const copiedTemplate = await ffeTemplateService.copyTemplate(
      templateId,
      name.trim(),
      session.user.id,
      session.user.orgId
    );

    console.log('Template copied successfully:', copiedTemplate.id);

    return NextResponse.json({
      success: true,
      data: copiedTemplate
    });

  } catch (error: any) {
    console.error('Error copying FFE template:', error);

    if (error.message === 'Template to copy not found') {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'Failed to copy template',
        details: error.message
      },
      { status: 500 }
    );
  }
}
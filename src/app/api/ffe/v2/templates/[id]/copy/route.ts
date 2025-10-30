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
    
    console.log('Copy template - Session:', {
      hasSession: !!session,
      userId: session?.user?.id,
      orgId: session?.user?.orgId,
      role: session?.user?.role
    });
    
    if (!session?.user?.id || !session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const templateId = resolvedParams.id;
    
    console.log('Copy template - Template ID:', templateId);
    
    const data = await request.json();
    const { name } = data;
    
    console.log('Copy template - New name:', name);

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    // Copy the template using the service
    console.log('Calling ffeTemplateService.copyTemplate...');
    const copiedTemplate = await ffeTemplateService.copyTemplate(
      templateId,
      name.trim(),
      session.user.id,
      session.user.orgId
    );
    
    console.log('Copy template - Success:', { id: copiedTemplate.id, name: copiedTemplate.name });

    return NextResponse.json({
      success: true,
      data: copiedTemplate,
      message: 'Template copied successfully'
    });

  } catch (error: any) {
    console.error('❌ Error copying FFE template:', error);
    console.error('❌ Error stack:', error.stack);

    if (error.message === 'Template to copy not found') {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'Failed to copy template',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

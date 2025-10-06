import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 GET /api/ffe/v2/templates - Starting request');
    const session = await getSession();
    console.log('🔍 Session user:', session?.user);
    
    if (!session?.user) {
      console.log('❌ No session user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get orgId from email if missing
    let orgId = session.user.orgId;
    console.log('🔍 Initial orgId from session:', orgId);
    
    if (!orgId) {
      console.log('⚠️ No orgId in session, looking up user by email:', session.user.email);
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { orgId: true }
      });
      
      if (!user) {
        console.log('❌ User not found in database');
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      orgId = user.orgId;
      console.log('✅ Retrieved orgId from database:', orgId);
    }

    // Fetch templates from database
    console.log('🔍 Querying templates with orgId:', orgId);
    const templates = await prisma.fFETemplate.findMany({
      where: {
        orgId: orgId
      },
      include: {
        sections: {
          include: {
            items: true
          },
          orderBy: { order: 'asc' }
        },
        createdBy: { select: { name: true, email: true } },
        updatedBy: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('✅ Found', templates.length, 'templates for orgId:', orgId);
    templates.forEach((template, index) => {
      console.log(`  ${index + 1}. ${template.name} (${template.id}) - ${template.sections?.length || 0} sections`);
    });

    return NextResponse.json({
      success: true,
      data: templates,
      count: templates.length
    });

  } catch (error) {
    console.error('Error fetching FFE templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('📝 POST /api/ffe/v2/templates - Getting session...');
    const session = await getSession();
    console.log('📝 Full session:', JSON.stringify(session, null, 2));
    
    if (!session?.user) {
      console.log('❌ Unauthorized - no session user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user info from email if id/orgId are missing
    let userId = session.user.id;
    let orgId = session.user.orgId;
    
    if (!userId || !orgId) {
      console.log('⚠️ Missing user ID or orgId, looking up from email:', session.user.email);
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, orgId: true }
      });
      
      if (!user) {
        console.log('❌ User not found in database');
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      userId = user.id;
      orgId = user.orgId;
      console.log('✅ Retrieved user info:', { userId, orgId });
    }

    const data = await request.json();
    console.log('Creating template with data:', data);
    
    const { name, description, isDefault = false, sections = [] } = data;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Create template with sections and items in database using a transaction
    const template = await prisma.$transaction(async (tx) => {
      // Create the template
      const newTemplate = await tx.fFETemplate.create({
        data: {
          orgId: orgId,
          name,
          description,
          status: 'ACTIVE',
          isDefault,
          version: 1,
          tags: [],
          createdById: userId,
          updatedById: userId
        }
      });

      // Create sections and their items
      for (const sectionData of sections) {
        const section = await tx.fFETemplateSection.create({
          data: {
            templateId: newTemplate.id,
            name: sectionData.name,
            description: sectionData.description,
            order: sectionData.order || 0,
            isRequired: false,
            isCollapsible: true
          }
        });

        // Create items for this section
        if (sectionData.items && sectionData.items.length > 0) {
          for (const itemData of sectionData.items) {
            await tx.fFETemplateItem.create({
              data: {
                sectionId: section.id,
                name: itemData.name,
                description: itemData.description,
                defaultState: itemData.defaultState || 'PENDING',
                isRequired: itemData.isRequired || false,
                order: itemData.order || 0,
                tags: [],
                customFields: {
                  linkedItems: itemData.linkedItems || [],
                  notes: itemData.notes || ''
                }
              }
            });
          }
        }
      }

      // Return the complete template with relations
      return await tx.fFETemplate.findUnique({
        where: { id: newTemplate.id },
        include: {
          sections: {
            include: {
              items: true
            },
            orderBy: { order: 'asc' }
          },
          createdBy: { select: { name: true, email: true } },
          updatedBy: { select: { name: true, email: true } }
        }
      });
    });

    console.log('Template created successfully:', template.id);

    return NextResponse.json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('Error creating FFE template:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Failed to create template', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

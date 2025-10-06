import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch sections from database
    const sections = await prisma.fFESectionLibrary.findMany({
      orderBy: { defaultOrder: 'asc' }
    });

    // If no sections exist, create some default ones
    if (sections.length === 0) {
      console.log('No sections found in database, creating defaults...');
      
      const defaultSections = [
        { name: 'Flooring', description: 'Flooring materials and finishes', defaultOrder: 1 },
        { name: 'Lighting', description: 'Light fixtures and electrical', defaultOrder: 2 },
        { name: 'Furniture', description: 'Furniture pieces and seating', defaultOrder: 3 },
        { name: 'Window Treatments', description: 'Curtains, blinds, and shades', defaultOrder: 4 },
        { name: 'Hardware', description: 'Door handles, knobs, and fixtures', defaultOrder: 5 },
        { name: 'Accessories', description: 'Decorative items and artwork', defaultOrder: 6 },
        { name: 'Textiles', description: 'Rugs, pillows, and fabrics', defaultOrder: 7 },
        { name: 'Storage', description: 'Shelving and organizational items', defaultOrder: 8 },
        { name: 'Plumbing Fixtures', description: 'Faucets, sinks, and bathroom fixtures', defaultOrder: 9 }
      ];

      // Create default sections in database
      const createdSections = await Promise.all(
        defaultSections.map(section => 
          prisma.fFESectionLibrary.create({
            data: {
              name: section.name,
              description: section.description,
              defaultOrder: section.defaultOrder,
              applicableRoomTypes: ['BEDROOM', 'BATHROOM', 'KITCHEN', 'LIVING_ROOM', 'DINING_ROOM', 'OFFICE'],
              isGlobal: true
            }
          })
        )
      );

      return NextResponse.json({
        success: true,
        data: createdSections,
        count: createdSections.length
      });
    }

    return NextResponse.json({
      success: true,
      data: sections,
      count: sections.length
    });

  } catch (error) {
    console.error('Error fetching FFE sections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sections' },
      { status: 500 }
    );
  }
}

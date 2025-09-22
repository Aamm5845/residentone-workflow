import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import JSZip from 'jszip';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const searchParams = request.nextUrl.searchParams;
    const assetIds = searchParams.get('assets')?.split(',') || [];
    
    if (assetIds.length === 0) {
      return NextResponse.json({ error: 'No assets specified' }, { status: 400 });
    }

    // Get the assets from the database
    const assets = await prisma.asset.findMany({
      where: {
        id: {
          in: assetIds
        }
      },
      include: {
        project: {
          include: {
            client: true
          }
        },
        room: true
      }
    });

    if (assets.length === 0) {
      return NextResponse.json({ error: 'No assets found' }, { status: 404 });
    }

    // If there's only one asset, redirect to it directly
    if (assets.length === 1) {
      return NextResponse.redirect(assets[0].url);
    }

    // Create a ZIP file with all renderings
    const zip = new JSZip();
    const projectName = assets[0]?.project?.name || 'Project';
    const roomName = assets[0]?.room?.name || assets[0]?.room?.type || 'Room';

    // Download each asset and add to ZIP
    const downloadPromises = assets.map(async (asset, index) => {
      try {
        const response = await fetch(asset.url);
        if (!response.ok) {
          console.warn(`Failed to download asset ${asset.id}: ${response.statusText}`);
          return;
        }
        
        const buffer = await response.arrayBuffer();
        const extension = asset.url.split('.').pop()?.toLowerCase() || 'jpg';
        const filename = `${roomName}_Rendering_${index + 1}.${extension}`;
        
        zip.file(filename, buffer);
      } catch (error) {
        console.error(`Error downloading asset ${asset.id}:`, error);
      }
    });

    await Promise.all(downloadPromises);

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    // Set response headers for file download
    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="${projectName}_${roomName}_Renderings.zip"`);
    headers.set('Content-Length', zipBuffer.length.toString());

    return new NextResponse(zipBuffer, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Failed to download renderings' }, { status: 500 });
  }
}
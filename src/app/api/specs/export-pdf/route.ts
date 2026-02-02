import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { generateSpecPDF, SpecPDFItem, SpecPDFOptions } from '@/lib/spec-pdf-generator'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for PDF generation

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectName, items, options } = body

    if (!projectName || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Project name and items are required' },
        { status: 400 }
      )
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 }
      )
    }

    // Generate the PDF
    const pdfOptions: SpecPDFOptions = {
      projectName,
      includeCover: options?.includeCover ?? true,
      coverStyle: options?.coverStyle || 'dark',
      showBrand: options?.showBrand ?? true,
      showSupplier: options?.showSupplier ?? false,
      showPricing: options?.showPricing ?? false,
      showDetails: options?.showDetails ?? true,
      showDimensions: options?.showDimensions ?? true,
      showFinish: options?.showFinish ?? true,
      showColor: options?.showColor ?? true,
      showMaterial: options?.showMaterial ?? true,
      showNotes: options?.showNotes ?? true,
      showLink: options?.showLink ?? true,
      showLeadTime: options?.showLeadTime ?? false,
      style: options?.style || 'grid',
      pageSize: options?.pageSize || '24x36',
      groupBy: options?.groupBy || 'category'
    }

    const pdfBytes = await generateSpecPDF(items as SpecPDFItem[], pdfOptions)

    // Generate unique filename with date
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '') // HHMM
    const sanitizedName = projectName.replace(/[^a-zA-Z0-9]/g, '-')
    const filename = `${sanitizedName}-specs-${dateStr}-${timeStr}.pdf`

    // Return the PDF as a downloadable file
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBytes.length.toString()
      }
    })

  } catch (error) {
    console.error('Error generating spec PDF:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}

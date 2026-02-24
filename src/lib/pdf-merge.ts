import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StampableAttachment {
  filename: string
  content: string        // base64
  contentType: string
  drawingNumber?: string
  revisionNumber?: number
  title?: string
}

interface StampInfo {
  drawingNumber?: string
  revisionNumber?: number
  title?: string
  date?: string
}

// ─── stampPdfPages ──────────────────────────────────────────────────────────

/**
 * Stamp each page of a PDF with a small centered footer containing drawing info.
 * Returns the stamped PDF bytes, or the original bytes unchanged if the PDF
 * cannot be loaded (encrypted/corrupt).
 */
export async function stampPdfPages(
  pdfBytes: Uint8Array,
  stampInfo: StampInfo
): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontSize = 7
    const color = rgb(0.55, 0.55, 0.55)

    // Build stamp text: "A-101  |  Rev 2  |  Kitchen Floor Plan  |  Feb 23, 2026"
    const parts: string[] = []
    if (stampInfo.drawingNumber) parts.push(stampInfo.drawingNumber)
    if (stampInfo.revisionNumber !== undefined) parts.push(`Rev ${stampInfo.revisionNumber}`)
    if (stampInfo.title) parts.push(stampInfo.title)
    if (stampInfo.date) parts.push(stampInfo.date)

    const stampText = parts.join('  |  ')
    if (!stampText) return pdfBytes

    const pages = pdfDoc.getPages()
    for (const page of pages) {
      const { width } = page.getSize()
      const textWidth = font.widthOfTextAtSize(stampText, fontSize)
      const x = (width - textWidth) / 2
      page.drawText(stampText, {
        x,
        y: 15,
        size: fontSize,
        font,
        color,
      })
    }

    return pdfDoc.save()
  } catch (err) {
    console.warn('[pdf-merge] Failed to stamp PDF, returning original bytes:', (err as Error)?.message)
    return pdfBytes
  }
}

// ─── stampAndMergePdfs ──────────────────────────────────────────────────────

/**
 * Stamp each PDF attachment with drawing info, then merge all PDFs into a single
 * combined document. Non-PDF attachments are returned separately.
 *
 * Falls back to individual stamped attachments if the combined size exceeds 24MB,
 * or to original unstamped attachments if all PDFs fail to load.
 */
export async function stampAndMergePdfs(
  attachments: StampableAttachment[],
  combinedFilename: string
): Promise<{
  pdfAttachment: { filename: string; content: string; contentType: string } | null
  nonPdfAttachments: { filename: string; content: string; contentType: string }[]
}> {
  const MAX_SIZE = 24 * 1024 * 1024 // 24MB Resend limit

  const pdfAttachments: StampableAttachment[] = []
  const nonPdfAttachments: { filename: string; content: string; contentType: string }[] = []

  // Separate PDF vs non-PDF
  for (const att of attachments) {
    if (att.contentType === 'application/pdf') {
      pdfAttachments.push(att)
    } else {
      nonPdfAttachments.push({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })
    }
  }

  if (pdfAttachments.length === 0) {
    return { pdfAttachment: null, nonPdfAttachments }
  }

  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // Stamp each PDF individually
  const stampedPdfs: Uint8Array[] = []
  let allFailed = true

  for (const att of pdfAttachments) {
    const rawBytes = Uint8Array.from(Buffer.from(att.content, 'base64'))
    try {
      const stamped = await stampPdfPages(rawBytes, {
        drawingNumber: att.drawingNumber,
        revisionNumber: att.revisionNumber,
        title: att.title,
        date: today,
      })
      stampedPdfs.push(stamped)
      allFailed = false
    } catch {
      // If stamping fails, use original bytes
      stampedPdfs.push(rawBytes)
      allFailed = false
    }
  }

  if (allFailed) {
    // All PDFs failed to load — fall back to original unstamped attachments
    console.warn('[pdf-merge] All PDFs failed to load, returning originals')
    return {
      pdfAttachment: pdfAttachments.length === 1
        ? { filename: pdfAttachments[0].filename, content: pdfAttachments[0].content, contentType: 'application/pdf' }
        : null,
      nonPdfAttachments: [
        ...pdfAttachments.map(a => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
        ...nonPdfAttachments,
      ],
    }
  }

  // Merge all stamped PDFs into one document
  try {
    const mergedDoc = await PDFDocument.create()

    for (const stampedBytes of stampedPdfs) {
      const srcDoc = await PDFDocument.load(stampedBytes, { ignoreEncryption: true })
      const pageIndices = srcDoc.getPageIndices()
      const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices)
      for (const page of copiedPages) {
        mergedDoc.addPage(page)
      }
    }

    const mergedBytes = await mergedDoc.save()

    // Check size limit
    if (mergedBytes.length > MAX_SIZE) {
      console.log(`[pdf-merge] Combined PDF is ${(mergedBytes.length / 1024 / 1024).toFixed(1)}MB, exceeds 24MB limit — falling back to individual stamped attachments`)
      const individualAttachments: { filename: string; content: string; contentType: string }[] = []
      for (let i = 0; i < stampedPdfs.length; i++) {
        individualAttachments.push({
          filename: pdfAttachments[i].filename,
          content: Buffer.from(stampedPdfs[i]).toString('base64'),
          contentType: 'application/pdf',
        })
      }
      return {
        pdfAttachment: null,
        nonPdfAttachments: [...individualAttachments, ...nonPdfAttachments],
      }
    }

    const mergedBase64 = Buffer.from(mergedBytes).toString('base64')

    return {
      pdfAttachment: {
        filename: combinedFilename,
        content: mergedBase64,
        contentType: 'application/pdf',
      },
      nonPdfAttachments,
    }
  } catch (err) {
    console.error('[pdf-merge] Failed to merge PDFs:', (err as Error)?.message)
    // Fall back to individual stamped attachments
    const individualAttachments: { filename: string; content: string; contentType: string }[] = []
    for (let i = 0; i < stampedPdfs.length; i++) {
      individualAttachments.push({
        filename: pdfAttachments[i].filename,
        content: Buffer.from(stampedPdfs[i]).toString('base64'),
        contentType: 'application/pdf',
      })
    }
    return {
      pdfAttachment: null,
      nonPdfAttachments: [...individualAttachments, ...nonPdfAttachments],
    }
  }
}

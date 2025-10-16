import { PDFDocument, PDFPage, StandardFonts, rgb, PageSizes } from 'pdf-lib'
import { put } from '@vercel/blob'

interface CoverPageData {
  clientName: string
  projectName: string
  address: string
  companyLogo?: string
  description: string
  includedSections: string[]
}

interface SpecBookSection {
  id: string
  type: string
  name: string
  roomId?: string
  renderingUrl?: string
  dropboxFiles: Array<{
    id: string
    dropboxPath: string
    fileName: string
    cadToPdfCacheUrl?: string
  }>
  room?: {
    id: string
    name: string
    type: string
  }
}

interface GenerationOptions {
  projectId: string
  coverPageData: CoverPageData
  selectedSections: SpecBookSection[]
  selectedRooms: Array<{
    id: string
    name: string
    type: string
    renderingUrl?: string
    cadFiles: Array<{
      fileName: string
      pdfUrl: string
    }>
  }>
  generatedById: string
}

interface GenerationResult {
  success: boolean
  pdfUrl?: string
  fileSize?: number
  pageCount?: number
  error?: string
}

class PDFGenerationService {
  private static readonly TABLOID_SIZE = [1224, 792] as const // 17" x 11" landscape at 72 DPI
  private static readonly MARGIN = 72 // 1 inch margin
  private static readonly CONTENT_WIDTH = PDFGenerationService.TABLOID_SIZE[0] - (PDFGenerationService.MARGIN * 2)
  private static readonly CONTENT_HEIGHT = PDFGenerationService.TABLOID_SIZE[1] - (PDFGenerationService.MARGIN * 2)

  /**
   * Generate a complete spec book PDF
   */
  async generateSpecBook(options: GenerationOptions): Promise<GenerationResult> {
    try {
      // Create new PDF document in landscape 17x11
      const pdfDoc = await PDFDocument.create()
      
      // Set document metadata
      pdfDoc.setTitle(`${options.coverPageData.projectName} - Spec Book`)
      pdfDoc.setAuthor('ResidentOne by Meisner Interiors')
      pdfDoc.setCreationDate(new Date())
      
      // Load fonts
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      
      // Generate pages
      await this.addCoverPage(pdfDoc, options.coverPageData, helvetica, helveticaBold)
      await this.addTableOfContents(pdfDoc, options, helvetica, helveticaBold)
      
      // Add project-level sections
      for (const section of options.selectedSections) {
        await this.addProjectSection(pdfDoc, section, helvetica, helveticaBold)
      }
      
      // Add room-specific sections
      for (const room of options.selectedRooms) {
        await this.addRoomSection(pdfDoc, room, helvetica, helveticaBold)
      }
      
      // Add page numbers
      this.addPageNumbers(pdfDoc, helvetica)
      
      // Convert to bytes
      const pdfBytes = await pdfDoc.save()
      
      // Upload to Vercel Blob
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `spec-book-${options.projectId}-${timestamp}.pdf`
      
      const blob = await put(`specbooks/generated/${fileName}`, pdfBytes, {
        access: 'public',
        contentType: 'application/pdf'
      })
      
      return {
        success: true,
        pdfUrl: blob.url,
        fileSize: pdfBytes.length,
        pageCount: pdfDoc.getPageCount()
      }
      
    } catch (error) {
      console.error('PDF generation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown PDF generation error'
      }
    }
  }
  
  /**
   * Add cover page with project information
   */
  private async addCoverPage(
    pdfDoc: PDFDocument, 
    coverData: CoverPageData, 
    font: any, 
    boldFont: any
  ) {
    const page = pdfDoc.addPage(PDFGenerationService.TABLOID_SIZE)
    const { width, height } = page.getSize()
    
    // Background color (very light gray)
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(0.98, 0.98, 0.98)
    })
    
    // Header section with company branding
    const headerHeight = 150
    page.drawRectangle({
      x: 0,
      y: height - headerHeight,
      width,
      height: headerHeight,
      color: rgb(0.2, 0.4, 0.7) // Professional blue
    })
    
    // Company name/logo area
    page.drawText('MEISNER INTERIORS', {
      x: PDFGenerationService.MARGIN,
      y: height - 60,
      size: 28,
      font: boldFont,
      color: rgb(1, 1, 1)
    })
    
    page.drawText('SPECIFICATION BOOK', {
      x: PDFGenerationService.MARGIN,
      y: height - 90,
      size: 16,
      font: font,
      color: rgb(0.9, 0.9, 0.9)
    })
    
    // Project title section
    const titleY = height - 250
    page.drawText(coverData.projectName.toUpperCase(), {
      x: PDFGenerationService.MARGIN,
      y: titleY,
      size: 36,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2)
    })
    
    // Client information
    const clientY = titleY - 80
    page.drawText('Prepared for:', {
      x: PDFGenerationService.MARGIN,
      y: clientY,
      size: 14,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    })
    
    page.drawText(coverData.clientName, {
      x: PDFGenerationService.MARGIN,
      y: clientY - 25,
      size: 20,
      font: boldFont,
      color: rgb(0.3, 0.3, 0.3)
    })
    
    if (coverData.address) {
      page.drawText(coverData.address, {
        x: PDFGenerationService.MARGIN,
        y: clientY - 50,
        size: 14,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      })
    }
    
    // Description section
    if (coverData.description) {
      const descY = clientY - 120
      page.drawText('Project Description:', {
        x: PDFGenerationService.MARGIN,
        y: descY,
        size: 14,
        font: boldFont,
        color: rgb(0.3, 0.3, 0.3)
      })
      
      // Word wrap description
      const words = coverData.description.split(' ')
      let line = ''
      let lineY = descY - 25
      const maxLineWidth = PDFGenerationService.CONTENT_WIDTH - 100
      
      for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word
        const lineWidth = font.widthOfTextAtSize(testLine, 12)
        
        if (lineWidth > maxLineWidth && line) {
          page.drawText(line, {
            x: PDFGenerationService.MARGIN,
            y: lineY,
            size: 12,
            font: font,
            color: rgb(0.4, 0.4, 0.4)
          })
          line = word
          lineY -= 20
        } else {
          line = testLine
        }
      }
      
      // Draw final line
      if (line) {
        page.drawText(line, {
          x: PDFGenerationService.MARGIN,
          y: lineY,
          size: 12,
          font: font,
          color: rgb(0.4, 0.4, 0.4)
        })
      }
    }
    
    // Date and version
    const footer = `Generated on ${new Date().toLocaleDateString()}`
    page.drawText(footer, {
      x: PDFGenerationService.MARGIN,
      y: 50,
      size: 10,
      font: font,
      color: rgb(0.6, 0.6, 0.6)
    })
  }
  
  /**
   * Add table of contents
   */
  private async addTableOfContents(
    pdfDoc: PDFDocument,
    options: GenerationOptions,
    font: any,
    boldFont: any
  ) {
    const page = pdfDoc.addPage(PDFGenerationService.TABLOID_SIZE)
    const { width, height } = page.getSize()
    
    // Title
    page.drawText('TABLE OF CONTENTS', {
      x: PDFGenerationService.MARGIN,
      y: height - 100,
      size: 24,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2)
    })
    
    let currentY = height - 150
    let pageNum = 3 // Start after cover and TOC
    
    // Project sections
    if (options.selectedSections.length > 0) {
      page.drawText('PROJECT PLANS', {
        x: PDFGenerationService.MARGIN,
        y: currentY,
        size: 16,
        font: boldFont,
        color: rgb(0.3, 0.3, 0.3)
      })
      currentY -= 30
      
      for (const section of options.selectedSections) {
        page.drawText(`${section.name}`, {
          x: PDFGenerationService.MARGIN + 30,
          y: currentY,
          size: 12,
          font: font,
          color: rgb(0.4, 0.4, 0.4)
        })
        
        page.drawText(`${pageNum}`, {
          x: width - PDFGenerationService.MARGIN - 50,
          y: currentY,
          size: 12,
          font: font,
          color: rgb(0.4, 0.4, 0.4)
        })
        
        currentY -= 25
        pageNum++
      }
      
      currentY -= 20
    }
    
    // Room sections
    if (options.selectedRooms.length > 0) {
      page.drawText('ROOM-SPECIFIC CONTENT', {
        x: PDFGenerationService.MARGIN,
        y: currentY,
        size: 16,
        font: boldFont,
        color: rgb(0.3, 0.3, 0.3)
      })
      currentY -= 30
      
      for (const room of options.selectedRooms) {
        const roomName = room.name || room.type.replace('_', ' ')
        page.drawText(roomName.toUpperCase(), {
          x: PDFGenerationService.MARGIN + 30,
          y: currentY,
          size: 12,
          font: font,
          color: rgb(0.4, 0.4, 0.4)
        })
        
        page.drawText(`${pageNum}`, {
          x: width - PDFGenerationService.MARGIN - 50,
          y: currentY,
          size: 12,
          font: font,
          color: rgb(0.4, 0.4, 0.4)
        })
        
        currentY -= 25
        pageNum += 1 + room.cadFiles.length // 1 for rendering + 1 per CAD file
      }
    }
  }
  
  /**
   * Add a project-level section (floorplans, lighting, etc.)
   */
  private async addProjectSection(
    pdfDoc: PDFDocument,
    section: SpecBookSection,
    font: any,
    boldFont: any
  ) {
    // For now, create a placeholder page for each section
    // In full implementation, this would embed the actual CAD PDFs
    const page = pdfDoc.addPage(PDFGenerationService.TABLOID_SIZE)
    const { width, height } = page.getSize()
    
    // Section header
    page.drawRectangle({
      x: PDFGenerationService.MARGIN,
      y: height - 120,
      width: PDFGenerationService.CONTENT_WIDTH,
      height: 50,
      color: rgb(0.95, 0.95, 0.95)
    })
    
    page.drawText(section.name.toUpperCase(), {
      x: PDFGenerationService.MARGIN + 20,
      y: height - 100,
      size: 20,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2)
    })
    
    // Placeholder for CAD content
    const contentY = height - 180
    const contentHeight = PDFGenerationService.CONTENT_HEIGHT - 200
    
    page.drawRectangle({
      x: PDFGenerationService.MARGIN,
      y: contentY - contentHeight,
      width: PDFGenerationService.CONTENT_WIDTH,
      height: contentHeight,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1
    })
    
    // Center text indicating CAD content will be embedded here
    page.drawText('CAD DRAWING WILL BE EMBEDDED HERE', {
      x: width / 2 - 150,
      y: height / 2,
      size: 14,
      font: font,
      color: rgb(0.6, 0.6, 0.6)
    })
    
    // List linked files
    if (section.dropboxFiles.length > 0) {
      page.drawText('Linked Files:', {
        x: PDFGenerationService.MARGIN,
        y: 150,
        size: 12,
        font: boldFont,
        color: rgb(0.4, 0.4, 0.4)
      })
      
      let fileY = 130
      for (const file of section.dropboxFiles) {
        page.drawText(`• ${file.fileName}`, {
          x: PDFGenerationService.MARGIN + 20,
          y: fileY,
          size: 10,
          font: font,
          color: rgb(0.5, 0.5, 0.5)
        })
        fileY -= 15
      }
    }
  }
  
  /**
   * Add a room-specific section with rendering and CAD files
   */
  private async addRoomSection(
    pdfDoc: PDFDocument,
    room: {
      id: string
      name: string
      type: string
      renderingUrl?: string
      cadFiles: Array<{
        fileName: string
        pdfUrl: string
      }>
    },
    font: any,
    boldFont: any
  ) {
    // Room overview page with rendering
    const page = pdfDoc.addPage(PDFGenerationService.TABLOID_SIZE)
    const { width, height } = page.getSize()
    
    const roomName = room.name || room.type.replace('_', ' ')
    
    // Room header
    page.drawRectangle({
      x: PDFGenerationService.MARGIN,
      y: height - 120,
      width: PDFGenerationService.CONTENT_WIDTH,
      height: 50,
      color: rgb(0.2, 0.4, 0.7)
    })
    
    page.drawText(roomName.toUpperCase(), {
      x: PDFGenerationService.MARGIN + 20,
      y: height - 100,
      size: 20,
      font: boldFont,
      color: rgb(1, 1, 1)
    })
    
    // Rendering placeholder
    const renderingHeight = 400
    page.drawRectangle({
      x: PDFGenerationService.MARGIN,
      y: height - 180 - renderingHeight,
      width: PDFGenerationService.CONTENT_WIDTH,
      height: renderingHeight,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 2
    })
    
    page.drawText('RENDERING IMAGE WILL BE EMBEDDED HERE', {
      x: width / 2 - 170,
      y: height - 200 - renderingHeight / 2,
      size: 14,
      font: font,
      color: rgb(0.6, 0.6, 0.6)
    })
    
    // Add separate pages for each CAD file
    for (const cadFile of room.cadFiles) {
      const cadPage = pdfDoc.addPage(PDFGenerationService.TABLOID_SIZE)
      
      // CAD file header
      cadPage.drawRectangle({
        x: PDFGenerationService.MARGIN,
        y: height - 120,
        width: PDFGenerationService.CONTENT_WIDTH,
        height: 50,
        color: rgb(0.95, 0.95, 0.95)
      })
      
      cadPage.drawText(`${roomName.toUpperCase()} - ${cadFile.fileName}`, {
        x: PDFGenerationService.MARGIN + 20,
        y: height - 100,
        size: 16,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2)
      })
      
      // CAD content placeholder
      const cadContentY = height - 180
      const cadContentHeight = PDFGenerationService.CONTENT_HEIGHT - 200
      
      cadPage.drawRectangle({
        x: PDFGenerationService.MARGIN,
        y: cadContentY - cadContentHeight,
        width: PDFGenerationService.CONTENT_WIDTH,
        height: cadContentHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1
      })
      
      cadPage.drawText('CAD DRAWING WILL BE EMBEDDED HERE', {
        x: width / 2 - 150,
        y: height / 2,
        size: 14,
        font: font,
        color: rgb(0.6, 0.6, 0.6)
      })
    }
  }
  
  /**
   * Add page numbers to all pages except cover
   */
  private addPageNumbers(pdfDoc: PDFDocument, font: any) {
    const pages = pdfDoc.getPages()
    
    pages.forEach((page, index) => {
      if (index === 0) return // Skip cover page
      
      const { width } = page.getSize()
      const pageNumber = index
      
      page.drawText(`${pageNumber}`, {
        x: width - PDFGenerationService.MARGIN,
        y: 30,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      })
    })
  }
}

export const pdfGenerationService = new PDFGenerationService()
export type { GenerationOptions, GenerationResult }
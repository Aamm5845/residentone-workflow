import { PDFDocument, PDFPage, StandardFonts, rgb, PageSizes } from 'pdf-lib'
import { put } from '@vercel/blob'
import fs from 'fs/promises'
import path from 'path'

interface CoverPageData {
  clientName: string
  projectName: string
  address: string
  companyLogo?: string
  description: string
  specBookType?: string // e.g., "Electrical", "Full Project", "Lighting Only"
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
   * Add custom cover page from template with dynamic text
   */
  private async addCoverPage(
    pdfDoc: PDFDocument, 
    coverData: CoverPageData, 
    font: any, 
    boldFont: any
  ) {
    try {
      // Read the custom cover PDF template
      const coverTemplatePath = path.join(process.cwd(), 'public', 'SPEC COVER.pdf')
      
      const coverPdfBytes = await fs.readFile(coverTemplatePath)
      
      const coverPdf = await PDFDocument.load(coverPdfBytes)
      
      // Copy the cover page to our document
      const [coverPage] = await pdfDoc.copyPages(coverPdf, [0])
      pdfDoc.addPage(coverPage)
      
      // Add dynamic project information to the cover
      const { width, height } = coverPage.getSize()
      
      // Project info positioning
      const projectNameX = width - PDFGenerationService.MARGIN - 300 // Right side positioning
      let currentY = 175 // Start higher to accommodate spec book type
      
      // Spec book type (if provided) - positioned at top of project info
      if (coverData.specBookType) {
        coverPage.drawText(coverData.specBookType.toUpperCase(), {
          x: projectNameX,
          y: currentY,
          size: 12,
          font: font,
          color: rgb(0.6, 0.6, 0.6) // Lighter gray for spec book type
        })
        currentY -= 25
      }
      
      // Project name (bold) - positioned below spec book type
      const projectNameY = currentY
      
      coverPage.drawText(coverData.projectName, {
        x: projectNameX,
        y: projectNameY,
        size: 16,
        font: boldFont,
        color: rgb(0.4, 0.4, 0.4) // Subtle gray to match minimalist design
      })
      
      // Address (regular font) - positioned below project name
      if (coverData.address) {
        coverPage.drawText(coverData.address, {
          x: projectNameX,
          y: projectNameY - 25,
          size: 12,
          font: font,
          color: rgb(0.5, 0.5, 0.5) // Lighter gray for address
        })
      }
      
      // Print date - positioned much lower on the page, independent of other content
      const printDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      
      // Position date at the very bottom of the page, independent of address
      coverPage.drawText(printDate, {
        x: projectNameX,
        y: 80, // Much lower - near bottom margin
        size: 10,
        font: font,
        color: rgb(0.6, 0.6, 0.6) // Even lighter gray for date
      })
      
    } catch (error) {
      console.error('❌ Error loading cover template, using fallback:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      // Fallback to minimalist generated cover if template fails
      
      await this.addMinimalistCover(pdfDoc, coverData, font, boldFont)
    }
  }
  
  /**
   * Fallback minimalist cover generation
   */
  private async addMinimalistCover(
    pdfDoc: PDFDocument,
    coverData: CoverPageData,
    font: any,
    boldFont: any
  ) {
    const page = pdfDoc.addPage(PDFGenerationService.TABLOID_SIZE)
    const { width, height } = page.getSize()
    
    // Clean white background
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1)
    })
    
    // Minimalist SPECBOOK title - centered
    page.drawText('SPECBOOK', {
      x: width / 2 - 100,
      y: height / 2 + 50,
      size: 28,
      font: font,
      color: rgb(0.6, 0.6, 0.6)
    })
    
    // Thin line accent
    page.drawRectangle({
      x: width / 2 - 100,
      y: height / 2 + 20,
      width: 200,
      height: 0.5,
      color: rgb(0.7, 0.7, 0.7)
    })
    
    // Company logo/name - bottom left
    page.drawText('M', {
      x: PDFGenerationService.MARGIN,
      y: 150,
      size: 20,
      font: boldFont,
      color: rgb(0.4, 0.4, 0.4)
    })
    
    page.drawText('MEISNER', {
      x: PDFGenerationService.MARGIN,
      y: 120,
      size: 12,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    })
    
    // Project details - bottom right
    const rightX = width - PDFGenerationService.MARGIN - 300
    let detailY = 175
    
    // Spec book type (if provided)
    if (coverData.specBookType) {
      page.drawText(coverData.specBookType.toUpperCase(), {
        x: rightX,
        y: detailY,
        size: 12,
        font: font,
        color: rgb(0.6, 0.6, 0.6)
      })
      detailY -= 25
    }
    
    page.drawText(coverData.projectName, {
      x: rightX,
      y: detailY,
      size: 16,
      font: boldFont,
      color: rgb(0.4, 0.4, 0.4)
    })
    
    detailY -= 25 // Space after project name
    
    if (coverData.address) {
      page.drawText(coverData.address, {
        x: rightX,
        y: detailY,
        size: 12,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      })
    }
    
    // Print date - positioned much lower, independent of other content
    const printDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    
    page.drawText(printDate, {
      x: rightX,
      y: 80, // Much lower - near bottom margin
      size: 10,
      font: font,
      color: rgb(0.6, 0.6, 0.6)
    })
  }
  
  /**
   * Add minimalistic table of contents
   */
  private async addTableOfContents(
    pdfDoc: PDFDocument,
    options: GenerationOptions,
    font: any,
    boldFont: any
  ) {
    const page = pdfDoc.addPage(PDFGenerationService.TABLOID_SIZE)
    const { width, height } = page.getSize()
    
    // Clean white background
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1)
    })
    
    // Minimalist title
    page.drawText('CONTENTS', {
      x: PDFGenerationService.MARGIN,
      y: height - 120,
      size: 18,
      font: font,
      color: rgb(0.4, 0.4, 0.4)
    })
    
    // Subtle line under title
    page.drawRectangle({
      x: PDFGenerationService.MARGIN,
      y: height - 135,
      width: 120,
      height: 0.5,
      color: rgb(0.7, 0.7, 0.7)
    })
    
    let currentY = height - 180
    let pageNum = 3 // Start after cover and TOC
    
    // Project sections with minimal styling
    if (options.selectedSections.length > 0) {
      page.drawText('PROJECT PLANS', {
        x: PDFGenerationService.MARGIN,
        y: currentY,
        size: 12,
        font: boldFont,
        color: rgb(0.5, 0.5, 0.5)
      })
      currentY -= 40
      
      for (const section of options.selectedSections) {
        page.drawText(section.name, {
          x: PDFGenerationService.MARGIN + 20,
          y: currentY,
          size: 11,
          font: font,
          color: rgb(0.6, 0.6, 0.6)
        })
        
        // Dotted line for page numbers
        const dots = '.'.repeat(Math.floor((width - PDFGenerationService.MARGIN * 2 - 250) / 6))
        page.drawText(dots, {
          x: PDFGenerationService.MARGIN + 220,
          y: currentY,
          size: 10,
          font: font,
          color: rgb(0.8, 0.8, 0.8)
        })
        
        page.drawText(`${pageNum}`, {
          x: width - PDFGenerationService.MARGIN - 30,
          y: currentY,
          size: 11,
          font: font,
          color: rgb(0.6, 0.6, 0.6)
        })
        
        currentY -= 25
        pageNum++
      }
      
      currentY -= 30
    }
    
    // Room sections with minimal styling
    if (options.selectedRooms.length > 0) {
      page.drawText('ROOMS', {
        x: PDFGenerationService.MARGIN,
        y: currentY,
        size: 12,
        font: boldFont,
        color: rgb(0.5, 0.5, 0.5)
      })
      currentY -= 40
      
      for (const room of options.selectedRooms) {
        const roomName = room.name || room.type.replace('_', ' ')
        page.drawText(roomName, {
          x: PDFGenerationService.MARGIN + 20,
          y: currentY,
          size: 11,
          font: font,
          color: rgb(0.6, 0.6, 0.6)
        })
        
        // Dotted line
        const dots = '.'.repeat(Math.floor((width - PDFGenerationService.MARGIN * 2 - 250) / 6))
        page.drawText(dots, {
          x: PDFGenerationService.MARGIN + 220,
          y: currentY,
          size: 10,
          font: font,
          color: rgb(0.8, 0.8, 0.8)
        })
        
        page.drawText(`${pageNum}`, {
          x: width - PDFGenerationService.MARGIN - 30,
          y: currentY,
          size: 11,
          font: font,
          color: rgb(0.6, 0.6, 0.6)
        })
        
        currentY -= 25
        pageNum += 1 + room.cadFiles.length // 1 for rendering + 1 per CAD file
      }
    }
  }
  
  /**
   * Add a minimalistic project-level section
   */
  private async addProjectSection(
    pdfDoc: PDFDocument,
    section: SpecBookSection,
    font: any,
    boldFont: any
  ) {
    const page = pdfDoc.addPage(PDFGenerationService.TABLOID_SIZE)
    const { width, height } = page.getSize()
    
    // Clean white background
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1)
    })
    
    // Minimal section header
    page.drawText(section.name, {
      x: PDFGenerationService.MARGIN,
      y: height - 120,
      size: 16,
      font: font,
      color: rgb(0.4, 0.4, 0.4)
    })
    
    // Subtle line under header
    page.drawRectangle({
      x: PDFGenerationService.MARGIN,
      y: height - 135,
      width: section.name.length * 8,
      height: 0.5,
      color: rgb(0.7, 0.7, 0.7)
    })
    
    // Embed actual converted CAD PDFs if available
    if (section.dropboxFiles.length > 0) {
      const contentY = height - 180
      const contentHeight = PDFGenerationService.CONTENT_HEIGHT - 220
      
      let currentY = contentY
      let filesEmbedded = 0
      
      for (const file of section.dropboxFiles) {
        if (file.cadToPdfCacheUrl && filesEmbedded === 0) { // Only embed first file on section page
          try {
            console.log(`[PDF-Generation] Embedding CAD PDF from ${file.cadToPdfCacheUrl}`)
            
            // Download the converted PDF
            const response = await fetch(file.cadToPdfCacheUrl)
            if (response.ok) {
              const cadPdfBytes = await response.arrayBuffer()
              const cadPdf = await PDFDocument.load(cadPdfBytes)
              
              // Get first page of the CAD PDF
              const cadPages = await pdfDoc.copyPages(cadPdf, [0])
              const cadPage = cadPages[0]
              
              // Calculate scaling to fit within content area while maintaining aspect ratio
              const cadPageSize = cadPage.getSize()
              const scale = Math.min(
                PDFGenerationService.CONTENT_WIDTH / cadPageSize.width,
                contentHeight / cadPageSize.height
              )
              
              const scaledWidth = cadPageSize.width * scale
              const scaledHeight = cadPageSize.height * scale
              
              // Center the CAD content within the available area
              const x = PDFGenerationService.MARGIN + (PDFGenerationService.CONTENT_WIDTH - scaledWidth) / 2
              const y = currentY - contentHeight + (contentHeight - scaledHeight) / 2
              
              // Add the CAD page to our document with scaling and positioning
              const finalPage = pdfDoc.addPage(cadPage)
              
              // Apply transformations to the added page
              finalPage.scaleContent(scale, scale)
              finalPage.translateContent(x, y)
              
              // Remove the original section page since we're replacing it with CAD content
              pdfDoc.removePage(pdfDoc.getPageCount() - 2)
              
              filesEmbedded++
              console.log(`[PDF-Generation] Successfully embedded ${file.fileName}`)
              break // Only embed one file per section page
            }
          } catch (error) {
            console.error(`[PDF-Generation] Failed to embed CAD PDF ${file.fileName}:`, error)
            // Fall back to placeholder
          }
        }
      }
      
      // If no files were embedded, show placeholder
      if (filesEmbedded === 0) {
        // Thin border for content area
        page.drawRectangle({
          x: PDFGenerationService.MARGIN,
          y: contentY - contentHeight,
          width: PDFGenerationService.CONTENT_WIDTH,
          height: contentHeight,
          color: rgb(1, 1, 1),
          borderColor: rgb(0.9, 0.9, 0.9),
          borderWidth: 0.5
        })
        
        page.drawText('CAD files linked but not yet converted', {
          x: width / 2 - 120,
          y: height / 2,
          size: 12,
          font: font,
          color: rgb(0.8, 0.8, 0.8)
        })
      }
    } else {
      // No files linked
      const contentY = height - 180
      const contentHeight = PDFGenerationService.CONTENT_HEIGHT - 220
      
      page.drawRectangle({
        x: PDFGenerationService.MARGIN,
        y: contentY - contentHeight,
        width: PDFGenerationService.CONTENT_WIDTH,
        height: contentHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.9, 0.9, 0.9),
        borderWidth: 0.5
      })
      
      page.drawText('No CAD files linked', {
        x: width / 2 - 80,
        y: height / 2,
        size: 12,
        font: font,
        color: rgb(0.8, 0.8, 0.8)
      })
    }
    
    // List linked files in minimal style
    if (section.dropboxFiles.length > 0) {
      page.drawText('Files', {
        x: PDFGenerationService.MARGIN,
        y: 170,
        size: 10,
        font: boldFont,
        color: rgb(0.5, 0.5, 0.5)
      })
      
      let fileY = 150
      for (const file of section.dropboxFiles) {
        page.drawText(file.fileName, {
          x: PDFGenerationService.MARGIN,
          y: fileY,
          size: 9,
          font: font,
          color: rgb(0.6, 0.6, 0.6)
        })
        fileY -= 12
      }
    }
  }
  
  /**
   * Add a minimalistic room-specific section
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
    
    // Clean white background
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1)
    })
    
    const roomName = room.name || room.type.replace('_', ' ')
    
    // Minimal room header
    page.drawText(roomName, {
      x: PDFGenerationService.MARGIN,
      y: height - 120,
      size: 16,
      font: font,
      color: rgb(0.4, 0.4, 0.4)
    })
    
    // Subtle line under header
    page.drawRectangle({
      x: PDFGenerationService.MARGIN,
      y: height - 135,
      width: roomName.length * 8,
      height: 0.5,
      color: rgb(0.7, 0.7, 0.7)
    })
    
    // Add actual rendering image if available
    if (room.renderingUrl) {
      try {
        
        // Fetch the image from the URL
        const response = await fetch(room.renderingUrl)
        if (response.ok) {
          const imageBytes = await response.arrayBuffer()
          
          // Embed the image based on type
          let image
          const contentType = response.headers.get('content-type') || ''
          if (contentType.includes('png')) {
            image = await pdfDoc.embedPng(imageBytes)
          } else {
            image = await pdfDoc.embedJpg(imageBytes)
          }
          
          // Calculate dimensions to fit within the rendering area while maintaining aspect ratio
          const maxWidth = PDFGenerationService.CONTENT_WIDTH - 40
          const maxHeight = 350
          
          const { width: imgWidth, height: imgHeight } = image
          const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight)
          
          const scaledWidth = imgWidth * scale
          const scaledHeight = imgHeight * scale
          
          // Center the image in the rendering area
          const imageX = PDFGenerationService.MARGIN + (PDFGenerationService.CONTENT_WIDTH - scaledWidth) / 2
          const imageY = height - 180 - maxHeight + (maxHeight - scaledHeight) / 2
          
          // Draw the actual rendering image
          page.drawImage(image, {
            x: imageX,
            y: imageY,
            width: scaledWidth,
            height: scaledHeight
          })

        } else {
          throw new Error(`Failed to fetch image: ${response.status}`)
        }
      } catch (error) {
        console.error('❌ Error loading rendering image:', error)
        // Fallback to placeholder if image loading fails
        this.addRenderingPlaceholder(page, font, width, height)
      }
    } else {
      // No rendering URL provided, show placeholder
      this.addRenderingPlaceholder(page, font, width, height)
    }
    
    // Add separate minimalist pages for each CAD file
    for (const cadFile of room.cadFiles) {
      const cadPage = pdfDoc.addPage(PDFGenerationService.TABLOID_SIZE)
      const { width: cadWidth, height: cadHeight } = cadPage.getSize()
      
      // Clean white background
      cadPage.drawRectangle({
        x: 0,
        y: 0,
        width: cadWidth,
        height: cadHeight,
        color: rgb(1, 1, 1)
      })
      
      // Minimal CAD file header
      cadPage.drawText(`${roomName} — ${cadFile.fileName}`, {
        x: PDFGenerationService.MARGIN,
        y: cadHeight - 120,
        size: 14,
        font: font,
        color: rgb(0.4, 0.4, 0.4)
      })
      
      // Subtle line under header
      cadPage.drawRectangle({
        x: PDFGenerationService.MARGIN,
        y: cadHeight - 135,
        width: (roomName.length + cadFile.fileName.length + 3) * 7,
        height: 0.5,
        color: rgb(0.7, 0.7, 0.7)
      })
      
      // Minimalist CAD content area
      const cadContentY = cadHeight - 180
      const cadContentHeight = PDFGenerationService.CONTENT_HEIGHT - 200
      
      cadPage.drawRectangle({
        x: PDFGenerationService.MARGIN,
        y: cadContentY - cadContentHeight,
        width: PDFGenerationService.CONTENT_WIDTH,
        height: cadContentHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.9, 0.9, 0.9),
        borderWidth: 0.5
      })
      
      // Embed the actual CAD PDF if available
      if (cadFile.pdfUrl) {
        try {
          console.log(`[PDF-Generation] Embedding room CAD PDF from ${cadFile.pdfUrl}`)
          
          // Download the converted PDF
          const response = await fetch(cadFile.pdfUrl)
          if (response.ok) {
            const cadPdfBytes = await response.arrayBuffer()
            const cadPdf = await PDFDocument.load(cadPdfBytes)
            
            // Get first page of the CAD PDF
            const cadPages = await pdfDoc.copyPages(cadPdf, [0])
            const embeddedCadPage = cadPages[0]
            
            // Calculate scaling to fit within content area
            const cadPageSize = embeddedCadPage.getSize()
            const scale = Math.min(
              PDFGenerationService.CONTENT_WIDTH / cadPageSize.width,
              cadContentHeight / cadPageSize.height
            )
            
            const scaledWidth = cadPageSize.width * scale
            const scaledHeight = cadPageSize.height * scale
            
            // Center the CAD content
            const x = PDFGenerationService.MARGIN + (PDFGenerationService.CONTENT_WIDTH - scaledWidth) / 2
            const y = cadContentY - cadContentHeight + (cadContentHeight - scaledHeight) / 2
            
            // Scale and position the CAD page
            embeddedCadPage.scale(scale, scale)
            embeddedCadPage.translateTo(x, y)
            
            // Replace the current CAD page with the embedded one
            pdfDoc.addPage(embeddedCadPage)
            pdfDoc.removePage(pdfDoc.getPageCount() - 2) // Remove the placeholder page
            
            console.log(`[PDF-Generation] Successfully embedded room CAD ${cadFile.fileName}`)
          } else {
            throw new Error(`Failed to fetch CAD PDF: ${response.status}`)
          }
        } catch (error) {
          console.error(`[PDF-Generation] Failed to embed room CAD PDF ${cadFile.fileName}:`, error)
          // Fall back to placeholder
          cadPage.drawText('CAD file conversion failed', {
            x: cadWidth / 2 - 100,
            y: cadHeight / 2,
            size: 12,
            font: font,
            color: rgb(0.8, 0.8, 0.8)
          })
        }
      } else {
        // No converted PDF available
        cadPage.drawText('CAD file not yet converted', {
          x: cadWidth / 2 - 90,
          y: cadHeight / 2,
          size: 12,
          font: font,
          color: rgb(0.8, 0.8, 0.8)
        })
      }
    }
  }
  
  /**
   * Add rendering placeholder when no image is available
   */
  private addRenderingPlaceholder(page: PDFPage, font: any, width: number, height: number) {
    const renderingHeight = 350
    const renderingY = height - 180 - renderingHeight
    
    // Minimalist rendering area with border
    page.drawRectangle({
      x: PDFGenerationService.MARGIN,
      y: renderingY,
      width: PDFGenerationService.CONTENT_WIDTH,
      height: renderingHeight,
      color: rgb(0.98, 0.98, 0.98),
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 0.5
    })
    
    page.drawText('No rendering image uploaded', {
      x: width / 2 - 85,
      y: renderingY + renderingHeight / 2,
      size: 12,
      font: font,
      color: rgb(0.7, 0.7, 0.7)
    })
  }

  /**
   * Add minimalistic page numbers to all pages except cover
   */
  private addPageNumbers(pdfDoc: PDFDocument, font: any) {
    const pages = pdfDoc.getPages()
    
    pages.forEach((page, index) => {
      if (index === 0) return // Skip cover page
      
      const { width } = page.getSize()
      const pageNumber = index
      
      page.drawText(`${pageNumber}`, {
        x: width - PDFGenerationService.MARGIN - 10,
        y: 40,
        size: 9,
        font: font,
        color: rgb(0.7, 0.7, 0.7)
      })
    })
  }
}

export const pdfGenerationService = new PDFGenerationService()
export type { GenerationOptions, GenerationResult }
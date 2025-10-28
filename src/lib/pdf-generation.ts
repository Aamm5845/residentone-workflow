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
    renderingUrls?: string[]
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
  private static readonly PAGE_SIZE = [2592, 1728] as const // 36" x 24" landscape at 72 DPI
  private static readonly MARGIN = 100 // Margin in points
  private static readonly CONTENT_WIDTH = PDFGenerationService.PAGE_SIZE[0] - (PDFGenerationService.MARGIN * 2)
  private static readonly CONTENT_HEIGHT = PDFGenerationService.PAGE_SIZE[1] - (PDFGenerationService.MARGIN * 2)
  
  // Design colors
  private static readonly BRAND_COLOR = rgb(0.2, 0.2, 0.25) // Dark charcoal
  private static readonly ACCENT_COLOR = rgb(0.7, 0.65, 0.6) // Warm taupe
  private static readonly TEXT_COLOR = rgb(0.3, 0.3, 0.3) // Dark gray
  private static readonly LIGHT_TEXT = rgb(0.6, 0.6, 0.6) // Light gray

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

      // Add placeholder TOC page (will be updated later)
      const tocPageIndex = pdfDoc.getPageCount()
      const tocPage = pdfDoc.addPage(PDFGenerationService.PAGE_SIZE)
      
      // Track section page numbers as we add them
      const sectionPageNumbers: { name: string; pageNum: number }[] = []
      const roomPageNumbers: { name: string; pageNum: number }[] = []
      
      // Add project-level sections
      for (const section of options.selectedSections) {
        const beforePageCount = pdfDoc.getPageCount()
        await this.addProjectSection(pdfDoc, section, helvetica, helveticaBold)
        const afterPageCount = pdfDoc.getPageCount()
        // Page number is the first page of this section (in 1-based numbering)
        sectionPageNumbers.push({ name: section.name, pageNum: beforePageCount })
      }
      
      // Add room-specific sections
      for (const room of options.selectedRooms) {
        const beforePageCount = pdfDoc.getPageCount()
        await this.addRoomSection(pdfDoc, room, helvetica, helveticaBold)
        const afterPageCount = pdfDoc.getPageCount()
        const roomName = room.name || room.type.replace('_', ' ')
        // Page number is the first page of this room (in 1-based numbering)
        roomPageNumbers.push({ name: roomName, pageNum: beforePageCount })
      }
      
      // Now update the TOC with actual page numbers
      await this.updateTableOfContents(pdfDoc, tocPageIndex, sectionPageNumbers, roomPageNumbers, helvetica, helveticaBold)
      
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
      // Read the custom cover PDF template (NEW COVER with black background)
      const coverTemplatePath = path.join(process.cwd(), 'public', 'NEW COVER.pdf')
      
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
      // WHITE text for black background
      if (coverData.specBookType) {
        coverPage.drawText(coverData.specBookType.toUpperCase(), {
          x: projectNameX,
          y: currentY,
          size: 12,
          font: font,
          color: rgb(1, 1, 1) // White text on black background
        })
        currentY -= 25
      }
      
      // Project name (bold) - positioned below spec book type
      // WHITE text for black background
      const projectNameY = currentY
      
      coverPage.drawText(coverData.projectName, {
        x: projectNameX,
        y: projectNameY,
        size: 16,
        font: boldFont,
        color: rgb(1, 1, 1) // White text on black background
      })
      
      // Address (regular font) - positioned below project name
      // WHITE text for black background
      if (coverData.address) {
        coverPage.drawText(coverData.address, {
          x: projectNameX,
          y: projectNameY - 25,
          size: 12,
          font: font,
          color: rgb(1, 1, 1) // White text on black background
        })
      }
      
      // Print date - positioned much lower on the page, independent of other content
      // WHITE text for black background
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
        color: rgb(1, 1, 1) // White text on black background
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
    const page = pdfDoc.addPage(PDFGenerationService.PAGE_SIZE)
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
   * Update table of contents with actual page numbers after all pages are generated
   */
  private async updateTableOfContents(
    pdfDoc: PDFDocument,
    tocPageIndex: number,
    sectionPageNumbers: { name: string; pageNum: number }[],
    roomPageNumbers: { name: string; pageNum: number }[],
    font: any,
    boldFont: any
  ) {
    const page = pdfDoc.getPage(tocPageIndex)
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
    
    // Project sections with minimal styling
    if (sectionPageNumbers.length > 0) {
      page.drawText('PROJECT PLANS', {
        x: PDFGenerationService.MARGIN,
        y: currentY,
        size: 12,
        font: boldFont,
        color: rgb(0.5, 0.5, 0.5)
      })
      currentY -= 40
      
      for (const section of sectionPageNumbers) {
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
        
        page.drawText(`${section.pageNum}`, {
          x: width - PDFGenerationService.MARGIN - 30,
          y: currentY,
          size: 11,
          font: font,
          color: rgb(0.6, 0.6, 0.6)
        })
        
        currentY -= 25
      }
      
      currentY -= 30
    }
    
    // Room sections with minimal styling
    if (roomPageNumbers.length > 0) {
      page.drawText('ROOMS', {
        x: PDFGenerationService.MARGIN,
        y: currentY,
        size: 12,
        font: boldFont,
        color: rgb(0.5, 0.5, 0.5)
      })
      currentY -= 40
      
      for (const room of roomPageNumbers) {
        page.drawText(room.name, {
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
        
        page.drawText(`${room.pageNum}`, {
          x: width - PDFGenerationService.MARGIN - 30,
          y: currentY,
          size: 11,
          font: font,
          color: rgb(0.6, 0.6, 0.6)
        })
        
        currentY -= 25
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
    const page = pdfDoc.addPage(PDFGenerationService.PAGE_SIZE)
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
      
      // Remember the placeholder page index before adding CAD pages
      const placeholderPageIndex = pdfDoc.getPageCount() - 1
      
      for (const file of section.dropboxFiles) {
        // Support both CAD-converted PDFs and directly uploaded PDFs
        const pdfUrl = file.uploadedPdfUrl || file.cadToPdfCacheUrl
        
        if (pdfUrl) {
          try {
            console.log(`[PDF-Generation] Embedding PDF from ${pdfUrl}`)
            
            // Download the PDF
            const response = await fetch(pdfUrl)
            if (response.ok) {
              const cadPdfBytes = await response.arrayBuffer()
              const cadPdf = await PDFDocument.load(cadPdfBytes)
              
              // Get ALL pages of the CAD PDF
              const pageCount = cadPdf.getPageCount()
              const pageIndices = Array.from({ length: pageCount }, (_, i) => i)
              const cadPages = await pdfDoc.copyPages(cadPdf, pageIndices)
              
              // Add each page at full size (no scaling)
              for (const cadPage of cadPages) {
                pdfDoc.addPage(cadPage)
                filesEmbedded++
              }
              
              console.log(`[PDF-Generation] Successfully embedded ${pageCount} page(s) from ${file.fileName}`)
            }
          } catch (error) {
            console.error(`[PDF-Generation] Failed to embed CAD PDF ${file.fileName}:`, error)
            // Fall back to placeholder
          }
        }
      }
      
      // Remove the original placeholder section page if files were embedded
      if (filesEmbedded > 0) {
        pdfDoc.removePage(placeholderPageIndex)
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
      renderingUrls?: string[]
      cadFiles: Array<{
        fileName: string
        pdfUrl: string
      }>
    },
    font: any,
    boldFont: any
  ) {
    // Room overview page with rendering
    const page = pdfDoc.addPage(PDFGenerationService.PAGE_SIZE)
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
    
    // Add professional page decoration
    await this.addPageDecoration(pdfDoc, page, roomName, 'RENDERING', font, boldFont)
    
    // Get all rendering URLs (support both new array and legacy single URL)
    const renderingUrls = room.renderingUrls && room.renderingUrls.length > 0
      ? room.renderingUrls
      : room.renderingUrl ? [room.renderingUrl] : []
    
    // Add rendering images - create a page for each
    if (renderingUrls.length > 0) {
      for (let renderingIndex = 0; renderingIndex < renderingUrls.length; renderingIndex++) {
        const renderingUrl = renderingUrls[renderingIndex]
        // Use the main page for the first rendering, create new pages for additional renderings
        const currentPage = renderingIndex === 0 ? page : pdfDoc.addPage(PDFGenerationService.PAGE_SIZE)
        const { width: pageWidth, height: pageHeight } = currentPage.getSize()
        
        if (renderingIndex > 0) {
          // For additional pages, add the same styling
          currentPage.drawRectangle({
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
            color: rgb(1, 1, 1)
          })
          
          // Add professional page decoration
          await this.addPageDecoration(pdfDoc, currentPage, roomName, `RENDERING ${renderingIndex + 1}`, font, boldFont)
        }
        
        try {
          // Fetch the image from the URL
          const response = await fetch(renderingUrl)
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
            
            // Calculate dimensions to maximize image size while maintaining aspect ratio
            // Account for header (150pts) and footer (80pts)
            const headerHeight = 150
            const footerHeight = 80
            const availableWidth = pageWidth - (PDFGenerationService.MARGIN * 2)
            const availableHeight = pageHeight - headerHeight - footerHeight
            
            const { width: imgWidth, height: imgHeight } = image
            const scale = Math.min(availableWidth / imgWidth, availableHeight / imgHeight)
            
            const scaledWidth = imgWidth * scale
            const scaledHeight = imgHeight * scale
            
            // Center the image in the available space
            const imageX = (pageWidth - scaledWidth) / 2
            const imageY = footerHeight + (availableHeight - scaledHeight) / 2
            
            // Draw the actual rendering image
            currentPage.drawImage(image, {
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
          this.addRenderingPlaceholder(currentPage, font, pageWidth, pageHeight)
        }
      }
    } else {
      // No rendering URLs provided, show placeholder
      this.addRenderingPlaceholder(page, font, width, height)
    }
    
    // Add separate pages for each CAD file
    for (const cadFile of room.cadFiles) {
      // Embed the actual CAD PDF if available
      if (cadFile.pdfUrl) {
        try {
          console.log(`[PDF-Generation] Embedding room CAD PDF from ${cadFile.pdfUrl}`)
          
          // Download the converted PDF
          const response = await fetch(cadFile.pdfUrl)
          if (response.ok) {
            const cadPdfBytes = await response.arrayBuffer()
            const cadPdf = await PDFDocument.load(cadPdfBytes)
            
            // Get ALL pages of the CAD PDF
            const pageCount = cadPdf.getPageCount()
            const pageIndices = Array.from({ length: pageCount }, (_, i) => i)
            const cadPages = await pdfDoc.copyPages(cadPdf, pageIndices)
            
            // Add each CAD page at full size with professional styling
            for (let pageIndex = 0; pageIndex < cadPages.length; pageIndex++) {
              const embeddedCadPage = cadPages[pageIndex]
              pdfDoc.addPage(embeddedCadPage)
              
              // Add professional page decoration on top of the CAD content
              const pageTitle = `${roomName} — ${cadFile.fileName}`
              const pageSubtitle = pageCount > 1 ? `PAGE ${pageIndex + 1} OF ${pageCount}` : 'DRAWING'
              await this.addPageDecoration(pdfDoc, embeddedCadPage, pageTitle, pageSubtitle, font, boldFont)
            }
            
            console.log(`[PDF-Generation] Successfully embedded ${pageCount} page(s) from room CAD ${cadFile.fileName}`)
          } else {
            throw new Error(`Failed to fetch CAD PDF: ${response.status}`)
          }
        } catch (error) {
          console.error(`[PDF-Generation] Failed to embed room CAD PDF ${cadFile.fileName}:`, error)
          // Create error placeholder page
          const errorPage = pdfDoc.addPage(PDFGenerationService.PAGE_SIZE)
          const { width, height } = errorPage.getSize()
          
          errorPage.drawRectangle({
            x: 0,
            y: 0,
            width,
            height,
            color: rgb(1, 1, 1)
          })
          
          await this.addPageDecoration(pdfDoc, errorPage, roomName, 'ERROR', font, boldFont)
          
          errorPage.drawText('CAD file conversion failed', {
            x: width / 2 - 120,
            y: height / 2,
            size: 18,
            font: font,
            color: rgb(0.8, 0.2, 0.2)
          })
        }
      }
    }
  }
  
  /**
   * Add professional header and footer with logo to a page
   */
  private async addPageDecoration(
    pdfDoc: PDFDocument,
    page: PDFPage,
    title: string,
    subtitle: string | null,
    font: any,
    boldFont: any
  ) {
    const { width, height } = page.getSize()
    
    try {
      // Load and embed the logo
      const logoPath = path.join(process.cwd(), 'public', 'meisnerinteriorlogo.png')
      const logoBytes = await fs.readFile(logoPath)
      const logoImage = await pdfDoc.embedPng(logoBytes)
      
      const logoHeight = 60
      const logoWidth = (logoImage.width / logoImage.height) * logoHeight
      
      // Draw logo in top left
      page.drawImage(logoImage, {
        x: PDFGenerationService.MARGIN,
        y: height - PDFGenerationService.MARGIN - logoHeight,
        width: logoWidth,
        height: logoHeight
      })
    } catch (error) {
      console.error('Failed to load logo:', error)
      // Continue without logo
    }
    
    // Top border line - elegant and thin
    page.drawRectangle({
      x: PDFGenerationService.MARGIN,
      y: height - PDFGenerationService.MARGIN,
      width: width - (PDFGenerationService.MARGIN * 2),
      height: 3,
      color: PDFGenerationService.BRAND_COLOR
    })
    
    // Title text (top right)
    const titleSize = 32
    const titleWidth = font.widthOfTextAtSize(title, titleSize)
    page.drawText(title, {
      x: width - PDFGenerationService.MARGIN - titleWidth,
      y: height - PDFGenerationService.MARGIN - 50,
      size: titleSize,
      font: boldFont,
      color: PDFGenerationService.BRAND_COLOR
    })
    
    // Subtitle (if provided)
    if (subtitle) {
      const subtitleSize = 18
      const subtitleWidth = font.widthOfTextAtSize(subtitle, subtitleSize)
      page.drawText(subtitle, {
        x: width - PDFGenerationService.MARGIN - subtitleWidth,
        y: height - PDFGenerationService.MARGIN - 80,
        size: subtitleSize,
        font: font,
        color: PDFGenerationService.TEXT_COLOR
      })
    }
    
    // Bottom border - accent color
    page.drawRectangle({
      x: PDFGenerationService.MARGIN,
      y: PDFGenerationService.MARGIN - 3,
      width: width - (PDFGenerationService.MARGIN * 2),
      height: 2,
      color: PDFGenerationService.ACCENT_COLOR
    })
    
    // Page info in bottom left
    page.drawText('MEISNER INTERIORS', {
      x: PDFGenerationService.MARGIN,
      y: PDFGenerationService.MARGIN - 30,
      size: 10,
      font: font,
      color: PDFGenerationService.LIGHT_TEXT
    })
  }
  
  /**
   * Add rendering placeholder when no image is available
   */
  private addRenderingPlaceholder(page: PDFPage, font: any, width: number, height: number) {
    // Use almost full page for placeholder to match actual rendering layout
    const availableHeight = height - 100 - PDFGenerationService.MARGIN
    const renderingY = PDFGenerationService.MARGIN + availableHeight / 4
    
    // Minimalist rendering area with border
    page.drawRectangle({
      x: PDFGenerationService.MARGIN,
      y: renderingY,
      width: PDFGenerationService.CONTENT_WIDTH,
      height: availableHeight / 2,
      color: rgb(0.98, 0.98, 0.98),
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 0.5
    })
    
    page.drawText('No rendering image uploaded', {
      x: width / 2 - 85,
      y: height / 2,
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
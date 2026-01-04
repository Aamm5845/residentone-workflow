import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib'
import * as fs from 'fs'
import * as path from 'path'

// Page dimensions (Letter size)
const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN = 50

// Colors
const BRAND_GREEN = rgb(0.06, 0.72, 0.51)
const DARK_BLUE = rgb(0.1, 0.2, 0.4)
const LIGHT_GRAY = rgb(0.95, 0.95, 0.95)
const MEDIUM_GRAY = rgb(0.5, 0.5, 0.5)
const DARK_GRAY = rgb(0.2, 0.2, 0.2)
const WHITE = rgb(1, 1, 1)
const ORANGE = rgb(0.95, 0.5, 0.1)
const BLUE = rgb(0.2, 0.4, 0.8)
const PURPLE = rgb(0.5, 0.3, 0.7)

interface Section {
  title: string
  content: string[]
  steps?: { title: string; description: string }[]
  statuses?: { status: string; description: string; color: 'green' | 'blue' | 'orange' | 'gray' | 'purple' }[]
  flowSteps?: string[]
}

async function generateWorkflowPDF() {
  const pdfDoc = await PDFDocument.create()

  pdfDoc.setTitle('Procurement System Workflow Guide')
  pdfDoc.setAuthor('Meisner Interiors')
  pdfDoc.setCreationDate(new Date())

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // ============ COVER PAGE ============
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  // Dark background header
  page.drawRectangle({
    x: 0, y: PAGE_HEIGHT - 300,
    width: PAGE_WIDTH, height: 300,
    color: DARK_BLUE
  })

  // Brand accent line
  page.drawRectangle({
    x: 0, y: PAGE_HEIGHT - 305,
    width: PAGE_WIDTH, height: 5,
    color: BRAND_GREEN
  })

  // Title
  const title = 'PROCUREMENT SYSTEM'
  const titleWidth = helveticaBold.widthOfTextAtSize(title, 36)
  page.drawText(title, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y: PAGE_HEIGHT - 120,
    size: 36,
    font: helveticaBold,
    color: WHITE
  })

  const subtitle = 'Workflow Guide'
  const subtitleWidth = helvetica.widthOfTextAtSize(subtitle, 24)
  page.drawText(subtitle, {
    x: (PAGE_WIDTH - subtitleWidth) / 2,
    y: PAGE_HEIGHT - 160,
    size: 24,
    font: helvetica,
    color: rgb(0.8, 0.8, 0.8)
  })

  // Date
  const dateText = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  const dateWidth = helvetica.widthOfTextAtSize(dateText, 14)
  page.drawText(dateText, {
    x: (PAGE_WIDTH - dateWidth) / 2,
    y: PAGE_HEIGHT - 250,
    size: 14,
    font: helvetica,
    color: rgb(0.6, 0.6, 0.6)
  })

  // Table of contents box
  page.drawRectangle({
    x: MARGIN, y: 200,
    width: PAGE_WIDTH - MARGIN * 2, height: 280,
    color: LIGHT_GRAY,
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 1
  })

  page.drawText('CONTENTS', {
    x: MARGIN + 20, y: 450,
    size: 14, font: helveticaBold, color: DARK_GRAY
  })

  const tocItems = [
    '1. System Overview',
    '2. RFQ Creation & Sending',
    '3. Supplier Portal & Quote Submission',
    '4. Quote Comparison & Acceptance',
    '5. Client Quote Creation',
    '6. Sending to Client & Payment',
    '7. Purchase Order Creation',
    '8. Order Tracking & Delivery',
    '9. Status Reference Guide'
  ]

  let tocY = 420
  for (const item of tocItems) {
    page.drawText(item, {
      x: MARGIN + 30, y: tocY,
      size: 12, font: helvetica, color: DARK_GRAY
    })
    tocY -= 22
  }

  // Company name at bottom
  page.drawText('MEISNER INTERIORS', {
    x: MARGIN, y: 50,
    size: 10, font: helvetica, color: MEDIUM_GRAY
  })

  // ============ PAGE 2: OVERVIEW ============
  page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = drawPageHeader(page, 'System Overview', helveticaBold, 1)

  y = drawParagraph(page, helvetica, helveticaBold, y,
    'The Procurement System manages the entire journey from requesting quotes from suppliers to placing orders. ' +
    'It serves as a bridge between your team, external suppliers, and clients.'
  )

  y -= 30

  // Flow diagram box
  page.drawRectangle({
    x: MARGIN, y: y - 200,
    width: PAGE_WIDTH - MARGIN * 2, height: 200,
    color: LIGHT_GRAY
  })

  const flowSteps = [
    { label: 'RFQ', desc: 'Create & Send', color: BLUE },
    { label: 'SUPPLIER', desc: 'Quote', color: ORANGE },
    { label: 'COMPARE', desc: 'Accept Best', color: PURPLE },
    { label: 'CLIENT', desc: 'Invoice', color: BRAND_GREEN },
    { label: 'ORDER', desc: 'Fulfill', color: DARK_BLUE }
  ]

  const boxWidth = 80
  const spacing = (PAGE_WIDTH - MARGIN * 2 - boxWidth * 5) / 4
  let boxX = MARGIN + 10
  const boxY = y - 120

  for (let i = 0; i < flowSteps.length; i++) {
    const step = flowSteps[i]

    // Box
    page.drawRectangle({
      x: boxX, y: boxY,
      width: boxWidth, height: 60,
      color: step.color,
      borderColor: step.color,
      borderWidth: 2
    })

    // Label
    const labelWidth = helveticaBold.widthOfTextAtSize(step.label, 11)
    page.drawText(step.label, {
      x: boxX + (boxWidth - labelWidth) / 2,
      y: boxY + 35,
      size: 11, font: helveticaBold, color: WHITE
    })

    // Description
    const descWidth = helvetica.widthOfTextAtSize(step.desc, 9)
    page.drawText(step.desc, {
      x: boxX + (boxWidth - descWidth) / 2,
      y: boxY + 18,
      size: 9, font: helvetica, color: WHITE
    })

    // Arrow (except last)
    if (i < flowSteps.length - 1) {
      const arrowX = boxX + boxWidth + spacing / 2 - 10
      page.drawText('-->', {
        x: arrowX, y: boxY + 25,
        size: 14, font: helveticaBold, color: MEDIUM_GRAY
      })
    }

    boxX += boxWidth + spacing
  }

  y = y - 220

  // Key benefits
  page.drawText('KEY FEATURES:', {
    x: MARGIN, y: y,
    size: 12, font: helveticaBold, color: DARK_GRAY
  })

  const features = [
    'Automated RFQ number generation (RFQ-YEAR-0001)',
    'Secure supplier portal with token-based access',
    'AI-powered quote document analysis',
    'Side-by-side quote comparison',
    'Automatic markup calculation for client pricing',
    'Client portal for quote approval & payment',
    'Complete order tracking through delivery'
  ]

  y -= 25
  for (const feature of features) {
    page.drawCircle({ x: MARGIN + 8, y: y + 4, size: 3, color: BRAND_GREEN })
    page.drawText(feature, { x: MARGIN + 20, y: y, size: 10, font: helvetica, color: DARK_GRAY })
    y -= 18
  }

  drawPageFooter(page, helvetica, 2)

  // ============ PAGE 3: RFQ CREATION ============
  page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  y = drawPageHeader(page, 'Step 1: RFQ Creation & Sending', helveticaBold, 2)

  y = drawSubheading(page, helveticaBold, y, 'Creating an RFQ')

  const rfqSteps = [
    { num: '1', text: 'Go to Procurement Dashboard and click "New RFQ"' },
    { num: '2', text: 'Select the Project this RFQ is for' },
    { num: '3', text: 'Add a title and description for the request' },
    { num: '4', text: 'Set the response deadline (when suppliers must respond by)' },
    { num: '5', text: 'Add line items from your spec/FFE library' },
    { num: '6', text: 'Select which suppliers to send the RFQ to' }
  ]

  for (const step of rfqSteps) {
    y = drawNumberedStep(page, helvetica, helveticaBold, y, step.num, step.text)
  }

  y -= 20
  y = drawSubheading(page, helveticaBold, y, 'Sending the RFQ')

  y = drawParagraph(page, helvetica, helveticaBold, y,
    'When you click "Send to Suppliers", the system will:'
  )

  const sendActions = [
    'Generate a unique access token for each supplier',
    'Send a professional email with RFQ details',
    'Include a link to the Supplier Portal',
    'Track email delivery status',
    'Update RFQ status to SENT'
  ]

  y -= 10
  for (const action of sendActions) {
    page.drawCircle({ x: MARGIN + 8, y: y + 4, size: 3, color: BRAND_GREEN })
    page.drawText(action, { x: MARGIN + 20, y: y, size: 10, font: helvetica, color: DARK_GRAY })
    y -= 18
  }

  y -= 20

  // Info box
  page.drawRectangle({
    x: MARGIN, y: y - 60,
    width: PAGE_WIDTH - MARGIN * 2, height: 60,
    color: rgb(0.9, 0.95, 1),
    borderColor: BLUE,
    borderWidth: 1
  })

  page.drawText('TIP: Uploading Documents', {
    x: MARGIN + 15, y: y - 20,
    size: 11, font: helveticaBold, color: BLUE
  })

  page.drawText('You can attach spec sheets and PDF documents to the RFQ. These will be', {
    x: MARGIN + 15, y: y - 38,
    size: 10, font: helvetica, color: DARK_GRAY
  })
  page.drawText('visible to suppliers in their portal under "Reference Documents".', {
    x: MARGIN + 15, y: y - 52,
    size: 10, font: helvetica, color: DARK_GRAY
  })

  drawPageFooter(page, helvetica, 3)

  // ============ PAGE 4: SUPPLIER PORTAL ============
  page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  y = drawPageHeader(page, 'Step 2: Supplier Portal & Quote Submission', helveticaBold, 3)

  y = drawSubheading(page, helveticaBold, y, 'What Suppliers See')

  y = drawParagraph(page, helvetica, helveticaBold, y,
    'Suppliers receive an email with a secure link to their portal. No login is required - ' +
    'the link contains a unique token that grants access to only their RFQ.'
  )

  y -= 15
  page.drawText('The Supplier Portal shows:', {
    x: MARGIN, y: y,
    size: 11, font: helveticaBold, color: DARK_GRAY
  })

  const portalFeatures = [
    'RFQ details (title, description, deadline)',
    'Ship To address (project location)',
    'Bill To address (your company)',
    'All requested items with images and specifications',
    'Reference documents you uploaded',
    'Response deadline countdown'
  ]

  y -= 20
  for (const feature of portalFeatures) {
    page.drawCircle({ x: MARGIN + 8, y: y + 4, size: 3, color: ORANGE })
    page.drawText(feature, { x: MARGIN + 20, y: y, size: 10, font: helvetica, color: DARK_GRAY })
    y -= 18
  }

  y -= 20
  y = drawSubheading(page, helveticaBold, y, 'How Suppliers Submit Quotes')

  y = drawParagraph(page, helvetica, helveticaBold, y,
    'Suppliers have two options to submit their quote:'
  )

  y -= 15

  // Option 1 box
  page.drawRectangle({
    x: MARGIN, y: y - 80,
    width: (PAGE_WIDTH - MARGIN * 2) / 2 - 10, height: 80,
    color: LIGHT_GRAY
  })

  page.drawText('Option 1: Upload Quote', {
    x: MARGIN + 15, y: y - 20,
    size: 11, font: helveticaBold, color: DARK_GRAY
  })

  page.drawText('Upload a PDF or image of their', {
    x: MARGIN + 15, y: y - 40,
    size: 9, font: helvetica, color: DARK_GRAY
  })
  page.drawText('quote. AI automatically extracts', {
    x: MARGIN + 15, y: y - 52,
    size: 9, font: helvetica, color: DARK_GRAY
  })
  page.drawText('and matches prices to items.', {
    x: MARGIN + 15, y: y - 64,
    size: 9, font: helvetica, color: DARK_GRAY
  })

  // Option 2 box
  page.drawRectangle({
    x: PAGE_WIDTH / 2 + 5, y: y - 80,
    width: (PAGE_WIDTH - MARGIN * 2) / 2 - 10, height: 80,
    color: LIGHT_GRAY
  })

  page.drawText('Option 2: Enter Manually', {
    x: PAGE_WIDTH / 2 + 20, y: y - 20,
    size: 11, font: helveticaBold, color: DARK_GRAY
  })

  page.drawText('Enter prices, lead times, and', {
    x: PAGE_WIDTH / 2 + 20, y: y - 40,
    size: 9, font: helvetica, color: DARK_GRAY
  })
  page.drawText('availability for each item', {
    x: PAGE_WIDTH / 2 + 20, y: y - 52,
    size: 9, font: helvetica, color: DARK_GRAY
  })
  page.drawText('directly in the portal.', {
    x: PAGE_WIDTH / 2 + 20, y: y - 64,
    size: 9, font: helvetica, color: DARK_GRAY
  })

  y -= 110

  page.drawText('When a supplier submits, you receive an email notification with:', {
    x: MARGIN, y: y,
    size: 10, font: helvetica, color: DARK_GRAY
  })

  y -= 18
  const notifications = [
    'Supplier name and total quote amount',
    'AI match analysis (if they uploaded a document)',
    'Link to review the quote in your dashboard'
  ]

  for (const notif of notifications) {
    page.drawCircle({ x: MARGIN + 8, y: y + 4, size: 3, color: BRAND_GREEN })
    page.drawText(notif, { x: MARGIN + 20, y: y, size: 10, font: helvetica, color: DARK_GRAY })
    y -= 18
  }

  drawPageFooter(page, helvetica, 4)

  // ============ PAGE 5: QUOTE COMPARISON ============
  page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  y = drawPageHeader(page, 'Step 3: Quote Comparison & Acceptance', helveticaBold, 4)

  y = drawSubheading(page, helveticaBold, y, 'Comparing Quotes')

  y = drawParagraph(page, helvetica, helveticaBold, y,
    'Once suppliers submit their quotes, you can compare them side-by-side in the Quote Comparison view. ' +
    'The system highlights the best price for each item.'
  )

  y -= 20

  // Mock comparison table
  page.drawRectangle({
    x: MARGIN, y: y - 100,
    width: PAGE_WIDTH - MARGIN * 2, height: 100,
    color: LIGHT_GRAY,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1
  })

  // Table header
  page.drawRectangle({
    x: MARGIN, y: y - 25,
    width: PAGE_WIDTH - MARGIN * 2, height: 25,
    color: DARK_BLUE
  })

  page.drawText('Item', { x: MARGIN + 10, y: y - 18, size: 9, font: helveticaBold, color: WHITE })
  page.drawText('Supplier A', { x: MARGIN + 180, y: y - 18, size: 9, font: helveticaBold, color: WHITE })
  page.drawText('Supplier B', { x: MARGIN + 280, y: y - 18, size: 9, font: helveticaBold, color: WHITE })
  page.drawText('Supplier C', { x: MARGIN + 380, y: y - 18, size: 9, font: helveticaBold, color: WHITE })

  // Table rows
  page.drawText('Dining Chair (x6)', { x: MARGIN + 10, y: y - 45, size: 9, font: helvetica, color: DARK_GRAY })
  page.drawText('$1,200', { x: MARGIN + 180, y: y - 45, size: 9, font: helveticaBold, color: BRAND_GREEN })
  page.drawText('$1,450', { x: MARGIN + 280, y: y - 45, size: 9, font: helvetica, color: DARK_GRAY })
  page.drawText('$1,380', { x: MARGIN + 380, y: y - 45, size: 9, font: helvetica, color: DARK_GRAY })

  page.drawText('Coffee Table', { x: MARGIN + 10, y: y - 65, size: 9, font: helvetica, color: DARK_GRAY })
  page.drawText('$850', { x: MARGIN + 180, y: y - 65, size: 9, font: helvetica, color: DARK_GRAY })
  page.drawText('$780', { x: MARGIN + 280, y: y - 65, size: 9, font: helveticaBold, color: BRAND_GREEN })
  page.drawText('$920', { x: MARGIN + 380, y: y - 65, size: 9, font: helvetica, color: DARK_GRAY })

  page.drawText('Sofa', { x: MARGIN + 10, y: y - 85, size: 9, font: helvetica, color: DARK_GRAY })
  page.drawText('$3,200', { x: MARGIN + 180, y: y - 85, size: 9, font: helvetica, color: DARK_GRAY })
  page.drawText('$3,500', { x: MARGIN + 280, y: y - 85, size: 9, font: helvetica, color: DARK_GRAY })
  page.drawText('$2,950', { x: MARGIN + 380, y: y - 85, size: 9, font: helveticaBold, color: BRAND_GREEN })

  y -= 130

  y = drawSubheading(page, helveticaBold, y, 'Accepting a Quote')

  y = drawParagraph(page, helvetica, helveticaBold, y,
    'When you find the best quote, click "Accept Quote". A dialog will appear where you set the markup percentage:'
  )

  y -= 15

  // Markup example box
  page.drawRectangle({
    x: MARGIN, y: y - 100,
    width: PAGE_WIDTH - MARGIN * 2, height: 100,
    color: rgb(0.95, 1, 0.95),
    borderColor: BRAND_GREEN,
    borderWidth: 1
  })

  page.drawText('MARKUP CALCULATION EXAMPLE', {
    x: MARGIN + 15, y: y - 20,
    size: 11, font: helveticaBold, color: BRAND_GREEN
  })

  page.drawText('Supplier Cost:    $1,000', { x: MARGIN + 15, y: y - 45, size: 10, font: helvetica, color: DARK_GRAY })
  page.drawText('Markup:           25%', { x: MARGIN + 15, y: y - 60, size: 10, font: helvetica, color: DARK_GRAY })
  page.drawText('Client Price:     $1,250', { x: MARGIN + 15, y: y - 75, size: 10, font: helveticaBold, color: DARK_GRAY })
  page.drawText('Your Profit:      $250', { x: MARGIN + 15, y: y - 90, size: 10, font: helveticaBold, color: BRAND_GREEN })

  page.drawText('Formula: Client Price = Cost x (1 + Markup%/100)', {
    x: MARGIN + 280, y: y - 60,
    size: 9, font: helvetica, color: MEDIUM_GRAY
  })

  drawPageFooter(page, helvetica, 5)

  // ============ PAGE 6: CLIENT QUOTE ============
  page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  y = drawPageHeader(page, 'Step 4: Client Quote Creation', helveticaBold, 5)

  y = drawSubheading(page, helveticaBold, y, 'Creating the Client Invoice')

  y = drawParagraph(page, helvetica, helveticaBold, y,
    'After accepting supplier quotes, create a Client Quote (invoice) to send to your client. ' +
    'The system automatically applies your markups to calculate client pricing.'
  )

  y -= 20

  const clientQuoteSteps = [
    { num: '1', text: 'Click "Create Client Quote" from the RFQ page' },
    { num: '2', text: 'System pulls in accepted supplier quotes with markups applied' },
    { num: '3', text: 'Review line items and adjust if needed' },
    { num: '4', text: 'Set validity period and payment terms' },
    { num: '5', text: 'Add any additional notes or terms' },
    { num: '6', text: 'Preview and send to client' }
  ]

  for (const step of clientQuoteSteps) {
    y = drawNumberedStep(page, helvetica, helveticaBold, y, step.num, step.text)
  }

  y -= 20
  y = drawSubheading(page, helveticaBold, y, 'What the Client Sees')

  y = drawParagraph(page, helvetica, helveticaBold, y,
    'The client receives an email with a link to their quote portal. They see:'
  )

  const clientSees = [
    'Professional itemized invoice with your branding',
    'Each item with name, description, and CLIENT price (not your cost)',
    'Subtotal, taxes (GST/QST), and total amount',
    'Payment options (credit card, wire transfer, e-transfer, check)',
    'Quote validity date',
    'Option to approve, request changes, or decline'
  ]

  y -= 10
  for (const item of clientSees) {
    page.drawCircle({ x: MARGIN + 8, y: y + 4, size: 3, color: BRAND_GREEN })
    page.drawText(item, { x: MARGIN + 20, y: y, size: 10, font: helvetica, color: DARK_GRAY })
    y -= 18
  }

  y -= 20

  // Important note
  page.drawRectangle({
    x: MARGIN, y: y - 50,
    width: PAGE_WIDTH - MARGIN * 2, height: 50,
    color: rgb(1, 0.95, 0.9),
    borderColor: ORANGE,
    borderWidth: 1
  })

  page.drawText('IMPORTANT: Client Never Sees Your Cost', {
    x: MARGIN + 15, y: y - 20,
    size: 11, font: helveticaBold, color: ORANGE
  })

  page.drawText('The client portal only shows the marked-up prices. Your supplier costs and profit margins', {
    x: MARGIN + 15, y: y - 38,
    size: 9, font: helvetica, color: DARK_GRAY
  })

  drawPageFooter(page, helvetica, 6)

  // ============ PAGE 7: PAYMENT & ORDERS ============
  page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  y = drawPageHeader(page, 'Step 5: Payment & Order Creation', helveticaBold, 6)

  y = drawSubheading(page, helveticaBold, y, 'Client Approval & Payment')

  y = drawParagraph(page, helvetica, helveticaBold, y,
    'When a client approves and pays, the system tracks everything:'
  )

  y -= 15

  const paymentFlow = [
    { num: '1', text: 'Client clicks "Approve" in their portal' },
    { num: '2', text: 'Status changes to APPROVED' },
    { num: '3', text: 'Client selects payment method and pays' },
    { num: '4', text: 'Payment recorded (amount, method, reference)' },
    { num: '5', text: 'You verify and reconcile payment' },
    { num: '6', text: 'Status changes to PAID' }
  ]

  for (const step of paymentFlow) {
    y = drawNumberedStep(page, helvetica, helveticaBold, y, step.num, step.text)
  }

  y -= 20
  y = drawSubheading(page, helveticaBold, y, 'Creating Purchase Orders')

  y = drawParagraph(page, helvetica, helveticaBold, y,
    'Once payment is received, create Purchase Orders to place with suppliers:'
  )

  y -= 15

  const poSteps = [
    'System validates payment received >= required amount',
    'PO created with unique number (PO-YEAR-0001)',
    'Items pulled from client quote at SUPPLIER COST (not markup price)',
    'Shipping address from project or custom',
    'Send PO to supplier'
  ]

  for (const item of poSteps) {
    page.drawCircle({ x: MARGIN + 8, y: y + 4, size: 3, color: BLUE })
    page.drawText(item, { x: MARGIN + 20, y: y, size: 10, font: helvetica, color: DARK_GRAY })
    y -= 18
  }

  y -= 20
  y = drawSubheading(page, helveticaBold, y, 'Order Tracking')

  y = drawParagraph(page, helvetica, helveticaBold, y,
    'Track orders through their full lifecycle:'
  )

  y -= 10

  // Order status flow
  const orderStatuses = [
    'PENDING_PAYMENT --> PAYMENT_RECEIVED --> ORDERED',
    'ORDERED --> CONFIRMED --> IN_PRODUCTION',
    'IN_PRODUCTION --> SHIPPED --> IN_TRANSIT',
    'IN_TRANSIT --> DELIVERED --> INSTALLED --> COMPLETED'
  ]

  for (const status of orderStatuses) {
    page.drawText(status, {
      x: MARGIN + 20, y: y,
      size: 9, font: helvetica, color: DARK_GRAY
    })
    y -= 16
  }

  drawPageFooter(page, helvetica, 7)

  // ============ PAGE 8: STATUS REFERENCE ============
  page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  y = drawPageHeader(page, 'Status Reference Guide', helveticaBold, 7)

  y = drawSubheading(page, helveticaBold, y, 'RFQ Statuses')
  y = drawStatusTable(page, helvetica, helveticaBold, y, [
    { status: 'DRAFT', desc: 'Being created, not yet sent' },
    { status: 'SENT', desc: 'Sent to suppliers, awaiting responses' },
    { status: 'PARTIALLY_QUOTED', desc: 'Some suppliers have responded' },
    { status: 'FULLY_QUOTED', desc: 'All suppliers have responded' },
    { status: 'QUOTE_ACCEPTED', desc: 'At least one quote accepted' },
    { status: 'EXPIRED', desc: 'Response deadline passed' },
    { status: 'CANCELLED', desc: 'RFQ was cancelled' }
  ])

  y -= 20
  y = drawSubheading(page, helveticaBold, y, 'Supplier Response Statuses')
  y = drawStatusTable(page, helvetica, helveticaBold, y, [
    { status: 'PENDING', desc: 'RFQ sent, supplier hasn\'t opened yet' },
    { status: 'VIEWED', desc: 'Supplier opened the portal link' },
    { status: 'SUBMITTED', desc: 'Supplier submitted their quote' },
    { status: 'DECLINED', desc: 'Supplier declined to quote' }
  ])

  y -= 20
  y = drawSubheading(page, helveticaBold, y, 'Client Quote Statuses')
  y = drawStatusTable(page, helvetica, helveticaBold, y, [
    { status: 'DRAFT', desc: 'Being prepared internally' },
    { status: 'SENT_TO_CLIENT', desc: 'Email sent to client' },
    { status: 'CLIENT_REVIEWING', desc: 'Client has viewed the quote' },
    { status: 'APPROVED', desc: 'Client approved the quote' },
    { status: 'REVISION_REQUESTED', desc: 'Client requested changes' },
    { status: 'REJECTED', desc: 'Client rejected the quote' },
    { status: 'PAID', desc: 'Payment received' }
  ])

  drawPageFooter(page, helvetica, 8)

  // ============ PAGE 9: ORDER STATUSES ============
  page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  y = drawPageHeader(page, 'Status Reference Guide (continued)', helveticaBold, 8)

  y = drawSubheading(page, helveticaBold, y, 'Order Statuses')
  y = drawStatusTable(page, helvetica, helveticaBold, y, [
    { status: 'PENDING_PAYMENT', desc: 'Order created, awaiting payment' },
    { status: 'PAYMENT_RECEIVED', desc: 'Payment confirmed' },
    { status: 'ORDERED', desc: 'Order placed with supplier' },
    { status: 'CONFIRMED', desc: 'Supplier confirmed order' },
    { status: 'IN_PRODUCTION', desc: 'Items being manufactured' },
    { status: 'SHIPPED', desc: 'Items left supplier' },
    { status: 'IN_TRANSIT', desc: 'Items in transit' },
    { status: 'DELIVERED', desc: 'Items received' },
    { status: 'INSTALLED', desc: 'Items installed at project' },
    { status: 'COMPLETED', desc: 'Order fulfilled and closed' }
  ])

  y -= 30

  // Final notes box
  page.drawRectangle({
    x: MARGIN, y: y - 100,
    width: PAGE_WIDTH - MARGIN * 2, height: 100,
    color: rgb(0.95, 0.97, 1),
    borderColor: DARK_BLUE,
    borderWidth: 1
  })

  page.drawText('QUICK TIPS', {
    x: MARGIN + 15, y: y - 20,
    size: 12, font: helveticaBold, color: DARK_BLUE
  })

  const tips = [
    'Always set realistic response deadlines (7-14 days typical)',
    'Upload spec sheets to help suppliers quote accurately',
    'Compare at least 2-3 suppliers for best pricing',
    'Track activities in the log for audit trail',
    'Use notes fields to document decisions'
  ]

  let tipY = y - 40
  for (const tip of tips) {
    page.drawText('- ' + tip, {
      x: MARGIN + 15, y: tipY,
      size: 9, font: helvetica, color: DARK_GRAY
    })
    tipY -= 14
  }

  drawPageFooter(page, helvetica, 9)

  // Save the PDF
  const pdfBytes = await pdfDoc.save()

  // Write to file
  const outputPath = path.join(process.cwd(), 'Procurement_Workflow_Guide.pdf')
  fs.writeFileSync(outputPath, pdfBytes)

  console.log(`PDF saved to: ${outputPath}`)
  return outputPath
}

// Helper functions
function drawPageHeader(page: PDFPage, title: string, boldFont: PDFFont, sectionNum: number): number {
  // Header bar
  page.drawRectangle({
    x: 0, y: PAGE_HEIGHT - 60,
    width: PAGE_WIDTH, height: 60,
    color: DARK_BLUE
  })

  // Section number
  page.drawText(`SECTION ${sectionNum}`, {
    x: MARGIN, y: PAGE_HEIGHT - 25,
    size: 9, font: boldFont, color: BRAND_GREEN
  })

  // Title
  page.drawText(title, {
    x: MARGIN, y: PAGE_HEIGHT - 45,
    size: 18, font: boldFont, color: WHITE
  })

  return PAGE_HEIGHT - 90
}

function drawPageFooter(page: PDFPage, font: PDFFont, pageNum: number) {
  page.drawText('Meisner Interiors - Procurement Workflow Guide', {
    x: MARGIN, y: 30,
    size: 8, font: font, color: MEDIUM_GRAY
  })

  page.drawText(`Page ${pageNum}`, {
    x: PAGE_WIDTH - MARGIN - 30, y: 30,
    size: 8, font: font, color: MEDIUM_GRAY
  })
}

function drawSubheading(page: PDFPage, boldFont: PDFFont, y: number, text: string): number {
  page.drawRectangle({
    x: MARGIN, y: y - 2,
    width: 4, height: 16,
    color: BRAND_GREEN
  })

  page.drawText(text, {
    x: MARGIN + 12, y: y,
    size: 13, font: boldFont, color: DARK_GRAY
  })

  return y - 25
}

function drawParagraph(page: PDFPage, font: PDFFont, boldFont: PDFFont, y: number, text: string): number {
  const words = text.split(' ')
  const maxWidth = PAGE_WIDTH - MARGIN * 2
  let line = ''
  let currentY = y

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    const testWidth = font.widthOfTextAtSize(testLine, 10)

    if (testWidth > maxWidth) {
      page.drawText(line, { x: MARGIN, y: currentY, size: 10, font: font, color: DARK_GRAY })
      currentY -= 16
      line = word
    } else {
      line = testLine
    }
  }

  if (line) {
    page.drawText(line, { x: MARGIN, y: currentY, size: 10, font: font, color: DARK_GRAY })
    currentY -= 16
  }

  return currentY
}

function drawNumberedStep(page: PDFPage, font: PDFFont, boldFont: PDFFont, y: number, num: string, text: string): number {
  // Circle with number
  page.drawCircle({
    x: MARGIN + 10, y: y + 3,
    size: 10, color: BRAND_GREEN
  })

  page.drawText(num, {
    x: MARGIN + 7, y: y,
    size: 10, font: boldFont, color: WHITE
  })

  page.drawText(text, {
    x: MARGIN + 30, y: y,
    size: 10, font: font, color: DARK_GRAY
  })

  return y - 22
}

function drawStatusTable(page: PDFPage, font: PDFFont, boldFont: PDFFont, y: number, statuses: { status: string, desc: string }[]): number {
  for (const item of statuses) {
    // Status badge background
    const statusWidth = boldFont.widthOfTextAtSize(item.status, 8) + 10
    page.drawRectangle({
      x: MARGIN, y: y - 3,
      width: statusWidth, height: 14,
      color: LIGHT_GRAY
    })

    page.drawText(item.status, {
      x: MARGIN + 5, y: y,
      size: 8, font: boldFont, color: DARK_GRAY
    })

    page.drawText(item.desc, {
      x: MARGIN + 130, y: y,
      size: 9, font: font, color: DARK_GRAY
    })

    y -= 18
  }

  return y
}

// Run the generator
generateWorkflowPDF()
  .then(path => console.log('Done!'))
  .catch(err => console.error('Error:', err))

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image, Font } from '@react-pdf/renderer'
import * as path from 'path'
import * as fs from 'fs'

// Register a cursive/script font for signatures
Font.register({
  family: 'GreatVibes',
  src: 'https://fonts.gstatic.com/s/greatvibes/v18/RWmMoKWR9v4ksMfaWd_JN-XC.ttf',
})

// Register fonts with fallbacks
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
    { src: 'Helvetica-Oblique', fontStyle: 'italic' },
  ],
})

// Get logo as base64 data URI for embedding in PDF
function getLogoDataUri(): string | null {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'meisnerinteriorlogo.png')
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath)
      return `data:image/png;base64,${logoBuffer.toString('base64')}`
    }
  } catch (error) {
    console.error('Error loading logo:', error)
  }
  return null
}

interface AuthSession {
  user: {
    id: string
    orgId: string
    role: string
  }
}

// Helper to check billing access
async function canAccessBilling(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, canSeeBilling: true },
  })
  return user?.role === 'OWNER' || user?.canSeeBilling === true
}

// Define colors matching the sample PDF
const colors = {
  primary: '#E5A54B', // Orange/amber accent
  headerBg: '#2D3748', // Dark gray for logo background
  text: '#1A202C', // Dark text
  textLight: '#4A5568', // Lighter text
  textMuted: '#718096', // Muted text
  white: '#FFFFFF',
  line: '#E2E8F0', // Light gray line
}

// PDF Styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: colors.white,
    paddingHorizontal: 50,
    paddingVertical: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  logoBox: {
    width: 200,
    height: 120,
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: 0,
  },
  logoText: {
    color: colors.white,
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  logoSubtext: {
    color: colors.white,
    fontSize: 8,
    letterSpacing: 4,
    marginTop: 5,
  },
  contactInfo: {
    textAlign: 'right',
    fontSize: 9,
    color: colors.textLight,
  },
  contactLine: {
    marginBottom: 3,
  },
  addressContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  orangeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 8,
    marginTop: 2,
  },
  orangeLine: {
    width: 100,
    height: 2,
    backgroundColor: colors.primary,
    marginLeft: 8,
    marginTop: 6,
  },

  // Cover page styles
  coverContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  proposalTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 80,
  },
  clientInfo: {
    textAlign: 'center',
    color: colors.textLight,
    lineHeight: 1.5,
  },
  clientLabel: {
    fontSize: 11,
    color: colors.textLight,
  },
  clientName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 2,
  },

  // Letter page styles
  letterClientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 5,
  },
  letterAddress: {
    fontSize: 10,
    color: colors.textLight,
    marginBottom: 25,
    lineHeight: 1.4,
  },
  paragraph: {
    fontSize: 10,
    color: colors.text,
    marginBottom: 15,
    lineHeight: 1.6,
    textAlign: 'justify',
  },
  signatureSection: {
    marginTop: 40,
  },
  ceoName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 3,
  },
  ceoTitle: {
    fontSize: 10,
    color: colors.textLight,
    marginBottom: 10,
  },
  signatureImage: {
    width: 100,
    height: 40,
    marginTop: 5,
  },
  signatureText: {
    fontSize: 24,
    fontFamily: 'GreatVibes',
    color: colors.text,
    marginTop: 10,
  },

  // Scope of work page styles
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  projectOverview: {
    fontSize: 10,
    color: colors.text,
    marginBottom: 20,
    lineHeight: 1.5,
    paddingLeft: 15,
  },
  scopeItem: {
    marginBottom: 15,
  },
  scopeItemTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: colors.text,
    marginBottom: 5,
  },
  scopeItemDescription: {
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.5,
    paddingLeft: 20,
  },

  // Payment schedule styles
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderBottomStyle: 'dotted',
    paddingBottom: 5,
  },
  paymentLabel: {
    fontSize: 10,
    color: colors.text,
    flex: 1,
  },
  paymentAmount: {
    fontSize: 10,
    color: colors.text,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.text,
  },
  totalAmount: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.text,
  },
  paymentNote: {
    fontSize: 9,
    color: colors.textLight,
    marginTop: 10,
  },

  // Terms page styles
  additionalServices: {
    fontSize: 10,
    color: colors.text,
    marginBottom: 20,
    paddingLeft: 10,
  },
  termItem: {
    fontSize: 9,
    color: colors.text,
    marginBottom: 8,
    lineHeight: 1.5,
    paddingLeft: 5,
  },
  closingText: {
    fontSize: 10,
    fontStyle: 'italic',
    color: colors.text,
    marginTop: 20,
    marginBottom: 25,
    lineHeight: 1.5,
  },

  // Signature box styles
  signatureBoxContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  signatureBox: {
    width: '30%',
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    paddingBottom: 20,
    marginBottom: 5,
    minHeight: 30,
  },
  signaturePrefix: {
    fontSize: 10,
    color: colors.textLight,
  },
  signatureBoxLabel: {
    fontSize: 9,
    color: colors.textLight,
    marginTop: 3,
  },
})

// Format currency helper
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Header component used on all pages
function Header({ org, logoDataUri }: { org: any; logoDataUri: string | null }) {
  return React.createElement(View, { style: styles.header },
    // Logo box - use actual image if available
    logoDataUri
      ? React.createElement(View, { style: styles.logoBox },
          React.createElement(Image, {
            src: logoDataUri,
            style: { width: 160, height: 90, objectFit: 'contain' }
          })
        )
      : React.createElement(View, { style: styles.logoBox },
          React.createElement(Text, { style: styles.logoText }, 'MEISNER'),
          React.createElement(Text, { style: styles.logoSubtext }, 'INTERIORS')
        ),
    // Contact info
    React.createElement(View, { style: styles.contactInfo },
      React.createElement(Text, { style: styles.contactLine }, org?.businessPhone || '514-227-5505'),
      React.createElement(View, { style: { borderBottomWidth: 1, borderBottomColor: colors.textLight, marginVertical: 5 } }),
      React.createElement(Text, { style: styles.contactLine }, org?.businessEmail || 'projects@meisnerinteriors.com'),
      React.createElement(View, { style: { borderBottomWidth: 1, borderBottomColor: colors.textLight, marginVertical: 5 } }),
      React.createElement(View, { style: styles.addressContainer },
        React.createElement(View, { style: styles.orangeDot }),
        React.createElement(View, { style: { flexDirection: 'column' } },
          React.createElement(View, { style: styles.orangeLine }),
          React.createElement(Text, { style: { ...styles.contactLine, marginTop: 5 } }, org?.businessAddress || '6700 Ave Du Parc Ave Unit 109'),
          React.createElement(Text, null,
            `${org?.businessCity || 'Montreal'} ${org?.businessProvince || 'QC'}, ${org?.businessPostal || 'H2V4H9'}`
          )
        )
      )
    )
  )
}

// Cover Page
function CoverPage({ proposal, org, logoDataUri }: { proposal: any; org: any; logoDataUri: string | null }) {
  return React.createElement(Page, { size: 'LETTER', style: styles.page },
    React.createElement(Header, { org, logoDataUri }),
    React.createElement(View, { style: styles.coverContent },
      React.createElement(Text, { style: styles.proposalTitle }, 'Proposal'),
      React.createElement(View, { style: styles.clientInfo },
        React.createElement(Text, { style: styles.clientLabel }, 'Client Name: '),
        React.createElement(Text, { style: styles.clientName }, proposal.clientName),
        React.createElement(Text, { style: { ...styles.clientLabel, marginTop: 15 } }, 'Project Address:'),
        React.createElement(Text, { style: styles.clientName }, proposal.projectAddress || proposal.clientAddress || '-')
      )
    )
  )
}

// Letter Page
function LetterPage({ proposal, org, logoDataUri }: { proposal: any; org: any; logoDataUri: string | null }) {
  const coverLetter = proposal.coverLetter || ''
  const paragraphs = coverLetter.split('\n').filter((p: string) => p.trim())

  return React.createElement(Page, { size: 'LETTER', style: styles.page },
    React.createElement(Header, { org, logoDataUri }),
    React.createElement(View, { style: { flex: 1 } },
      React.createElement(Text, { style: styles.letterClientName }, `Mr. ${proposal.clientName}`),
      React.createElement(Text, { style: styles.letterAddress },
        proposal.projectAddress || proposal.clientAddress || ''
      ),
      ...paragraphs.map((p: string, i: number) =>
        React.createElement(Text, { key: i, style: styles.paragraph }, p)
      ),
      React.createElement(View, { style: styles.signatureSection, wrap: false },
        React.createElement(Text, { style: styles.signatureText }, proposal.companySignedByName || 'Aaron Meisner'),
        React.createElement(Text, { style: styles.ceoName }, proposal.companySignedByName || 'Aaron Meisner'),
        React.createElement(Text, { style: styles.ceoTitle }, `CEO ${org?.businessName || org?.name || 'Meisner Interiors'}`)
      )
    )
  )
}

// Scope of Work Page
function ScopePage({ proposal, org, logoDataUri }: { proposal: any; org: any; logoDataUri: string | null }) {
  const content = proposal.content || {}
  const projectOverview = content.projectOverview || ''
  const scopeItems = content.scopeItems || []
  const paymentSchedule = proposal.paymentSchedule || []
  const hourlyRate = proposal.hourlyRate ? Number(proposal.hourlyRate) : null

  return React.createElement(Page, { size: 'LETTER', style: styles.page },
    React.createElement(Header, { org, logoDataUri }),
    React.createElement(View, { style: { flex: 1 } },
      // Project Overview
      React.createElement(Text, { style: { ...styles.sectionTitle, fontStyle: 'normal', fontWeight: 'bold' } }, 'Project Overview'),
      React.createElement(Text, { style: styles.projectOverview }, projectOverview),

      // Scope of Work
      React.createElement(Text, { style: styles.sectionTitle }, 'Scope of Work:'),
      ...scopeItems.map((item: any, i: number) =>
        React.createElement(View, { key: i, style: styles.scopeItem },
          React.createElement(Text, { style: styles.scopeItemTitle }, `${i + 1}. ${item.title}`),
          React.createElement(Text, { style: styles.scopeItemDescription }, item.description)
        )
      ),

      // Payment Schedule
      React.createElement(Text, { style: { ...styles.sectionTitle, marginTop: 20 } }, 'Payment Schedule:'),

      // Total Budget Row
      React.createElement(View, { style: styles.totalRow },
        React.createElement(Text, { style: styles.totalLabel }, 'Total Budget Fee'),
        React.createElement(Text, { style: styles.totalAmount }, formatCurrency(Number(proposal.subtotal)))
      ),

      // Payment milestones
      ...paymentSchedule.map((item: any, i: number) =>
        React.createElement(View, { key: i, style: styles.paymentRow },
          React.createElement(Text, { style: styles.paymentLabel }, item.title),
          React.createElement(Text, { style: styles.paymentAmount }, formatCurrency(item.amount))
        )
      ),

      // Hourly rate if applicable
      hourlyRate ? React.createElement(View, { style: { ...styles.paymentRow, marginTop: 10 } },
        React.createElement(Text, { style: styles.paymentLabel }, 'Additional work will be billed separately'),
        React.createElement(Text, { style: styles.paymentAmount }, `${formatCurrency(hourlyRate)}/hour`)
      ) : null,

      React.createElement(Text, { style: styles.paymentNote },
        'Payments are due within 7 days of the invoice date.'
      ),
      React.createElement(Text, { style: { ...styles.paymentNote, marginTop: 15 } },
        'Once approved, design development will begin immediately, and coordination with consultants will be scheduled accordingly.'
      )
    )
  )
}

// Terms Page
function TermsPage({ proposal, org, logoDataUri }: { proposal: any; org: any; logoDataUri: string | null }) {
  const content = proposal.content || {}
  const terms = content.terms || ''
  const termItems = terms.split('\n').filter((line: string) => line.trim().startsWith('-'))
  const ccFeePercent = proposal.ccFeePercent ? Number(proposal.ccFeePercent) : 3.5

  return React.createElement(Page, { size: 'LETTER', style: styles.page },
    React.createElement(Header, { org, logoDataUri }),
    React.createElement(View, { style: { flex: 1 } },
      // Additional Services
      React.createElement(Text, { style: styles.sectionTitle }, 'Additional Services:'),
      React.createElement(Text, { style: styles.additionalServices },
        `- When paid through a credit card, ${ccFeePercent}% of the transaction value will be charged towards credit card fees.`
      ),

      // Terms
      React.createElement(Text, { style: styles.sectionTitle }, 'Terms:'),
      ...termItems.map((term: string, i: number) =>
        React.createElement(Text, { key: i, style: styles.termItem }, term)
      ),

      // Closing text
      React.createElement(Text, { style: styles.closingText },
        `I look forward to hearing from you, and as always, please feel free to call with any questions or further clarification.${org?.businessPhone ? ` I can be contacted at ${org.businessPhone}` : ''}`
      ),

      // Sincerely
      React.createElement(Text, { style: { fontSize: 10, color: colors.textLight, marginBottom: 5 } }, 'Sincerely,'),
      React.createElement(Text, { style: styles.ceoName }, proposal.companySignedByName || 'Aaron Meisner'),
      React.createElement(Text, { style: styles.ceoTitle }, `CEO ${org?.businessName || org?.name || 'Meisner Interiors'}`),

      // Signature boxes - wrap={false} keeps them on the same page
      React.createElement(View, { style: styles.signatureBoxContainer, wrap: false },
        // CEO signature
        React.createElement(View, { style: styles.signatureBox },
          React.createElement(View, { style: styles.signatureLine },
            React.createElement(Text, { style: styles.signaturePrefix }, 'X:'),
            React.createElement(Text, { style: { fontSize: 20, fontFamily: 'GreatVibes', marginTop: 5 } }, proposal.companySignedByName || 'Aaron Meisner')
          ),
          React.createElement(Text, { style: styles.signatureBoxLabel }, proposal.companySignedByName || 'Aaron Meisner')
        ),
        // Date
        React.createElement(View, { style: styles.signatureBox },
          React.createElement(View, { style: styles.signatureLine },
            React.createElement(Text, { style: styles.signaturePrefix }, 'X:'),
            proposal.signedAt ?
              React.createElement(Text, { style: { fontSize: 10, marginTop: 5 } }, new Date(proposal.signedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })) :
              null
          ),
          React.createElement(Text, { style: styles.signatureBoxLabel }, 'Date Signed')
        ),
        // Client signature
        React.createElement(View, { style: styles.signatureBox },
          React.createElement(View, { style: styles.signatureLine },
            React.createElement(Text, { style: styles.signaturePrefix }, 'X:'),
            proposal.signedByName ?
              React.createElement(Text, { style: { fontSize: 20, fontFamily: 'GreatVibes', marginTop: 5 } }, proposal.signedByName) :
              null
          ),
          React.createElement(Text, { style: styles.signatureBoxLabel }, `Mr. ${proposal.clientName}`)
        )
      )
    )
  )
}

// Main PDF Document
function ProposalPDF({ proposal, org, logoDataUri }: { proposal: any; org: any; logoDataUri: string | null }) {
  return React.createElement(Document, null,
    React.createElement(CoverPage, { proposal, org, logoDataUri }),
    React.createElement(LetterPage, { proposal, org, logoDataUri }),
    React.createElement(ScopePage, { proposal, org, logoDataUri }),
    React.createElement(TermsPage, { proposal, org, logoDataUri })
  )
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await canAccessBilling(session.user.id))) {
      return NextResponse.json({ error: 'No billing access' }, { status: 403 })
    }

    // Get proposal with all details
    const proposal = await prisma.proposal.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
      include: {
        project: {
          select: { name: true },
        },
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Get organization info
    const org = await prisma.organization.findFirst({
      where: { id: session.user.orgId },
      select: {
        name: true,
        businessName: true,
        logoUrl: true,
        businessEmail: true,
        businessPhone: true,
        businessAddress: true,
        businessCity: true,
        businessProvince: true,
        businessPostal: true,
        gstNumber: true,
        qstNumber: true,
      },
    })

    // Load logo
    const logoDataUri = getLogoDataUri()

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      React.createElement(ProposalPDF, { proposal, org, logoDataUri })
    )

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${proposal.proposalNumber}-${proposal.clientName.replace(/\s+/g, '-')}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating proposal PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}

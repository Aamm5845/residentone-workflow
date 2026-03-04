import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image, Font } from '@react-pdf/renderer'
import * as path from 'path'
import * as fs from 'fs'

// ─── Font Registration ───────────────────────────────────────────────────────

// Montserrat via Google Fonts static weights
Font.register({
  family: 'Montserrat',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCs16Ew-Y3tcoqK5.ttf',
      fontWeight: 300, // Light
    },
    {
      src: 'https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-Y3tcoqK5.ttf',
      fontWeight: 400, // Regular
    },
    {
      src: 'https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtZ6Ew-Y3tcoqK5.ttf',
      fontWeight: 500, // Medium
    },
    {
      src: 'https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCu170w-Y3tcoqK5.ttf',
      fontWeight: 600, // SemiBold
    },
    {
      src: 'https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCvr70w-Y3tcoqK5.ttf',
      fontWeight: 700, // Bold
    },
  ],
})

// Montserrat Italic for "Warm regards" etc
Font.register({
  family: 'MontserratItalic',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/montserrat/v29/JTUFjIg1_i6t8kCHKm459Wx7xQYXK0vOoz6jq6R8aX9-p7K5ILg.ttf',
      fontWeight: 300, // Light Italic
    },
    {
      src: 'https://fonts.gstatic.com/s/montserrat/v29/JTUFjIg1_i6t8kCHKm459Wx7xQYXK0vOoz6jq_p8aX9-p7K5ILg.ttf',
      fontWeight: 400, // Regular Italic
    },
  ],
})

// Priestacy script font for company signatures
function getPriestacyFontDataUri(): string {
  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Priestacy.otf')
    if (fs.existsSync(fontPath)) {
      const fontBuffer = fs.readFileSync(fontPath)
      return `data:font/otf;base64,${fontBuffer.toString('base64')}`
    }
  } catch (error) {
    console.error('Error loading Priestacy font:', error)
  }
  return path.join(process.cwd(), 'public', 'fonts', 'Priestacy.otf')
}

Font.register({
  family: 'Priestacy',
  src: getPriestacyFontDataUri(),
})

// Great Vibes for client signatures
Font.register({
  family: 'GreatVibes',
  src: 'https://fonts.gstatic.com/s/greatvibes/v18/RWmMoKWR9v4ksMfaWd_JN-XC.ttf',
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDateLong(date: Date | string | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const colors = {
  amber: '#E5A54B',
  amberLight: '#F5D89A',
  charcoal: '#1A1A2E',
  text: '#333333',
  textLight: '#666666',
  textMuted: '#999999',
  white: '#FFFFFF',
  offWhite: '#FAFAF8',
  line: '#E8E4DE',
  lineDark: '#C5BFB5',
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Pages
  page: {
    flexDirection: 'column',
    backgroundColor: colors.white,
    paddingHorizontal: 56,
    paddingTop: 40,
    paddingBottom: 50,
    fontFamily: 'Montserrat',
    fontWeight: 400,
    fontSize: 10.5,
    color: colors.text,
  },
  coverPage: {
    flexDirection: 'column',
    backgroundColor: colors.white,
    fontFamily: 'Montserrat',
    fontSize: 10.5,
    color: colors.text,
  },

  // Cover page elements
  coverTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.amber,
  },
  coverBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.amber,
  },
  coverBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 56,
  },
  coverLogo: {
    width: 200,
    height: 80,
    objectFit: 'contain',
    marginBottom: 16,
  },
  coverCompanyName: {
    fontSize: 28,
    fontWeight: 700,
    color: colors.charcoal,
    letterSpacing: 4,
    marginBottom: 4,
  },
  coverCompanySubtext: {
    fontSize: 9,
    fontWeight: 300,
    color: colors.textLight,
    letterSpacing: 6,
    marginBottom: 56,
  },
  coverTitle: {
    fontSize: 44,
    fontWeight: 700,
    color: colors.charcoal,
    letterSpacing: 6,
    marginBottom: 24,
  },
  coverDivider: {
    width: 80,
    height: 2,
    backgroundColor: colors.amber,
    marginBottom: 28,
  },
  coverMeta: {
    alignItems: 'center',
  },
  coverMetaLabel: {
    fontSize: 9,
    fontWeight: 300,
    color: colors.textMuted,
    letterSpacing: 3,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  coverProposalNum: {
    fontSize: 10,
    fontWeight: 300,
    color: colors.textLight,
    marginBottom: 4,
  },
  coverDate: {
    fontSize: 10,
    fontWeight: 300,
    color: colors.textLight,
    marginBottom: 32,
  },
  coverClientName: {
    fontSize: 16,
    fontWeight: 600,
    color: colors.charcoal,
    marginBottom: 6,
  },
  coverAddress: {
    fontSize: 10,
    fontWeight: 300,
    color: colors.textLight,
    textAlign: 'center',
  },

  // Header (pages 2-4)
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.amber,
  },
  headerLogoBox: {
    width: 100,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerContact: {
    textAlign: 'right',
    fontSize: 8.5,
    fontWeight: 300,
    color: colors.textMuted,
    lineHeight: 1.6,
  },
  headerContactLine: {
    marginBottom: 1,
  },

  // Footer (pages 2-4)
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    right: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  footerLeft: {
    fontSize: 7,
    fontWeight: 300,
    color: colors.textMuted,
  },
  footerRight: {
    fontSize: 8,
    fontWeight: 300,
    color: colors.textMuted,
  },

  // Letter page
  letterDate: {
    textAlign: 'right',
    fontSize: 10,
    fontWeight: 300,
    color: colors.textMuted,
    marginBottom: 20,
  },
  letterClientName: {
    fontSize: 18,
    fontWeight: 600,
    color: colors.charcoal,
    marginBottom: 4,
  },
  letterAddress: {
    fontSize: 10.5,
    fontWeight: 300,
    color: colors.textLight,
    marginBottom: 28,
    lineHeight: 1.4,
  },
  paragraph: {
    fontSize: 10.5,
    fontWeight: 400,
    color: colors.text,
    marginBottom: 14,
    lineHeight: 1.7,
    textAlign: 'justify',
  },
  warmRegards: {
    fontSize: 10.5,
    fontFamily: 'MontserratItalic',
    fontWeight: 300,
    color: colors.textLight,
    marginTop: 36,
    marginBottom: 12,
  },
  signatureScript: {
    fontSize: 26,
    fontFamily: 'Priestacy',
    color: colors.charcoal,
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 11,
    fontWeight: 600,
    color: colors.charcoal,
    marginBottom: 2,
  },
  signatureTitle: {
    fontSize: 10,
    fontWeight: 300,
    color: colors.textLight,
  },

  // Section headings
  sectionHeading: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.charcoal,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  sectionUnderline: {
    width: 30,
    height: 1.5,
    backgroundColor: colors.amber,
    marginBottom: 8,
  },

  // Scope items
  scopeItem: {
    marginBottom: 16,
  },
  scopeItemHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  scopeItemNumber: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.amber,
    marginRight: 6,
  },
  scopeItemTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: colors.charcoal,
  },
  scopeItemDescription: {
    fontSize: 10,
    fontWeight: 400,
    color: colors.text,
    lineHeight: 1.6,
    paddingLeft: 20,
  },

  // Payment schedule
  paymentTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.offWhite,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.amber,
    marginBottom: 8,
  },
  paymentTotalLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: colors.charcoal,
  },
  paymentTotalAmount: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.amber,
  },
  paymentTotalTax: {
    fontSize: 7.5,
    fontWeight: 300,
    color: colors.textMuted,
    marginLeft: 4,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderBottomStyle: 'dotted',
  },
  paymentLabel: {
    fontSize: 10.5,
    fontWeight: 400,
    color: colors.text,
  },
  paymentAmount: {
    fontSize: 10.5,
    fontWeight: 500,
    color: colors.charcoal,
  },
  paymentNote: {
    fontSize: 9,
    fontWeight: 300,
    color: colors.textMuted,
    marginTop: 12,
    lineHeight: 1.5,
  },

  // Terms
  termRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingRight: 10,
  },
  termBullet: {
    width: 4,
    height: 4,
    backgroundColor: colors.amber,
    marginTop: 4,
    marginRight: 8,
    borderRadius: 1,
  },
  termText: {
    fontSize: 9.5,
    fontWeight: 400,
    color: colors.text,
    lineHeight: 1.4,
    flex: 1,
  },
  closingText: {
    fontSize: 9.5,
    fontFamily: 'MontserratItalic',
    fontWeight: 300,
    color: colors.textLight,
    marginTop: 8,
    marginBottom: 4,
    lineHeight: 1.35,
  },

  // Signature boxes
  signatureBoxContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  signatureBox: {
    width: '30%',
  },
  signatureBoxLabel: {
    fontSize: 8,
    fontWeight: 300,
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  signatureBoxLabelLine: {
    width: 20,
    height: 1,
    backgroundColor: colors.amber,
    marginBottom: 8,
  },
  signatureContent: {
    height: 30,
    justifyContent: 'flex-end',
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: colors.charcoal,
    marginBottom: 4,
  },
  signatureBoxName: {
    fontSize: 9,
    fontWeight: 400,
    color: colors.textLight,
  },
})

// ─── Components ──────────────────────────────────────────────────────────────

function HeaderV2({ org, logoDataUri }: { org: any; logoDataUri: string | null }) {
  return React.createElement(View, { style: s.header, fixed: true },
    logoDataUri
      ? React.createElement(View, { style: s.headerLogoBox },
          React.createElement(Image, {
            src: logoDataUri,
            style: { width: 100, height: 40, objectFit: 'contain' },
          })
        )
      : React.createElement(View, { style: s.headerLogoBox },
          React.createElement(Text, {
            style: { fontSize: 16, fontWeight: 700, color: colors.charcoal, letterSpacing: 2 },
          }, org?.businessName || org?.name || 'Company')
        ),
    React.createElement(View, { style: s.headerContact },
      React.createElement(Text, { style: s.headerContactLine }, org?.businessPhone || ''),
      React.createElement(Text, { style: s.headerContactLine }, org?.businessEmail || ''),
      React.createElement(Text, { style: s.headerContactLine }, org?.businessAddress || ''),
      React.createElement(Text, { style: s.headerContactLine },
        `${org?.businessCity || ''} ${org?.businessProvince || ''}, ${org?.businessPostal || ''}`
      )
    )
  )
}

function FooterV2({ org, proposalNumber }: { org: any; proposalNumber: string }) {
  return React.createElement(View, { style: s.footer, fixed: true },
    React.createElement(Text, { style: s.footerLeft },
      `${org?.businessName || org?.name || ''} \u00B7 ${proposalNumber}`
    ),
    React.createElement(Text, {
      style: s.footerRight,
      render: ({ pageNumber }: { pageNumber: number }) => `${pageNumber}`,
    })
  )
}

function SectionHeading({ title }: { title: string }) {
  return React.createElement(View, { style: { marginBottom: 14 } },
    React.createElement(Text, { style: s.sectionHeading }, title),
    React.createElement(View, { style: s.sectionUnderline })
  )
}

// ─── Cover Page ──────────────────────────────────────────────────────────────

function CoverPageV2({ proposal, org, logoDataUri }: { proposal: any; org: any; logoDataUri: string | null }) {
  const companyName = org?.businessName || org?.name || 'Company'

  return React.createElement(Page, { size: 'LETTER', style: s.coverPage },
    // Top amber bar
    React.createElement(View, { style: s.coverTopBar }),
    // Bottom amber bar
    React.createElement(View, { style: s.coverBottomBar }),

    // Centered content
    React.createElement(View, { style: s.coverBody },
      // Logo
      logoDataUri
        ? React.createElement(Image, { src: logoDataUri, style: s.coverLogo })
        : React.createElement(View, { style: { alignItems: 'center', marginBottom: 56 } },
            React.createElement(Text, { style: s.coverCompanyName }, companyName.toUpperCase()),
            React.createElement(Text, { style: s.coverCompanySubtext }, 'INTERIORS')
          ),

      // Title
      React.createElement(Text, { style: s.coverTitle }, 'PROPOSAL'),

      // Amber divider
      React.createElement(View, { style: s.coverDivider }),

      // Metadata
      React.createElement(View, { style: s.coverMeta },
        React.createElement(Text, { style: s.coverProposalNum }, proposal.proposalNumber || ''),
        React.createElement(Text, { style: s.coverDate }, formatDateLong(proposal.createdAt || new Date())),

        React.createElement(View, { style: { marginTop: 28, alignItems: 'center' } },
          React.createElement(Text, { style: s.coverMetaLabel }, 'Prepared for'),
          React.createElement(Text, { style: s.coverClientName }, proposal.clientName || ''),
          proposal.projectAddress
            ? React.createElement(Text, { style: s.coverAddress }, proposal.projectAddress)
            : proposal.clientAddress
              ? React.createElement(Text, { style: s.coverAddress }, proposal.clientAddress)
              : null
        )
      )
    )
  )
}

// ─── Letter Page ─────────────────────────────────────────────────────────────

function LetterPageV2({ proposal, org, logoDataUri }: { proposal: any; org: any; logoDataUri: string | null }) {
  const coverLetter = proposal.coverLetter || ''
  const paragraphs = coverLetter.split('\n').filter((p: string) => p.trim())
  const companyName = org?.businessName || org?.name || 'Company'

  return React.createElement(Page, { size: 'LETTER', style: s.page },
    React.createElement(HeaderV2, { org, logoDataUri }),
    React.createElement(FooterV2, { org, proposalNumber: proposal.proposalNumber || '' }),

    React.createElement(View, { style: { flex: 1 } },
      // Date
      React.createElement(Text, { style: s.letterDate }, formatDateLong(proposal.createdAt || new Date())),

      // Client info
      React.createElement(Text, { style: s.letterClientName }, proposal.clientName || ''),
      React.createElement(Text, { style: s.letterAddress },
        proposal.projectAddress || proposal.clientAddress || ''
      ),

      // Body paragraphs
      ...paragraphs.map((p: string, i: number) =>
        React.createElement(Text, { key: i, style: s.paragraph }, p)
      ),

      // Signature
      React.createElement(View, { style: { marginTop: 'auto' }, wrap: false },
        React.createElement(Text, { style: s.warmRegards }, 'Warm regards,'),
        React.createElement(Text, { style: s.signatureScript },
          proposal.companySignedByName || 'Aaron Meisner'
        ),
        React.createElement(Text, { style: s.signatureName },
          proposal.companySignedByName || 'Aaron Meisner'
        ),
        React.createElement(Text, { style: s.signatureTitle },
          `CEO ${companyName}`
        )
      )
    )
  )
}

// ─── Scope Page ──────────────────────────────────────────────────────────────

function ScopePageV2({ proposal, org, logoDataUri }: { proposal: any; org: any; logoDataUri: string | null }) {
  const content = proposal.content || {}
  const projectOverview = content.projectOverview || ''
  const scopeItems = content.scopeItems || []
  const paymentSchedule = proposal.paymentSchedule || []
  const hourlyRate = proposal.hourlyRate ? Number(proposal.hourlyRate) : null
  const billingType = proposal.billingType || 'FIXED'

  return React.createElement(Page, { size: 'LETTER', style: s.page },
    React.createElement(HeaderV2, { org, logoDataUri }),
    React.createElement(FooterV2, { org, proposalNumber: proposal.proposalNumber || '' }),

    React.createElement(View, { style: { flex: 1 } },
      // Project Overview
      React.createElement(SectionHeading, { title: 'Project Overview' }),
      React.createElement(Text, { style: { ...s.paragraph, marginBottom: 24 } }, projectOverview),

      // Scope of Work
      React.createElement(SectionHeading, { title: 'Scope of Work' }),
      ...scopeItems.map((item: any, i: number) =>
        React.createElement(View, { key: i, style: s.scopeItem, wrap: false },
          React.createElement(View, { style: s.scopeItemHeader },
            React.createElement(Text, { style: s.scopeItemNumber }, `${i + 1}.`),
            React.createElement(Text, { style: s.scopeItemTitle }, item.title)
          ),
          React.createElement(Text, { style: s.scopeItemDescription }, item.description)
        )
      ),

      // Payment Schedule
      React.createElement(View, { style: { marginTop: 24 } },
        React.createElement(SectionHeading, {
          title: billingType === 'HOURLY' ? 'Billing Details' : 'Payment Schedule',
        }),

        billingType === 'HOURLY'
          // Hourly billing
          ? React.createElement(View, null,
              // Hourly Rate row
              React.createElement(View, { style: s.paymentTotalRow },
                React.createElement(Text, { style: s.paymentTotalLabel }, 'Hourly Rate'),
                React.createElement(View, { style: { flexDirection: 'row', alignItems: 'baseline' } },
                  React.createElement(Text, { style: s.paymentTotalAmount },
                    `${formatCurrency(hourlyRate || 0)}/hr`
                  )
                )
              ),
              // Retainer if present
              proposal.depositAmount && Number(proposal.depositAmount) > 0
                ? React.createElement(View, { style: s.paymentRow },
                    React.createElement(Text, { style: s.paymentLabel }, 'Retainer (on signing)'),
                    React.createElement(Text, { style: s.paymentAmount },
                      formatCurrency(Number(proposal.depositAmount))
                    )
                  )
                : null,
              React.createElement(Text, { style: s.paymentNote },
                'Work will be billed based on actual hours worked. Retainer will be applied to future invoices.'
              )
            )
          // Fixed / Hybrid billing
          : React.createElement(View, null,
              // Total row
              React.createElement(View, { style: s.paymentTotalRow },
                React.createElement(Text, { style: s.paymentTotalLabel }, 'Total Project Fee'),
                React.createElement(View, { style: { flexDirection: 'row', alignItems: 'baseline' } },
                  React.createElement(Text, { style: s.paymentTotalAmount },
                    formatCurrency(Number(proposal.subtotal))
                  ),
                  React.createElement(Text, { style: s.paymentTotalTax }, '+ tax')
                )
              ),

              // Milestones
              ...paymentSchedule.map((item: any, i: number) =>
                React.createElement(View, { key: i, style: s.paymentRow },
                  React.createElement(Text, { style: s.paymentLabel }, item.title),
                  React.createElement(Text, { style: s.paymentAmount }, formatCurrency(item.amount))
                )
              ),

              React.createElement(Text, { style: s.paymentNote },
                `Payments are due within 7 days of the invoice date.${billingType === 'HYBRID' && hourlyRate ? ` Additional work beyond the scope of work will be billed at ${formatCurrency(hourlyRate)}/hour.` : ''}`
              ),
              React.createElement(Text, { style: { ...s.paymentNote, marginTop: 12 } },
                'Once approved, design development will begin immediately, and coordination with consultants will be scheduled accordingly.'
              )
            )
      )
    )
  )
}

// ─── Terms Page ──────────────────────────────────────────────────────────────

function TermsPageV2({ proposal, org, logoDataUri }: { proposal: any; org: any; logoDataUri: string | null }) {
  const content = proposal.content || {}
  const terms = content.terms || ''
  const termItems = terms.split('\n').filter((line: string) => line.trim().startsWith('-'))
  const ccFeePercent = proposal.ccFeePercent ? Number(proposal.ccFeePercent) : 3.5
  const companyName = org?.businessName || org?.name || 'Company'

  return React.createElement(Page, { size: 'LETTER', style: s.page },
    React.createElement(HeaderV2, { org, logoDataUri }),
    React.createElement(FooterV2, { org, proposalNumber: proposal.proposalNumber || '' }),

    React.createElement(View, { style: { flex: 1 } },
      // Additional Services
      React.createElement(SectionHeading, { title: 'Additional Services' }),
      React.createElement(View, { style: { ...s.termRow, marginBottom: 8 } },
        React.createElement(View, { style: s.termBullet }),
        React.createElement(Text, { style: s.termText },
          `When paid through a credit card, ${ccFeePercent}% of the transaction value will be charged towards credit card fees.`
        )
      ),

      // Terms
      React.createElement(SectionHeading, { title: 'Terms & Conditions' }),
      ...termItems.map((term: string, i: number) => {
        const text = term.replace(/^-\s*/, '').trim()
        return React.createElement(View, { key: i, style: s.termRow },
          React.createElement(View, { style: s.termBullet }),
          React.createElement(Text, { style: s.termText }, text)
        )
      }),

      // Closing text
      React.createElement(Text, { style: s.closingText },
        `I look forward to hearing from you, and as always, please feel free to call with any questions or further clarification.${org?.businessPhone ? ` I can be contacted at ${org.businessPhone}.` : ''}`
      ),

      // Sincerely
      React.createElement(Text, { style: { ...s.signatureTitle, marginBottom: 1 } }, 'Sincerely,'),
      React.createElement(Text, { style: { ...s.signatureName, fontSize: 10 } },
        proposal.companySignedByName || 'Aaron Meisner'
      ),
      React.createElement(Text, { style: { ...s.signatureTitle, fontSize: 9 } }, `CEO ${companyName}`),

      // Signature lines — compact three-column
      React.createElement(View, {
        style: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 10,
          gap: 24,
          alignItems: 'flex-end',
        },
      },
        // Company
        React.createElement(View, { style: { flex: 1 } },
          React.createElement(View, { style: { minHeight: 36, justifyContent: 'flex-end' } },
            React.createElement(Text, {
              style: { fontSize: 20, fontFamily: 'Priestacy', color: colors.charcoal },
            }, proposal.companySignedByName || 'Aaron Meisner')
          ),
          React.createElement(View, { style: { borderBottomWidth: 0.75, borderBottomColor: colors.charcoal, marginTop: 2, marginBottom: 4 } }),
          React.createElement(Text, { style: { fontSize: 8, fontWeight: 300, color: colors.textMuted } },
            proposal.companySignedByName || 'Aaron Meisner'
          )
        ),

        // Client
        React.createElement(View, { style: { flex: 1 } },
          React.createElement(View, { style: { minHeight: 36, justifyContent: 'flex-end' } },
            proposal.signatureData && proposal.signatureType === 'drawn'
              ? React.createElement(Image, {
                  src: proposal.signatureData,
                  style: { width: 110, height: 28, objectFit: 'contain' },
                })
              : proposal.signedByName
                ? React.createElement(Text, {
                    style: { fontSize: 18, fontFamily: 'GreatVibes', color: colors.charcoal },
                  }, proposal.signedByName)
                : null
          ),
          React.createElement(View, { style: { borderBottomWidth: 0.75, borderBottomColor: colors.charcoal, marginTop: 2, marginBottom: 4 } }),
          React.createElement(Text, { style: { fontSize: 8, fontWeight: 300, color: colors.textMuted } },
            proposal.signedByName || proposal.clientName || 'Client'
          )
        ),

        // Date
        React.createElement(View, { style: { flex: 1 } },
          React.createElement(View, { style: { minHeight: 36, justifyContent: 'flex-end' } },
            proposal.signedAt
              ? React.createElement(Text, {
                  style: { fontSize: 9, fontWeight: 400, color: colors.charcoal },
                }, formatDateLong(proposal.signedAt))
              : null
          ),
          React.createElement(View, { style: { borderBottomWidth: 0.75, borderBottomColor: colors.charcoal, marginTop: 2, marginBottom: 4 } }),
          React.createElement(Text, { style: { fontSize: 8, fontWeight: 300, color: colors.textMuted } }, 'Date')
        )
      )
    )
  )
}

// ─── Document ────────────────────────────────────────────────────────────────

function ProposalPDFV2({ proposal, org, logoDataUri }: { proposal: any; org: any; logoDataUri: string | null }) {
  return React.createElement(Document, null,
    React.createElement(CoverPageV2, { proposal, org, logoDataUri }),
    React.createElement(LetterPageV2, { proposal, org, logoDataUri }),
    React.createElement(ScopePageV2, { proposal, org, logoDataUri }),
    React.createElement(TermsPageV2, { proposal, org, logoDataUri })
  )
}

// ─── Export ──────────────────────────────────────────────────────────────────

export async function generateProposalPdfBufferV2(
  proposal: any,
  org: any
): Promise<Buffer> {
  const logoDataUri = getLogoDataUri()
  const pdfBuffer = await renderToBuffer(
    React.createElement(ProposalPDFV2, { proposal, org, logoDataUri })
  )
  return Buffer.from(pdfBuffer)
}

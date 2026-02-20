// Project Files V3 — Shared TypeScript types

export interface V3Drawing {
  id: string
  drawingNumber: string
  title: string
  discipline: string | null
  drawingType: string | null
  status: string
  currentRevision: number
  dropboxPath: string | null
  fileName: string | null
  fileSize: number | null
  floor: { id: string; name: string; shortName: string } | null
  revisions: V3Revision[]
  recipientCount: number
  outdatedRecipientCount: number
  lastTransmittal: {
    recipientName: string
    sentAt: string
    revisionNumber: number
  } | null
}

export interface V3Revision {
  id: string
  revisionNumber: number
  description: string | null
  issuedDate: string
  issuedBy: string
  issuedByUser: { name: string } | null
}

export interface V3Recipient {
  id: string
  name: string
  email: string
  company: string | null
  type: 'CLIENT' | 'CONTRACTOR' | 'SUBCONTRACTOR' | 'TEAM' | 'OTHER'
  trade: string | null
}

export interface V3Transmittal {
  id: string
  transmittalNumber: string
  subject: string | null
  recipientName: string
  recipientEmail: string | null
  recipientCompany: string | null
  recipientType: string | null
  method: string
  status: string
  notes: string | null
  sentAt: string | null
  sentBy: string | null
  sentByUser: { name: string } | null
  createdAt: string
  items: V3TransmittalItem[]
}

export interface V3TransmittalItem {
  id: string
  drawingId: string
  drawingNumber: string
  title: string
  discipline: string | null
  revisionNumber: number | null
  purpose: string | null
  notes: string | null
}

export interface V3MatrixCell {
  revisionNumber: number
  sentAt: string
  transmittalNumber: string
  isLatest: boolean
}

export interface V3MatrixData {
  drawings: Array<{
    id: string
    drawingNumber: string
    title: string
    discipline: string | null
    currentRevision: number
  }>
  recipients: V3Recipient[]
  cells: Record<string, Record<string, V3MatrixCell | null>>
}

export interface V3TimelineEvent {
  type: 'transmittal' | 'file_send'
  id: string
  transmittalNumber?: string
  recipientName: string
  recipientEmail: string | null
  recipientCompany: string | null
  subject: string | null
  sentAt: string
  sentByName: string
  // For transmittals
  items?: Array<{
    drawingNumber: string
    title: string
    discipline: string | null
    revisionNumber: number | null
    purpose: string | null
  }>
  // For file sends
  fileName?: string
  filePath?: string
  fileSize?: number | null
}

export interface V3FileSend {
  id: string
  recipientName: string
  recipientEmail: string
  recipientCompany: string | null
  subject: string | null
  notes: string | null
  fileName: string
  filePath: string
  fileSize: number | null
  mimeType: string | null
  sentAt: string | null
  sentByUser: { name: string } | null
  createdAt: string
}

// Send form types
export interface SendRecipient {
  name: string
  email: string
  company?: string
  type?: string
  trade?: string
}

export interface SendDrawingItem {
  drawingId: string
  revisionId?: string
  purpose: string
}

export interface CreateTransmittalRequest {
  recipients: SendRecipient[]
  items: SendDrawingItem[]
  subject?: string
  notes?: string
  sendImmediately: boolean
}

export interface CreateFileSendRequest {
  filePath: string
  fileName: string
  fileSize?: number
  mimeType?: string
  recipients: SendRecipient[]
  subject?: string
  notes?: string
}

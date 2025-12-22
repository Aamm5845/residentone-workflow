'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Mail, CheckCircle, Edit2, Eye, Paperclip, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

// Helper function to extract text content from HTML for editing
function extractEmailText(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  
  // Get the main content div
  const contentDiv = doc.querySelector('body > div > div:nth-of-type(2)')
  if (!contentDiv) {
    // Fallback: get all p tags
    const paragraphs = Array.from(doc.querySelectorAll('p'))
    return paragraphs
      .map(p => p.textContent?.trim())
      .filter(text => text && !text.includes('Meisner Interiors') && text !== '© 2025 Meisner Interiors. All rights reserved.')
      .join('\n\n')
  }
  
  const paragraphs = Array.from(contentDiv.querySelectorAll('p'))
  return paragraphs
    .map(p => p.textContent?.trim())
    .filter(text => text && text !== 'Best regards,')
    .join('\n\n')
}

// Helper function to update HTML with edited text content
function updateHTMLWithEditedText(
  originalHTML: string,
  newText: string
): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(originalHTML, 'text/html')
  
  // Get all content paragraphs (exclude footer)
  const contentDiv = doc.querySelector('body > div > div:nth-of-type(2)')
  if (!contentDiv) return originalHTML
  
  const paragraphs = Array.from(contentDiv.querySelectorAll('p'))
  
  // Split new text into paragraphs
  const newParagraphs = newText.split('\n\n').filter(p => p.trim())
  
  // Replace each paragraph's text content
  let paragraphIndex = 0
  let updatedHTML = originalHTML
  
  for (const para of paragraphs) {
    const oldText = para.textContent?.trim()
    if (oldText && oldText !== 'Best regards,' && paragraphIndex < newParagraphs.length) {
      const newParaText = newParagraphs[paragraphIndex].trim()
      // Replace the text content while preserving HTML structure
      const oldHTML = para.outerHTML
      const newHTML = oldHTML.replace(oldText, newParaText)
      updatedHTML = updatedHTML.replace(oldHTML, newHTML)
      paragraphIndex++
    }
  }
  
  return updatedHTML
}

export interface EmailAttachment {
  id: string
  title: string
  url?: string
  type?: string
  size?: number
  selected: boolean
}

export interface EmailPreviewData {
  to: string
  subject: string
  htmlContent: string
  textContent?: string
  attachments?: EmailAttachment[]
}

interface EmailPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  emailData: EmailPreviewData | null
  onSend: (emailData: EmailPreviewData, selectedAttachmentIds: string[]) => Promise<void>
  onSendTest?: (emailData: EmailPreviewData, selectedAttachmentIds: string[], testEmail: string) => Promise<void>
  title?: string
  allowEditRecipient?: boolean
}

export default function EmailPreviewModal({
  open,
  onOpenChange,
  emailData,
  onSend,
  onSendTest,
  title = 'Email Preview',
  allowEditRecipient = false
}: EmailPreviewModalProps) {
  const [editMode, setEditMode] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [editedData, setEditedData] = useState<EmailPreviewData | null>(null)
  const [showAdvancedEdit, setShowAdvancedEdit] = useState(false)
  
  // Editable text content
  const [editableText, setEditableText] = useState('')
  const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(new Set())
  
  // Test email state
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open && emailData) {
      setEditedData({ ...emailData })
      setEditMode(false)
      setSending(false)
      setSent(false)
      setShowAdvancedEdit(false)
      
      // Extract editable content
      const text = extractEmailText(emailData.htmlContent)
      setEditableText(text)
      
      // Initialize selected attachments
      if (emailData.attachments) {
        const selected = new Set(emailData.attachments.filter(a => a.selected).map(a => a.id))
        setSelectedAttachments(selected)
      }
    }
  }, [open, emailData])

  const handleSend = async () => {
    if (!editedData) return

    setSending(true)
    try {
      let finalHtmlContent = editedData.htmlContent
      
      // If in edit mode (not advanced), update HTML with edited text
      if (editMode && !showAdvancedEdit) {
        finalHtmlContent = updateHTMLWithEditedText(
          editedData.htmlContent,
          editableText
        )
      }
      
      await onSend(
        {
          ...editedData,
          htmlContent: finalHtmlContent
        },
        Array.from(selectedAttachments)
      )
      setSent(true)
      // Auto close after 2 seconds
      setTimeout(() => {
        onOpenChange(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to send email:', error)
      alert('Failed to send email. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleCancel = () => {
    if (sending) return
    onOpenChange(false)
  }
  
  const handleSendTest = async () => {
    if (!editedData || !testEmail.trim() || !onSendTest) return
    
    setSendingTest(true)
    try {
      let finalHtmlContent = editedData.htmlContent
      
      // If in edit mode (not advanced), update HTML with edited text
      if (editMode && !showAdvancedEdit) {
        finalHtmlContent = updateHTMLWithEditedText(
          editedData.htmlContent,
          editableText
        )
      }
      
      await onSendTest(
        {
          ...editedData,
          htmlContent: finalHtmlContent
        },
        Array.from(selectedAttachments),
        testEmail.trim()
      )
      
      setShowTestEmailDialog(false)
      setTestEmail('')
      alert(`Test email sent successfully to ${testEmail.trim()}`)
    } catch (error) {
      console.error('Failed to send test email:', error)
      alert('Failed to send test email. Please try again.')
    } finally {
      setSendingTest(false)
    }
  }

  if (!editedData) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            <Mail className="w-5 h-5 mr-2 inline" />
            {sent ? 'Email Sent!' : title}
          </DialogTitle>
          <DialogDescription>
            {sent 
              ? 'Your email has been sent successfully.'
              : editMode 
                ? 'Edit the email content and recipient information below.'
                : 'Review the email before sending. You can edit it if needed.'
            }
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Sent Successfully!</h3>
              <p className="text-gray-600">The email has been sent to {editedData.to}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Recipient Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Email
                </label>
                <Input
                  type="email"
                  value={editedData.to}
                  onChange={(e) => setEditedData({ ...editedData, to: e.target.value })}
                  disabled={!editMode || !allowEditRecipient}
                  className={!allowEditRecipient ? 'bg-gray-50' : ''}
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <Input
                  type="text"
                  value={editedData.subject}
                  onChange={(e) => setEditedData({ ...editedData, subject: e.target.value })}
                  placeholder="Email subject..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can edit the subject directly. Click "Edit Content" below to modify the email message.
                </p>
              </div>

              {/* Attachments Section */}
              {editedData.attachments && editedData.attachments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Paperclip className="w-4 h-4 inline mr-1" />
                    Attachments ({selectedAttachments.size} selected)
                  </label>
                  <div className="border border-gray-200 rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                    {editedData.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-start space-x-2 p-2 hover:bg-gray-50 rounded">
                        <Checkbox
                          checked={selectedAttachments.has(attachment.id)}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedAttachments)
                            if (checked) {
                              newSelected.add(attachment.id)
                            } else {
                              newSelected.delete(attachment.id)
                            }
                            setSelectedAttachments(newSelected)
                          }}
                          id={`attachment-${attachment.id}`}
                        />
                        <label 
                          htmlFor={`attachment-${attachment.id}`}
                          className="flex-1 text-sm cursor-pointer"
                        >
                          <div className="font-medium text-gray-900">{attachment.title}</div>
                          {attachment.type && (
                            <div className="text-xs text-gray-500">
                              {attachment.type} {attachment.size && `• ${Math.round(attachment.size / 1024 / 1024 * 100) / 100} MB`}
                            </div>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Select which files to include in the email
                  </p>
                </div>
              )}

              {/* Email Content Editor */}
              {editMode ? (
                <div className="space-y-4">
                  {!showAdvancedEdit ? (
                    <>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-800">
                          <strong>📝 Edit Email Content:</strong> Edit all the text below. The email design and formatting will be preserved automatically.
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email Content
                        </label>
                        <Textarea
                          value={editableText}
                          onChange={(e) => setEditableText(e.target.value)}
                          className="min-h-[300px] font-sans"
                          placeholder="Edit email content here. Separate paragraphs with double line breaks."
                          rows={12}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          ✨ <strong>Tip:</strong> Separate paragraphs with double line breaks (press Enter twice). The email header, footer, and styling will be preserved automatically.
                        </p>
                      </div>
                      
                      <div className="border-t border-gray-200 pt-3 mt-4">
                        <button
                          type="button"
                          onClick={() => setShowAdvancedEdit(true)}
                          className="text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                          Advanced: Edit full HTML (for developers only)
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                        <p className="text-sm text-amber-800">
                          <strong>⚠️ Advanced Mode:</strong> You're editing raw HTML. Be careful not to break the email structure.
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Content (HTML)
                        </label>
                        <Textarea
                          value={editedData.htmlContent}
                          onChange={(e) => setEditedData({ ...editedData, htmlContent: e.target.value })}
                          className="min-h-[300px] font-mono text-xs"
                          placeholder="Email HTML content..."
                        />
                      </div>
                      
                      <div className="border-t border-gray-200 pt-3">
                        <button
                          type="button"
                          onClick={() => setShowAdvancedEdit(false)}
                          className="text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                          ← Back to Simple Edit
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Email Preview
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditMode(true)}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit Content
                    </Button>
                  </div>
                  <div className="border border-gray-300 rounded-md overflow-hidden bg-white">
                    <div 
                      className="p-4 max-h-[400px] overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: editedData.htmlContent }}
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={sending}
              >
                Cancel
              </Button>
              {editMode && (
                <Button
                  variant="outline"
                  onClick={() => {
                    // Update HTML with edited text before switching to preview
                    if (!showAdvancedEdit) {
                      const updatedHtml = updateHTMLWithEditedText(
                        editedData.htmlContent,
                        editableText
                      )
                      setEditedData({ ...editedData, htmlContent: updatedHtml })
                    }
                    setEditMode(false)
                  }}
                  disabled={sending}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
              )}
              {onSendTest && (
                <Button
                  variant="outline"
                  onClick={() => setShowTestEmailDialog(true)}
                  disabled={sending || !editedData.subject}
                  className="border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Test
                </Button>
              )}
              <Button
                onClick={handleSend}
                disabled={sending || !editedData.to || !editedData.subject}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
    
    {/* Test Email Dialog */}
    {showTestEmailDialog && onSendTest && (
      <Dialog open={showTestEmailDialog} onOpenChange={setShowTestEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-600" />
              Send Test Email
            </DialogTitle>
            <DialogDescription>
              Send a test email with your current edits to verify how it will look before sending to the client.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="test-email-address" className="block text-sm font-medium text-gray-700 mb-2">
                Test Email Address
              </label>
              <Input
                id="test-email-address"
                type="email"
                placeholder="Enter email address..."
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && testEmail.trim()) {
                    handleSendTest()
                  }
                }}
              />
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                💡 The test email will include all your edits and the same attachments that would be sent to the client.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTestEmailDialog(false)}
              disabled={sendingTest}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendTest}
              disabled={sendingTest || !testEmail.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {sendingTest ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Test
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
  </>
  )
}

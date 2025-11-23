'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Mail, CheckCircle, Edit2, Eye } from 'lucide-react'

// Helper function to extract editable text content from HTML
function extractEditableContent(html: string): { greeting: string; mainParagraphs: string[] } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  
  // Find all paragraphs in the main content
  const allParagraphs = Array.from(doc.querySelectorAll('p'))
  
  let greeting = ''
  const mainParagraphs: string[] = []
  
  // Extract greeting (usually starts with "Dear")
  const greetingPara = allParagraphs.find(p => p.textContent?.trim().startsWith('Dear'))
  if (greetingPara) {
    greeting = greetingPara.textContent?.trim() || ''
    
    // Get index to find paragraphs after greeting
    const greetingIndex = allParagraphs.indexOf(greetingPara)
    
    // Extract main content paragraphs (after greeting, before footer)
    for (let i = greetingIndex + 1; i < allParagraphs.length; i++) {
      const text = allParagraphs[i].textContent?.trim()
      // Skip empty paragraphs and footer text
      if (text && 
          !text.includes('Interior Design Studio') && 
          !text.includes('Professional Interior Design Services') &&
          text.length > 10) {
        mainParagraphs.push(text)
      }
    }
  }
  
  return { greeting, mainParagraphs }
}

// Helper function to update HTML with edited text content
function updateHTMLWithEditedContent(
  originalHTML: string, 
  greeting: string, 
  mainParagraphs: string[]
): string {
  let updatedHTML = originalHTML
  
  // Replace greeting
  const greetingRegex = /(<p[^>]*>\s*)(Dear[^<]*)(<\/p>)/i
  const greetingMatch = updatedHTML.match(greetingRegex)
  if (greetingMatch) {
    updatedHTML = updatedHTML.replace(greetingRegex, `$1${greeting}$3`)
  }
  
  // Replace main paragraphs - find and replace each one
  const parser = new DOMParser()
  const doc = parser.parseFromString(originalHTML, 'text/html')
  const allParagraphs = Array.from(doc.querySelectorAll('p'))
  
  const greetingPara = allParagraphs.find(p => p.textContent?.trim().startsWith('Dear'))
  if (greetingPara) {
    const greetingIndex = allParagraphs.indexOf(greetingPara)
    let paraIndex = 0
    
    for (let i = greetingIndex + 1; i < allParagraphs.length && paraIndex < mainParagraphs.length; i++) {
      const originalText = allParagraphs[i].textContent?.trim()
      if (originalText && 
          !originalText.includes('Interior Design Studio') && 
          !originalText.includes('Professional Interior Design Services') &&
          originalText.length > 10) {
        // Replace this paragraph's text
        const paragraphHTML = allParagraphs[i].outerHTML
        const newParagraphHTML = paragraphHTML.replace(
          originalText,
          mainParagraphs[paraIndex]
        )
        updatedHTML = updatedHTML.replace(paragraphHTML, newParagraphHTML)
        paraIndex++
      }
    }
  }
  
  return updatedHTML
}

export interface EmailPreviewData {
  to: string
  subject: string
  htmlContent: string
  textContent?: string
}

interface EmailPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  emailData: EmailPreviewData | null
  onSend: (emailData: EmailPreviewData) => Promise<void>
  title?: string
  allowEditRecipient?: boolean
}

export default function EmailPreviewModal({
  open,
  onOpenChange,
  emailData,
  onSend,
  title = 'Email Preview',
  allowEditRecipient = false
}: EmailPreviewModalProps) {
  const [editMode, setEditMode] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [editedData, setEditedData] = useState<EmailPreviewData | null>(null)
  const [showAdvancedEdit, setShowAdvancedEdit] = useState(false)
  
  // Editable text fields
  const [editableGreeting, setEditableGreeting] = useState('')
  const [editableParagraphs, setEditableParagraphs] = useState<string[]>([])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open && emailData) {
      setEditedData({ ...emailData })
      setEditMode(false)
      setSending(false)
      setSent(false)
      setShowAdvancedEdit(false)
      
      // Extract editable content
      const { greeting, mainParagraphs } = extractEditableContent(emailData.htmlContent)
      setEditableGreeting(greeting)
      setEditableParagraphs(mainParagraphs)
    }
  }, [open, emailData])

  const handleSend = async () => {
    if (!editedData) return

    setSending(true)
    try {
      let finalHtmlContent = editedData.htmlContent
      
      // If in edit mode (not advanced), update HTML with edited text
      if (editMode && !showAdvancedEdit) {
        finalHtmlContent = updateHTMLWithEditedContent(
          editedData.htmlContent,
          editableGreeting,
          editableParagraphs
        )
      }
      
      await onSend({
        ...editedData,
        htmlContent: finalHtmlContent
      })
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

              {/* Email Content Editor */}
              {editMode ? (
                <div className="space-y-4">
                  {!showAdvancedEdit ? (
                    <>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-800">
                          <strong>📝 Edit Email Content:</strong> Modify the text below. The formatting and design will be preserved.
                        </p>
                      </div>
                      
                      <div className="space-y-4">
                        {/* Greeting */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Greeting
                          </label>
                          <Input
                            value={editableGreeting}
                            onChange={(e) => setEditableGreeting(e.target.value)}
                            placeholder="Dear Client,"
                          />
                        </div>
                        
                        {/* Main Content Paragraphs */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email Message
                          </label>
                          <div className="space-y-3">
                            {editableParagraphs.map((paragraph, index) => (
                              <div key={index}>
                                <label className="block text-xs text-gray-500 mb-1">
                                  Paragraph {index + 1}
                                </label>
                                <Textarea
                                  value={paragraph}
                                  onChange={(e) => {
                                    const newParagraphs = [...editableParagraphs]
                                    newParagraphs[index] = e.target.value
                                    setEditableParagraphs(newParagraphs)
                                  }}
                                  className="min-h-[80px]"
                                  rows={3}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
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
                      const updatedHtml = updateHTMLWithEditedContent(
                        editedData.htmlContent,
                        editableGreeting,
                        editableParagraphs
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
  )
}

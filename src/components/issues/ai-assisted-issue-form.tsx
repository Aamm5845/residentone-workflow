'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Send,
  Terminal,
  Upload,
  X,
  Image as ImageIcon,
  Loader2,
  CheckCircle,
  Zap,
  ArrowLeft
} from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface IssueSummary {
  title: string
  description: string
  suggestedType: 'BUG' | 'FEATURE_REQUEST' | 'UPDATE_REQUEST' | 'GENERAL'
}

interface AIAssistedIssueFormProps {
  priority: 'HIGH' | 'URGENT'
  onSubmit: (data: {
    title: string
    description: string
    type: string
    consoleLog?: string
    imageFile?: File | null
  }) => void
  onCancel: () => void
  onSwitchToManual: () => void
}

export function AIAssistedIssueForm({
  priority,
  onSubmit,
  onCancel,
  onSwitchToManual
}: AIAssistedIssueFormProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [consoleLog, setConsoleLog] = useState('')
  const [showConsoleInput, setShowConsoleInput] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [isReadyToSubmit, setIsReadyToSubmit] = useState(false)
  const [issueSummary, setIssueSummary] = useState<IssueSummary | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Initial greeting
  useEffect(() => {
    const greeting = priority === 'URGENT'
      ? "I see this is an urgent issue. Let me help you report it clearly so we can fix it right away. What's happening?"
      : "I'll help you report this high-priority issue. What problem are you experiencing?"

    setMessages([{ role: 'assistant', content: greeting }])
  }, [priority])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input after assistant responds
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isLoading])

  // Convert image file to base64
  const imageToBase64 = async (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(',')[1]
        resolve({ base64, mimeType: file.type })
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage = inputValue.trim()
    setInputValue('')

    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setIsLoading(true)

    try {
      // Prepare image data if available
      let imageBase64: string | undefined
      let imageMimeType: string | undefined

      if (imageFile) {
        const imageData = await imageToBase64(imageFile)
        imageBase64 = imageData.base64
        imageMimeType = imageData.mimeType
      }

      const response = await fetch('/api/issues/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          hasConsoleLog: !!consoleLog,
          hasScreenshot: !!imageFile,
          consoleLog: consoleLog || undefined,
          priority,
          imageBase64,
          imageMimeType
        })
      })

      if (!response.ok) throw new Error('Failed to get AI response')

      const data = await response.json()

      setMessages([...newMessages, { role: 'assistant', content: data.message }])

      if (data.isReadyToSubmit && data.issueSummary) {
        setIsReadyToSubmit(true)
        setIssueSummary(data.issueSummary)
      }

      // Check if AI is asking for console logs
      if (data.message.toLowerCase().includes('f12') ||
          data.message.toLowerCase().includes('console')) {
        setShowConsoleInput(true)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages([
        ...newMessages,
        { role: 'assistant', content: "Sorry, I had trouble processing that. Could you try again?" }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setImageError('Only JPEG, PNG, and WebP images are allowed.')
      return
    }

    const maxSize = 4 * 1024 * 1024
    if (file.size > maxSize) {
      setImageError('File is too large. Maximum size is 4MB.')
      return
    }

    setImageError(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleRemoveImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview(null)
    setImageError(null)
  }

  const handleSubmitIssue = async () => {
    if (!issueSummary) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        title: issueSummary.title,
        description: issueSummary.description,
        type: issueSummary.suggestedType,
        consoleLog: consoleLog || undefined,
        imageFile: imageFile || null
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-2">
          <Zap className={`w-5 h-5 ${priority === 'URGENT' ? 'text-red-500' : 'text-orange-500'}`} />
          <span className="font-medium">
            {priority === 'URGENT' ? 'Urgent Issue Report' : 'High Priority Issue Report'}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onSwitchToManual} className="text-gray-500">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Manual Entry
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Ready to Submit */}
      {isReadyToSubmit && issueSummary && (
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Issue Understood</span>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div>
              <span className="text-xs font-medium text-gray-500">Title:</span>
              <p className="text-sm font-medium">{issueSummary.title}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">Description:</span>
              <p className="text-sm text-gray-700">{issueSummary.description}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSubmitIssue}
              disabled={isSubmitting}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Submit Issue
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Input Area - only show if not ready to submit */}
      {!isReadyToSubmit && (
        <div className="border-t pt-4 space-y-3">
          {/* Console Log Input */}
          {showConsoleInput && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Terminal className="w-4 h-4" />
                Console Log (Press F12 in browser)
              </Label>
              <Textarea
                value={consoleLog}
                onChange={(e) => setConsoleLog(e.target.value)}
                placeholder="Paste any error messages from the browser console here..."
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          )}

          {/* Image Upload */}
          <div className="flex items-center gap-2">
            {!imagePreview ? (
              <label className="cursor-pointer">
                <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border rounded-md hover:bg-gray-50">
                  <Upload className="w-4 h-4" />
                  Attach Screenshot
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                <ImageIcon className="w-4 h-4" />
                Screenshot attached
                <button onClick={handleRemoveImage} className="ml-1 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {imageError && <span className="text-xs text-red-500">{imageError}</span>}

            {!showConsoleInput && (
              <button
                onClick={() => setShowConsoleInput(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border rounded-md hover:bg-gray-50"
              >
                <Terminal className="w-4 h-4" />
                Add Console Log
              </button>
            )}
          </div>

          {/* Message Input */}
          <div className="flex gap-2">
            <Textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your issue..."
              rows={2}
              className="flex-1 resize-none"
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      )}
    </div>
  )
}

export default AIAssistedIssueForm

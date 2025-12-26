'use client'

import { useState, useEffect, useRef } from 'react'
import {
  MessageCircle,
  Send,
  Loader2,
  Paperclip,
  X,
  ChevronDown,
  ChevronUp,
  User,
  Building2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  content: string
  attachments?: any
  direction: 'INBOUND' | 'OUTBOUND'
  senderType: 'TEAM' | 'SUPPLIER'
  senderName: string
  createdAt: string
  readAt?: string
}

interface SupplierMessagingProps {
  token: string
  projectName?: string
  supplierName?: string
}

export default function SupplierMessaging({ token, projectName, supplierName }: SupplierMessagingProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMessages()
    // Poll for new messages every 30 seconds
    const interval = setInterval(loadMessages, 30000)
    return () => clearInterval(interval)
  }, [token])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/supplier-portal/${token}/messages`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (err) {
      console.error('Failed to load messages:', err)
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim()) return

    setSending(true)
    try {
      const response = await fetch(`/api/supplier-portal/${token}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newMessage.trim()
        })
      })

      if (response.ok) {
        const data = await response.json()
        setMessages(prev => [...prev, data.message])
        setNewMessage('')
      }
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday ' + date.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-CA', { weekday: 'short' }) + ' ' +
        date.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
    } else {
      return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) + ' ' +
        date.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
    }
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 shadow-xl border-purple-200 z-50">
      <CardHeader
        className="pb-2 cursor-pointer bg-purple-50 rounded-t-lg"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">Messages</CardTitle>
              <p className="text-xs text-gray-500">{projectName || 'Project'}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="p-1">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="p-0">
          {/* Messages List */}
          <div className="h-80 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle className="w-12 h-12 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No messages yet</p>
                <p className="text-xs text-gray-400">Start a conversation with the team</p>
              </div>
            ) : (
              <>
                {messages.map((message) => {
                  const isFromSupplier = message.senderType === 'SUPPLIER'
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        'flex gap-2',
                        isFromSupplier ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {!isFromSupplier && (
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex-shrink-0 flex items-center justify-center">
                          <User className="w-4 h-4 text-purple-600" />
                        </div>
                      )}
                      <div
                        className={cn(
                          'max-w-[75%] rounded-lg px-3 py-2',
                          isFromSupplier
                            ? 'bg-purple-600 text-white'
                            : 'bg-white border'
                        )}
                      >
                        {!isFromSupplier && (
                          <p className={cn(
                            'text-xs font-medium mb-1',
                            isFromSupplier ? 'text-purple-200' : 'text-purple-600'
                          )}>
                            {message.senderName}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className={cn(
                          'text-xs mt-1',
                          isFromSupplier ? 'text-purple-200' : 'text-gray-400'
                        )}>
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                      {isFromSupplier && (
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex-shrink-0 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Message Input */}
          <div className="p-3 border-t bg-white rounded-b-lg">
            <div className="flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="min-h-[40px] max-h-[100px] resize-none text-sm"
              />
              <Button
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
                size="sm"
                className="px-3 bg-purple-600 hover:bg-purple-700"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Press Enter to send</p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

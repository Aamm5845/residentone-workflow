'use client'

import { useState, useEffect, useRef } from 'react'
import {
  MessageCircle,
  Send,
  Loader2,
  User,
  Building2,
  Mail,
  Check,
  CheckCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  content: string
  attachments?: any
  direction: 'INBOUND' | 'OUTBOUND'
  senderType: 'TEAM' | 'SUPPLIER'
  senderName: string
  senderUser?: {
    id: string
    name: string
    image?: string
  }
  createdAt: string
  readAt?: string
}

interface SupplierChatProps {
  supplierId: string
  projectId?: string
  orderId?: string
  supplierName: string
  supplierEmail?: string
  contextLabel?: string
  onMessageSent?: () => void
}

export default function SupplierChat({
  supplierId,
  projectId,
  orderId,
  supplierName,
  supplierEmail,
  contextLabel,
  onMessageSent
}: SupplierChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendEmail, setSendEmail] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMessages()
  }, [supplierId, projectId, orderId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    try {
      const params = new URLSearchParams({ supplierId })
      if (projectId) params.set('projectId', projectId)
      if (orderId) params.set('orderId', orderId)

      const response = await fetch(`/api/supplier-messages?${params}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])

        // Mark unread messages as read
        const unreadIds = data.messages
          .filter((m: Message) => m.direction === 'INBOUND' && !m.readAt)
          .map((m: Message) => m.id)

        if (unreadIds.length > 0) {
          fetch('/api/supplier-messages', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_read', messageIds: unreadIds })
          })
        }
      }
    } catch (err) {
      console.error('Failed to load messages:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!newMessage.trim()) return

    setSending(true)
    try {
      const response = await fetch('/api/supplier-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          projectId,
          orderId,
          content: newMessage.trim(),
          sendEmail
        })
      })

      if (response.ok) {
        const data = await response.json()
        setMessages(prev => [...prev, data.message])
        setNewMessage('')
        onMessageSent?.()
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
      handleSend()
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
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-base">{supplierName}</CardTitle>
              {supplierEmail && (
                <p className="text-sm text-gray-500">{supplierEmail}</p>
              )}
            </div>
          </div>
          {contextLabel && (
            <Badge variant="outline">{contextLabel}</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <MessageCircle className="w-12 h-12 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No messages yet</p>
              <p className="text-xs text-gray-400">Start a conversation with this supplier</p>
            </div>
          ) : (
            <>
              {messages.map((message) => {
                const isFromTeam = message.senderType === 'TEAM'
                return (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-2',
                      isFromTeam ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {!isFromTeam && (
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex-shrink-0 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-purple-600" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[75%] rounded-lg px-3 py-2',
                        isFromTeam
                          ? 'bg-purple-600 text-white'
                          : 'bg-white border'
                      )}
                    >
                      <p className={cn(
                        'text-xs font-medium mb-1',
                        isFromTeam ? 'text-purple-200' : 'text-purple-600'
                      )}>
                        {message.senderName}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <div className={cn(
                        'flex items-center gap-1 mt-1',
                        isFromTeam ? 'text-purple-200' : 'text-gray-400'
                      )}>
                        <span className="text-xs">{formatTime(message.createdAt)}</span>
                        {isFromTeam && (
                          message.readAt ? (
                            <CheckCheck className="w-3 h-3" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )
                        )}
                      </div>
                    </div>
                    {isFromTeam && (
                      <div className="w-8 h-8 bg-purple-600 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {message.senderUser?.image ? (
                          <img
                            src={message.senderUser.image}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-white" />
                        )}
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
        <div className="p-3 border-t bg-white">
          <div className="flex gap-2 mb-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={2}
              className="min-h-[60px] max-h-[120px] resize-none text-sm"
            />
            <Button
              onClick={handleSend}
              disabled={sending || !newMessage.trim()}
              className="px-4 bg-purple-600 hover:bg-purple-700 self-end"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="send-email"
                checked={sendEmail}
                onCheckedChange={setSendEmail}
              />
              <Label htmlFor="send-email" className="text-xs text-gray-500 cursor-pointer">
                <Mail className="w-3 h-3 inline mr-1" />
                Send email notification
              </Label>
            </div>
            <p className="text-xs text-gray-400">Press Enter to send</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

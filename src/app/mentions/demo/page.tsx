'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MentionTextarea } from '@/components/ui/mention-textarea'
import { processMentions, highlightMentions } from '@/lib/mentionUtils'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Users, Send, Bell, MessageSquare, AtSign } from 'lucide-react'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
}

interface Message {
  id: string
  text: string
  author: string
  mentions: string[]
  timestamp: string
  highlighted?: boolean
}

export default function MentionsDemoPage() {
  const { data: session } = useSession()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch team members on mount
  useEffect(() => {
    fetchTeamMembers()
    loadSampleMessages()
  }, [])

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch('/api/team/mentions')
      if (response.ok) {
        const data = await response.json()
        setTeamMembers(data.teamMembers)
      }
    } catch (error) {
      console.error('Error fetching team members:', error)
    }
  }

  const loadSampleMessages = () => {
    // Add some sample messages to demonstrate
    setMessages([
      {
        id: '1',
        text: 'Hey @Aaron, can you review the design concept for the master bedroom? The client wants to see it by Friday.',
        author: 'Sarah Designer',
        mentions: ['Aaron'],
        timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      },
      {
        id: '2', 
        text: 'Just completed the 3D render. @Sarah and @John, please take a look and let me know if any adjustments are needed.',
        author: 'Mike Renderer',
        mentions: ['Sarah', 'John'],
        timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      },
      {
        id: '3',
        text: 'The fabric samples arrived! @Rachel can you coordinate with the client for approval?',
        author: 'Lisa FFE',
        mentions: ['Rachel'],
        timestamp: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
      }
    ])
  }

  const handleSubmit = async (text: string, mentions: string[]) => {
    if (!session?.user || !text.trim()) return

    setLoading(true)
    try {
      // Create the message
      const newMessage: Message = {
        id: Date.now().toString(),
        text,
        author: session.user.name || 'You',
        mentions,
        timestamp: new Date().toISOString(),
        highlighted: true
      }

      // Add to messages
      setMessages(prev => [newMessage, ...prev])

      // Process mentions and create notifications
      if (mentions.length > 0) {
        const result = await processMentions({
          text,
          authorId: session.user.id,
          authorName: session.user.name || 'Anonymous',
          orgId: session.user.orgId || '',
          contextTitle: 'Mentions Demo',
          relatedId: 'demo-message',
          relatedType: 'MESSAGE',
          messagePreview: text.substring(0, 100)
        })

        if (result.notificationCount > 0) {
          toast.success(`Message sent! ${result.notificationCount} team member${result.notificationCount > 1 ? 's' : ''} notified.`)
        } else {
          toast.success('Message sent!')
        }
      } else {
        toast.success('Message sent!')
      }

      // Clear the input
      setMessage('')

    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`
    }
    
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) {
      return `${diffHours}h ago`
    }
    
    return date.toLocaleDateString()
  }

  const renderMessageText = (text: string) => {
    return { __html: highlightMentions(text) }
  }

  if (!session?.user) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sign in to test @mentions</h3>
          <p className="text-gray-600">You need to be signed in to use the mention system.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center">
            <AtSign className="w-8 h-8 mr-3 text-blue-600" />
            @Mention System Demo
          </h1>
          <p className="text-gray-600 mt-2">
            Test the @mention functionality. Type @ followed by a team member's name to mention them and send notifications.
          </p>
        </div>

        {/* Team Members Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Available Team Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamMembers.map(member => (
                <div key={member.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">@{member.name}</div>
                    <div className="text-xs text-gray-500">{member.role.replace('_', ' ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Message Input */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              Send a Message with @mentions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MentionTextarea
              value={message}
              onChange={setMessage}
              onSubmit={handleSubmit}
              teamMembers={teamMembers}
              disabled={loading}
              rows={4}
              submitLabel={loading ? "Sending..." : "Send Message"}
              placeholder="Type your message here... Use @name to mention team members and notify them"
            />
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Tips:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Type @ to see team member suggestions</li>
                <li>• Use arrow keys to navigate suggestions</li>
                <li>• Press Tab or Enter to select a mention</li>
                <li>• Mentioned users will receive instant notifications</li>
                <li>• Press Enter to send, Shift+Enter for new line</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Messages Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              Recent Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {messages.length > 0 ? (
                messages.map(msg => (
                  <div 
                    key={msg.id} 
                    className={`p-4 rounded-lg border ${msg.highlighted ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                          {msg.author.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{msg.author}</span>
                        {msg.mentions.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <Bell className="w-3 h-3 text-blue-500" />
                            <span className="text-xs text-blue-600">mentioned {msg.mentions.length} user{msg.mentions.length > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{formatTimestamp(msg.timestamp)}</span>
                    </div>
                    
                    <div 
                      className="text-gray-800 message-content"
                      dangerouslySetInnerHTML={renderMessageText(msg.text)}
                    />
                    
                    {msg.mentions.length > 0 && (
                      <div className="mt-2 flex items-center space-x-2">
                        <span className="text-xs text-gray-500">Mentioned:</span>
                        {msg.mentions.map((mention, index) => (
                          <span key={index} className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                            @{mention}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No messages yet. Send your first message with @mentions above!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
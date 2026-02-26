'use client'

import useSWR from 'swr'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, MessageCircle } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface ConversationsResponse {
  success: boolean
  teamMembers: Array<{
    id: string
    name: string
    email: string
    role: string
    image: string | null
    messageCount: number
  }>
  generalChatCount: number
  suppliers: Array<{
    id: string
    name: string
    logo: string | null
    messageCount: number
    unreadCount: number
  }>
}

export default function TeamMessagesWidget() {
  const { data, error } = useSWR<ConversationsResponse>(
    '/api/messaging/conversations',
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  )

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">Failed to load messages</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="flex-1">
              <div className="h-3 w-1/2 bg-gray-200 rounded mb-1.5" />
              <div className="h-2.5 w-1/3 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const members = data.teamMembers || []
  const hasMessages = members.some(m => m.messageCount > 0) || data.generalChatCount > 0

  if (members.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-4">
        <p className="text-[14px] font-medium text-gray-700">No conversations</p>
        <p className="text-[12px] text-gray-400 mt-0.5">Start a chat with your team</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col -mx-4 -mb-4">
      <div className="flex-1 overflow-auto">
        {/* General chat */}
        {data.generalChatCount > 0 && (
          <Link
            href="/messaging?channel=general"
            className="group flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#a657f0]/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4 text-[#a657f0]" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[13px] font-medium text-gray-800 group-hover:text-[#1A8CA3] transition-colors">
                General Chat
              </h4>
              <p className="text-[11px] text-gray-400">{data.generalChatCount} messages</p>
            </div>
          </Link>
        )}

        {/* Team members */}
        {members.slice(0, 6).map((member, idx) => (
          <Link
            key={member.id}
            href={`/messaging?user=${member.id}`}
            className={`group flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors ${
              (data.generalChatCount > 0 || idx > 0) ? 'border-t border-gray-100' : ''
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-500 flex-shrink-0 overflow-hidden">
              {member.image ? (
                <Image src={member.image} alt={member.name} width={32} height={32} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                member.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[13px] font-medium text-gray-800 truncate group-hover:text-[#1A8CA3] transition-colors">
                {member.name}
              </h4>
              <p className="text-[11px] text-gray-400 capitalize">{member.role.toLowerCase().replace('_', ' ')}</p>
            </div>
            {member.messageCount > 0 && (
              <span className="text-[10px] text-gray-400 flex-shrink-0">{member.messageCount} msgs</span>
            )}
          </Link>
        ))}
      </div>

      <div className="flex-shrink-0 border-t border-gray-100 px-4 py-2 flex items-center justify-end">
        <Link
          href="/messaging"
          className="text-[11px] font-semibold text-[#1A8CA3] hover:text-[#136F82] flex items-center gap-1 transition-colors"
        >
          All Messages <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}

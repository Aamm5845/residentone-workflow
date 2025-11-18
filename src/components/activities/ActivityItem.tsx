'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { getTypeMeta, formatDescription } from '@/lib/activity-types'
import * as LucideIcons from 'lucide-react'

interface Activity {
  id: string
  action: string
  entity: string
  entityId: string
  details?: any
  createdAt: string
  actor: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    role: string
  } | null
}

interface ActivityItemProps {
  activity: Activity
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const meta = getTypeMeta(activity.action)
  const description = formatDescription(activity)
  
  // Get the icon component dynamically
  const IconComponent = (LucideIcons as any)[meta.icon] || LucideIcons.Activity
  
  // Extract entity URL from details
  const entityUrl = activity.details?.entityUrl
  
  // Get actor initials for avatar fallback
  const getInitials = (name: string | null | undefined, email: string | null | undefined): string => {
    if (name) {
      const parts = name.split(' ')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }
  
  const actorName = activity.actor?.name || activity.actor?.email || 'Unknown User'
  const initials = getInitials(activity.actor?.name, activity.actor?.email)
  
  // Format relative time
  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })
  
  return (
    <div className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100">
      {/* Actor Avatar */}
      <div className="flex-shrink-0">
        {activity.actor?.image ? (
          <img
            src={activity.actor.image}
            alt={actorName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
            {initials}
          </div>
        )}
      </div>
      
      {/* Activity Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
          <IconComponent className={`w-4 h-4 ${meta.color}`} />
        </div>
      </div>
      
      {/* Activity Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-gray-900 leading-relaxed">
            {description}
          </p>
          <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
            {timeAgo}
          </span>
        </div>
        
        {/* Optional Entity Link */}
        {entityUrl && (
          <Link
            href={entityUrl}
            className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            View details
            <LucideIcons.ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  )
}

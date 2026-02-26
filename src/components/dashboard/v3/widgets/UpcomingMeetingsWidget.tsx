'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { Clock, Video, MapPin, Building2, ArrowUpRight } from 'lucide-react'
import type { UpcomingMeeting } from '../types'
import { formatMeetingDate, formatTime } from '../types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function getLocationIcon(type: string) {
  switch (type) {
    case 'VIRTUAL': return <Video className="w-3.5 h-3.5" />
    case 'OUR_OFFICE': return <Building2 className="w-3.5 h-3.5" />
    default: return <MapPin className="w-3.5 h-3.5" />
  }
}

function getLocationLabel(type: string, details?: string | null) {
  switch (type) {
    case 'VIRTUAL': return 'Virtual'
    case 'OUR_OFFICE': return 'Our Office'
    case 'ON_SITE': return details || 'On Site'
    case 'IN_OFFICE': return details || 'In Office'
    default: return type
  }
}

export default function UpcomingMeetingsWidget() {
  const { data, error } = useSWR<{ meetings: UpcomingMeeting[] }>(
    '/api/dashboard/upcoming-meetings',
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: true }
  )

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-sm">Failed to load meetings</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-200" />
            <div className="flex-1">
              <div className="h-3.5 w-3/4 bg-gray-200 rounded mb-1.5" />
              <div className="h-2.5 w-1/2 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const meetings = data.meetings || []

  if (meetings.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-4">
        <p className="text-[14px] font-medium text-gray-700">No meetings ahead</p>
        <p className="text-[12px] text-gray-400 mt-0.5">Your schedule is clear</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col -mx-4 -mb-4">
      <div className="flex-1 overflow-auto">
        {meetings.map((meeting, idx) => {
          const isToday = formatMeetingDate(meeting.startTime) === 'Today'
          return (
            <div
              key={meeting.id}
              className={`group flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                idx > 0 ? 'border-t border-gray-100' : ''
              }`}
            >
              {/* Date badge */}
              <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center ${
                isToday
                  ? 'bg-[#1A8CA3] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                <span className="text-[8px] font-bold uppercase leading-none tracking-wider">
                  {new Date(meeting.startTime).toLocaleDateString('en-US', { month: 'short' })}
                </span>
                <span className="text-[15px] font-bold leading-tight mt-0.5">
                  {new Date(meeting.startTime).getDate()}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {isToday && (
                    <span className="text-[8px] font-bold text-white bg-[#1A8CA3] px-1.5 py-0.5 rounded-full uppercase tracking-widest">
                      Today
                    </span>
                  )}
                  <h4 className="text-[13px] font-medium text-gray-800 truncate group-hover:text-[#1A8CA3] transition-colors">
                    {meeting.title}
                  </h4>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(meeting.startTime)} — {formatTime(meeting.endTime)}
                  </span>
                  <span className="w-px h-2.5 bg-gray-200" />
                  <span className="flex items-center gap-1 truncate">
                    {getLocationIcon(meeting.locationType)}
                    <span className="truncate max-w-[80px]">
                      {getLocationLabel(meeting.locationType, meeting.locationDetails)}
                    </span>
                  </span>
                </div>
              </div>

              {/* Join button or arrow */}
              {meeting.meetingLink && isToday ? (
                <a
                  href={meeting.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-[#1A8CA3] hover:bg-[#136F82] text-white text-[11px] font-semibold rounded-lg transition-colors shadow-sm"
                >
                  <Video className="w-3.5 h-3.5" />
                  Join
                </a>
              ) : (
                <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1A8CA3] transition-colors flex-shrink-0" />
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-100 px-4 py-2 flex items-center justify-end">
        <Link
          href="/calendar"
          className="text-[11px] font-semibold text-[#1A8CA3] hover:text-[#136F82] flex items-center gap-1 transition-colors"
        >
          Calendar <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}

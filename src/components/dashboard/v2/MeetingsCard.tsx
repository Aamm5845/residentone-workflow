'use client'

import Link from 'next/link'
import { Calendar, Clock, Video, MapPin, Building2, ArrowUpRight } from 'lucide-react'
import { MeetingRowSkeleton } from './SkeletonLoader'
import { formatMeetingDate, formatTime } from './types'
import type { UpcomingMeeting } from './types'

interface MeetingsCardProps {
  meetings: UpcomingMeeting[]
  isLoading: boolean
}

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

export default function MeetingsCard({ meetings, isLoading }: MeetingsCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] border border-white/80 overflow-hidden flex flex-col">
      {/* ── HEADER with solid teal bar ── */}
      <div className="relative">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#1A8CA3]" />
        <div className="px-6 pt-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1A8CA3] flex items-center justify-center shadow-[0_2px_8px_rgba(26,140,163,0.35)]">
              <Calendar className="w-5 h-5 text-white" strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#1F2937]">Upcoming Meetings</h2>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                {meetings.length} scheduled
              </p>
            </div>
          </div>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A8CA3]/8 text-[11px] font-semibold text-[#1A8CA3] hover:bg-[#1A8CA3]/15 hover:text-[#136F82] transition-all uppercase tracking-[0.06em]"
          >
            Calendar <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div className="mx-6 h-px bg-[#E5E7EB]" />

      {isLoading ? (
        <div className="flex-1 p-3">
          {[1, 2, 3].map((i) => <MeetingRowSkeleton key={i} />)}
        </div>
      ) : meetings.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-14 px-6">
          <div className="w-14 h-14 rounded-2xl bg-[#1A8CA3]/8 flex items-center justify-center mb-4">
            <Calendar className="w-6 h-6 text-[#1A8CA3]/40" />
          </div>
          <p className="text-[15px] font-semibold text-[#1F2937]">No meetings ahead</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">Your schedule is clear</p>
        </div>
      ) : (
        <div className="flex-1">
          {meetings.map((meeting, idx) => {
            const isToday = formatMeetingDate(meeting.startTime) === 'Today'
            return (
              <div
                key={meeting.id}
                className={`group flex items-center gap-4 px-6 py-4 transition-all duration-200 cursor-pointer ${
                  idx > 0 ? 'border-t border-[#F3F4F6]' : ''
                } hover:bg-[#F8FAFB]`}
              >
                {/* Date badge — solid teal for today, light for others */}
                <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center transition-all ${
                  isToday
                    ? 'bg-[#1A8CA3] text-white shadow-[0_4px_14px_rgba(26,140,163,0.4)]'
                    : 'bg-[#F1F3F5] text-[#6B7280] group-hover:bg-[#1A8CA3]/10 group-hover:text-[#1A8CA3]'
                }`}>
                  <span className="text-[9px] font-bold uppercase leading-none tracking-wider">
                    {new Date(meeting.startTime).toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className="text-[17px] font-bold leading-tight mt-0.5">
                    {new Date(meeting.startTime).getDate()}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isToday && (
                      <span className="text-[9px] font-bold text-white bg-[#1A8CA3] px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                        Today
                      </span>
                    )}
                    <h3 className="text-[14px] font-medium text-[#1F2937] truncate group-hover:text-[#1A8CA3] transition-colors">
                      {meeting.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2.5 mt-1 text-[12px] text-[#9CA3AF]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(meeting.startTime)} — {formatTime(meeting.endTime)}
                    </span>
                    <span className="w-px h-3 bg-[#E5E7EB]" />
                    <span className="flex items-center gap-1">
                      {getLocationIcon(meeting.locationType)}
                      <span className="truncate max-w-[100px]">
                        {getLocationLabel(meeting.locationType, meeting.locationDetails)}
                      </span>
                    </span>
                  </div>
                  {meeting.project && (
                    <p className="text-[11px] text-[#D1D5DB] mt-0.5 truncate">
                      {meeting.project.name} · {meeting.attendeeCount} attendee{meeting.attendeeCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Join button — teal with strong shadow */}
                {meeting.meetingLink && isToday ? (
                  <a
                    href={meeting.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#1A8CA3] hover:bg-[#136F82] text-white text-[12px] font-semibold rounded-xl transition-all shadow-[0_4px_14px_rgba(26,140,163,0.35)] hover:shadow-[0_6px_20px_rgba(26,140,163,0.45)]"
                  >
                    <Video className="w-4 h-4" />
                    Join
                  </a>
                ) : (
                  <ArrowUpRight className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#1A8CA3] transition-colors flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

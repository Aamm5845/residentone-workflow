'use client'

import useSWR from 'swr'
import Image from 'next/image'
import { Clock, CheckCircle, ArrowUpRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SkeletonBar } from './SkeletonLoader'
import { formatRelativeDate, fetcher } from './types'
import type { PendingApprovalDto } from './types'

interface PendingApprovalsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function PendingApprovalsModal({
  isOpen,
  onClose,
}: PendingApprovalsModalProps) {
  const { data: approvalsData, error: approvalsError } = useSWR<{
    data: PendingApprovalDto[]
  }>(isOpen ? '/api/dashboard/pending-approvals' : null, fetcher)

  const handleApprovalClick = (stageId: string) => {
    window.location.href = `/stages/${stageId}`
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-white rounded-2xl border-0 p-0 gap-0 overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.15),0_10px_20px_rgba(0,0,0,0.1)]">
        {/* Header with solid teal bar */}
        <div className="relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A8CA3]" />
          <DialogHeader className="px-6 pt-7 pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1A8CA3] flex items-center justify-center shadow-[0_2px_8px_rgba(26,140,163,0.35)]">
                <Clock className="w-5 h-5 text-white" strokeWidth={1.8} />
              </div>
              <DialogTitle className="text-[18px] font-semibold text-[#1F2937]">
                Pending Approvals
              </DialogTitle>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5">
          {approvalsError ? (
            <div className="text-center py-10">
              <p className="text-[14px] text-[#6B7280]">Error loading approvals</p>
            </div>
          ) : !approvalsData ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-[#F8F9FA]">
                  <SkeletonBar className="w-10 h-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <SkeletonBar className="w-3/4 h-4" />
                    <SkeletonBar className="w-1/2 h-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : approvalsData.data.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-[#1A8CA3]/8 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-[#1A8CA3]/40" />
              </div>
              <p className="text-[15px] font-semibold text-[#1F2937]">All clear</p>
              <p className="text-[12px] text-[#9CA3AF] mt-1">All renderings have been approved</p>
            </div>
          ) : (
            <div className="space-y-2">
              {approvalsData.data.map((approval) => (
                <div
                  key={approval.id}
                  className="group flex items-center gap-4 p-4 rounded-xl bg-[#F8F9FA] hover:bg-[#1A8CA3]/[0.04] transition-all duration-200 cursor-pointer"
                  onClick={() => handleApprovalClick(approval.stageId)}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#1A8CA3] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 overflow-hidden ring-3 ring-[#1A8CA3]/15 shadow-[0_2px_6px_rgba(26,140,163,0.25)]">
                    {approval.createdBy.image ? (
                      <Image
                        src={approval.createdBy.image}
                        alt={approval.createdBy.name}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <span>{approval.createdBy.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-[14px] font-semibold text-[#1F2937] group-hover:text-[#1A8CA3] transition-colors">
                        {approval.version}
                      </h3>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 bg-[#1A8CA3] text-white rounded-full uppercase tracking-wider shadow-sm">
                        Pending
                      </span>
                    </div>
                    <p className="text-[12px] text-[#9CA3AF] truncate">
                      {approval.projectName} · {approval.roomName || approval.roomType}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[11px] text-[#9CA3AF] font-medium">{approval.createdBy.name}</p>
                      <span className="w-px h-2 bg-[#E5E7EB]" />
                      <p className="text-[11px] text-[#9CA3AF]">{formatRelativeDate(approval.createdAt)}</p>
                      <span className="w-px h-2 bg-[#E5E7EB]" />
                      <p className="text-[11px] text-[#9CA3AF]">
                        {approval.assetCount} image{approval.assetCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Arrow */}
                  <ArrowUpRight className="w-5 h-5 text-[#D1D5DB] group-hover:text-[#1A8CA3] transition-colors flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {approvalsData && approvalsData.data.length > 0 && (
          <div className="px-6 py-3.5 border-t border-[#E5E7EB] bg-[#FAFBFC]">
            <p className="text-[11px] text-[#9CA3AF] text-center font-medium">
              Click to review renderings
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

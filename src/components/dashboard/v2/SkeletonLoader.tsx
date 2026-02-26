// Dashboard V2 — Skeleton Loader Primitives

import { cn } from '@/lib/utils'

export function SkeletonBar({ className }: { className?: string }) {
  return (
    <div className={cn('bg-[#F3F4F6] rounded animate-pulse', className)} />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl px-6 py-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#E5E7EB]/80">
      <SkeletonBar className="w-24 h-2.5 mb-3.5" />
      <SkeletonBar className="w-14 h-9 rounded-lg" />
    </div>
  )
}

export function MeetingRowSkeleton() {
  return (
    <div className="flex items-center gap-3.5 px-6 py-3.5">
      <SkeletonBar className="w-12 h-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBar className="w-3/4 h-3.5" />
        <SkeletonBar className="w-1/2 h-3" />
      </div>
    </div>
  )
}

export function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-3.5 px-6 py-3">
      <SkeletonBar className="w-2.5 h-2.5 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBar className="w-2/3 h-3.5" />
        <SkeletonBar className="w-1/3 h-3" />
      </div>
    </div>
  )
}

export function StageRowSkeleton() {
  return (
    <div className="flex items-center gap-3 pl-7 pr-6 py-3">
      <SkeletonBar className="w-1/3 h-3.5" />
      <SkeletonBar className="w-1/5 h-3" />
      <div className="flex-1" />
      <SkeletonBar className="w-16 h-3" />
    </div>
  )
}

export function BottomCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#E5E7EB]/80">
      <SkeletonBar className="w-28 h-2.5 mb-4" />
      <SkeletonBar className="w-40 h-5 mb-2" />
      <SkeletonBar className="w-32 h-3 mb-5" />
      <div className="flex items-center gap-3">
        <SkeletonBar className="w-8 h-8 rounded-full flex-shrink-0" />
        <div className="space-y-1.5 flex-1">
          <SkeletonBar className="w-28 h-3" />
          <SkeletonBar className="w-16 h-2.5" />
        </div>
      </div>
    </div>
  )
}

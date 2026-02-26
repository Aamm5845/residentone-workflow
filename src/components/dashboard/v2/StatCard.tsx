'use client'

import Link from 'next/link'

interface StatCardProps {
  label: string
  value: string
  isLoading: boolean
  href?: string
  onClick?: () => void
  showDot?: boolean
}

export default function StatCard({
  label,
  value,
  isLoading,
  href,
  onClick,
  showDot,
}: StatCardProps) {
  const inner = (
    <div className="relative overflow-hidden">
      {/* Teal accent line at bottom — reveals on hover */}
      <div className="absolute bottom-0 left-6 right-6 h-[2px] bg-gradient-to-r from-[#1A8CA3]/30 via-[#1A8CA3] to-[#1A8CA3]/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="px-6 py-5">
        <p className="text-[11px] uppercase tracking-[0.14em] font-medium text-[#9CA3AF] mb-2.5">
          {label}
        </p>
        <div className="flex items-baseline gap-2.5">
          {isLoading ? (
            <div className="h-9 w-14 bg-[#F3F4F6] rounded animate-pulse" />
          ) : (
            <p className="text-[36px] font-semibold text-[#1A8CA3] leading-none tracking-[-0.02em]">
              {value}
            </p>
          )}
          {showDot && !isLoading && (
            <span className="relative flex h-2 w-2 self-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1A8CA3] opacity-40" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1A8CA3]" />
            </span>
          )}
        </div>
      </div>
    </div>
  )

  const classes = [
    'group relative bg-white rounded-2xl overflow-hidden',
    'border border-[#E5E7EB]/80',
    'shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
    'hover:shadow-[0_8px_25px_rgba(26,140,163,0.08)]',
    'hover:border-[#1A8CA3]/20',
    'transition-all duration-300 ease-out cursor-pointer',
  ].join(' ')

  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    )
  }

  return (
    <div className={classes} onClick={onClick}>
      {inner}
    </div>
  )
}

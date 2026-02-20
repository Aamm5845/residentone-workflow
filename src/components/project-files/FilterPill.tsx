'use client'

import { useState } from 'react'
import { ChevronDown, X, Plus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FilterOption {
  value: string
  label: string
  dot?: string      // Tailwind bg class for color dot
  count?: number
}

interface FilterPillProps {
  label: string
  value: string | null
  options: FilterOption[]
  onChange: (value: string | null) => void
  onAdd?: () => void
  addLabel?: string
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function FilterPill({
  label,
  value,
  options,
  onChange,
  onAdd,
  addLabel,
}: FilterPillProps) {
  const [open, setOpen] = useState(false)
  const selectedOption = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {value && selectedOption ? (
          /* Active state — filled badge */
          <button
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md
              text-xs font-medium text-gray-900 bg-gray-100 border border-gray-200
              hover:bg-gray-200/70 transition-all"
          >
            {selectedOption.dot && (
              <span className={cn('w-2 h-2 rounded-full shrink-0', selectedOption.dot)} />
            )}
            <span>{selectedOption.label}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
              className="ml-0.5 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          </button>
        ) : (
          /* Inactive state — ghost button */
          <button
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md
              text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100
              border border-transparent hover:border-gray-200 transition-all"
          >
            <span>{label}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent className="w-52 p-1.5" align="start" sideOffset={6}>
        <div className="space-y-0.5">
          {/* All option */}
          <button
            onClick={() => { onChange(null); setOpen(false) }}
            className={cn(
              'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors',
              !value
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <span>All</span>
          </button>

          {/* Options */}
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => { onChange(option.value); setOpen(false) }}
              className={cn(
                'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors',
                value === option.value
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <span className="flex items-center gap-2">
                {option.dot && (
                  <span className={cn('w-2 h-2 rounded-full shrink-0', option.dot)} />
                )}
                <span>{option.label}</span>
              </span>
              {option.count !== undefined && (
                <span className="text-[10px] text-gray-400 tabular-nums">{option.count}</span>
              )}
            </button>
          ))}

          {/* Add action */}
          {onAdd && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => { onAdd(); setOpen(false) }}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-md
                  text-xs text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>{addLabel || `Add ${label}`}</span>
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

'use client'

import { GripVertical, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface WidgetShellProps {
  title: string
  icon: LucideIcon
  isEditMode: boolean
  onRemove?: () => void
  children: React.ReactNode
}

export default function WidgetShell({
  title,
  icon: Icon,
  isEditMode,
  onRemove,
  children,
}: WidgetShellProps) {
  return (
    <div className="h-full bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] border border-gray-200 overflow-hidden flex flex-col group/widget transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
        {isEditMode && (
          <div className="widget-drag-handle cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded hover:bg-gray-100 transition-colors">
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
        )}
        <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <h3 className="text-[13px] font-semibold text-gray-700 truncate flex-1">{title}</h3>
        {isEditMode && onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {children}
      </div>
    </div>
  )
}

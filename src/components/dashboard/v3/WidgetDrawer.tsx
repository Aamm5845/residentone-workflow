'use client'

import { X, Plus } from 'lucide-react'
import { WIDGET_REGISTRY, type WidgetDefinition } from './widget-registry'

interface WidgetDrawerProps {
  enabledWidgets: string[]
  onAdd: (widgetId: string) => void
  onClose: () => void
}

export default function WidgetDrawer({ enabledWidgets, onAdd, onClose }: WidgetDrawerProps) {
  const availableWidgets = Object.values(WIDGET_REGISTRY).filter(
    (w) => !enabledWidgets.includes(w.id)
  )

  return (
    <div className="fixed top-0 right-0 bottom-0 w-[340px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-900">Add Widgets</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">{availableWidgets.length} available</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Widget list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {availableWidgets.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400">All widgets are on your dashboard</p>
          </div>
        ) : (
          availableWidgets.map((widget) => (
            <WidgetOption key={widget.id} widget={widget} onAdd={onAdd} />
          ))
        )}
      </div>
    </div>
  )
}

function WidgetOption({
  widget,
  onAdd,
}: {
  widget: WidgetDefinition
  onAdd: (id: string) => void
}) {
  const Icon = widget.icon

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all group">
      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-[#a657f0]/10 transition-colors">
        <Icon className="w-4.5 h-4.5 text-gray-400 group-hover:text-[#a657f0] transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-900 truncate">{widget.title}</p>
        <p className="text-[11px] text-gray-400 truncate">{widget.description}</p>
      </div>
      <button
        onClick={() => onAdd(widget.id)}
        className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#a657f0] text-white flex items-center justify-center hover:bg-[#9347e0] transition-colors shadow-sm"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

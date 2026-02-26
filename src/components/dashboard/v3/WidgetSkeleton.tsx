'use client'

export default function WidgetSkeleton() {
  return (
    <div className="h-full w-full animate-pulse">
      <div className="h-4 w-1/3 bg-gray-200 rounded mb-4" />
      <div className="space-y-3">
        <div className="h-3 w-full bg-gray-100 rounded" />
        <div className="h-3 w-5/6 bg-gray-100 rounded" />
        <div className="h-3 w-4/6 bg-gray-100 rounded" />
      </div>
    </div>
  )
}

export function WidgetError({ message }: { message?: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-gray-400">
      <p className="text-sm">{message || 'Failed to load'}</p>
    </div>
  )
}

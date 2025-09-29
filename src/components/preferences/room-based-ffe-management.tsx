'use client'

export default function RoomBasedFFEManagement({ orgId, user }: { orgId: string; user: { id: string; name: string; role: string } }) {
  return (
    <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
      <div className="max-w-md mx-auto">
        <div className="mb-4">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Component Deprecated</h3>
          <p className="text-gray-600 mb-4">
            This legacy FFE Management component has been replaced with a new redesigned system.
          </p>
          <p className="text-sm text-gray-500">
            Please use the <strong>FFE Management</strong> tab in Preferences to access the new system with enhanced features.
          </p>
        </div>
      </div>
    </div>
  )
}
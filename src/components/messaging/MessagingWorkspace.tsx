'use client'

import { MessageSquare } from 'lucide-react'

export default function MessagingWorkspace() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8 text-indigo-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Messaging</h2>
        <p className="text-gray-600 max-w-md">
          The messaging workspace is coming soon. Check the Messages page in the navigation for team communications.
        </p>
      </div>
    </div>
  )
}


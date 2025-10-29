'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Package } from 'lucide-react'

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading FFE Workspace' }: LoadingStateProps) {
  return (
    <Card className="w-full">
      <CardContent className="p-12 text-center">
        <div className="flex flex-col items-center">
          <div className="relative mb-6">
            <Package className="h-16 w-16 text-gray-300" />
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin absolute -bottom-1 -right-1" />
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {message}
          </h3>
          
          <p className="text-gray-600 mb-4">
            Setting up your furniture, fixtures, and equipment workspace...
          </p>
          
          <div className="flex space-x-1">
            <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

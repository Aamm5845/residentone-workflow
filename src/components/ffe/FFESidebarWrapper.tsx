'use client'

import React, { useState } from 'react'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FFESidebarWrapperProps {
  children: React.ReactNode
}

export default function FFESidebarWrapper({ children }: FFESidebarWrapperProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* Toggle button — always visible on the edge */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          'flex-shrink-0 flex items-center justify-center w-6 border-l border-gray-200/60 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group',
          collapsed && 'border-r border-gray-200/60'
        )}
        title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
      >
        {collapsed ? (
          <PanelRightOpen className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
        ) : (
          <PanelRightClose className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
        )}
      </button>

      {/* Sidebar content — slides in/out */}
      <div
        className={cn(
          'border-l border-gray-200/60 bg-white flex flex-col transition-all duration-200 overflow-hidden',
          collapsed ? 'w-0 border-l-0' : 'w-96'
        )}
      >
        <div className="w-96 h-full flex flex-col flex-shrink-0">
          {children}
        </div>
      </div>
    </>
  )
}

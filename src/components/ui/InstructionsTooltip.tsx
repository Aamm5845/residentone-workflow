'use client'

import React, { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'

interface InstructionsTooltipProps {
  title?: string
  children: React.ReactNode
  className?: string
  iconSize?: 'sm' | 'md' | 'lg'
  trigger?: 'hover' | 'click' | 'both'
}

export default function InstructionsTooltip({ 
  title = "Instructions",
  children, 
  className = "",
  iconSize = 'md',
  trigger = 'both'
}: InstructionsTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5', 
    lg: 'w-6 h-6'
  }

  const handleMouseEnter = () => {
    if (trigger === 'hover' || trigger === 'both') {
      setIsOpen(true)
    }
  }

  const handleMouseLeave = () => {
    if (trigger === 'hover' || trigger === 'both') {
      setIsOpen(false)
    }
  }

  const handleClick = () => {
    if (trigger === 'click' || trigger === 'both') {
      setIsOpen(!isOpen)
    }
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(false)
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Help Icon */}
      <button
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="inline-flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-full"
        aria-label={title}
      >
        <HelpCircle className={iconSizes[iconSize]} />
      </button>

      {/* Tooltip Popup */}
      {isOpen && (
        <>
          {/* Backdrop for click-away */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Tooltip Content */}
          <div className="absolute z-50 w-80 max-w-sm p-4 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg -translate-x-1/2 left-1/2">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">
                {title}
              </h3>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close instructions"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="text-sm text-gray-700">
              {children}
            </div>

            {/* Arrow */}
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
              <div className="w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45"></div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

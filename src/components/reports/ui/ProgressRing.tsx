'use client'

import { motion } from 'framer-motion'

interface Props {
  percentage: number
  size?: number
  strokeWidth?: number
  color?: string
  showLabel?: boolean
  label?: string
}

export function ProgressRing({ 
  percentage, 
  size = 120, 
  strokeWidth = 8, 
  color = '#6366F1',
  showLabel = true,
  label
}: Props) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  const getColorClass = () => {
    if (percentage >= 75) return '#10B981' // green
    if (percentage >= 50) return '#3B82F6' // blue
    if (percentage >= 25) return '#F59E0B' // orange
    return '#EF4444' // red
  }

  const dynamicColor = color === 'auto' ? getColorClass() : color

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={dynamicColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        />
      </svg>
      
      {/* Center label */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span 
            className="text-3xl font-bold text-gray-900"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            {percentage}%
          </motion.span>
          {label && (
            <span className="text-xs text-gray-500 mt-1">{label}</span>
          )}
        </div>
      )}
    </div>
  )
}

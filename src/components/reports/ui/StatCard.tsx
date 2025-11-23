'use client'

import { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'

interface Props {
  title: string
  value: string | number
  icon: LucideIcon
  gradient: string
  iconColor: string
  subtitle?: string
  trend?: {
    value: number
    isPositive: boolean
  }
}

export function StatCard({ title, value, icon: Icon, gradient, iconColor, subtitle, trend }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300"
    >
      {/* Gradient Background */}
      <div className={`absolute inset-0 opacity-5 ${gradient}`} />
      
      <div className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              {trend && (
                <span className={`text-sm font-semibold ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {trend.isPositive ? '+' : ''}{trend.value}%
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          
          <div className={`p-2.5 rounded-lg ${gradient}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>
      
      {/* Bottom accent */}
      <div className={`h-1 ${gradient}`} />
    </motion.div>
  )
}

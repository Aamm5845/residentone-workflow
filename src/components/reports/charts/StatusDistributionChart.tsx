'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface StatusData {
  name: string
  value: number
  color: string
}

interface Props {
  completed: number
  inProgress: number
  pending: number
  notStarted?: number
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]
    return (
      <div className="bg-white p-4 rounded-lg shadow-xl border border-gray-200">
        <p className="font-semibold text-gray-900 mb-1">{data.name}</p>
        <p className="text-2xl font-bold" style={{ color: data.payload.color }}>
          {data.value}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {data.payload.percentage}% of total
        </p>
      </div>
    )
  }
  return null
}

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  if (percent < 0.1) return null // Don't show label if slice is too small

  return (
    <text 
      x={x} 
      y={y} 
      fill="white" 
      textAnchor="middle" 
      dominantBaseline="central"
      className="font-semibold text-sm"
      style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function StatusDistributionChart({ completed, inProgress, pending, notStarted = 0 }: Props) {
  const total = completed + inProgress + pending + notStarted

  const data: StatusData[] = [
    { 
      name: 'Completed', 
      value: completed, 
      color: '#14b8a6', // brand teal
    },
    { 
      name: 'In Progress', 
      value: inProgress, 
      color: '#6366ea', // brand indigo
    },
    { 
      name: 'Pending', 
      value: pending, 
      color: '#f6762e', // brand orange
    },
  ]

  if (notStarted > 0) {
    data.push({
      name: 'Not Started',
      value: notStarted,
      color: '#9ca3af', // lighter gray
    })
  }

  // Add percentage to each data point
  const dataWithPercentage = data.map(item => ({
    ...item,
    percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : '0',
  }))

  return (
    <div className="w-full h-[240px] flex flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <defs>
            {data.map((entry, index) => (
              <linearGradient key={index} id={`gradient-${entry.name}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={entry.color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
              </linearGradient>
            ))}
          </defs>
          <Pie
            data={dataWithPercentage}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={75}
            innerRadius={45}
            fill="#8884d8"
            dataKey="value"
            paddingAngle={2}
            animationBegin={0}
            animationDuration={800}
          >
            {dataWithPercentage.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={`url(#gradient-${entry.name})`} stroke="#fff" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Custom Legend */}
      <div className="flex items-center justify-center gap-4 mt-2">
        {dataWithPercentage.map((entry, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <div 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-gray-600">
              {entry.name} <span className="font-medium text-gray-800">({entry.value})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

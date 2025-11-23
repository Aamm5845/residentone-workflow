'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface CostData {
  room: string
  cost: number
  items: number
}

interface Props {
  data: CostData[]
}

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#14B8A6']

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white p-4 rounded-lg shadow-xl border border-gray-200">
        <p className="font-semibold text-gray-900 mb-2">{data.room}</p>
        <p className="text-2xl font-bold text-indigo-600 mb-1">
          ${data.cost.toLocaleString()}
        </p>
        <p className="text-sm text-gray-600">
          {data.items} {data.items === 1 ? 'item' : 'items'}
        </p>
      </div>
    )
  }
  return null
}

export function CostBreakdownChart({ data }: Props) {
  // Sort by cost descending
  const sortedData = [...data].sort((a, b) => b.cost - a.cost)

  return (
    <div className="w-full h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sortedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
        >
          <defs>
            {COLORS.map((color, index) => (
              <linearGradient key={index} id={`colorGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={1} />
                <stop offset="100%" stopColor={color} stopOpacity={0.6} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis 
            dataKey="room" 
            angle={-45} 
            textAnchor="end" 
            height={80}
            stroke="#6B7280"
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            stroke="#6B7280"
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
          <Bar dataKey="cost" radius={[8, 8, 0, 0]} maxBarSize={60}>
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={`url(#colorGradient${index % COLORS.length})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

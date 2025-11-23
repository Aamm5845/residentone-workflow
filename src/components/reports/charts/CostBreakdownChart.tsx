'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface CostData {
  room: string
  completed: number
  pending: number
  items: number
}

interface Props {
  data: CostData[]
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white p-4 rounded-lg shadow-xl border border-gray-200">
        <p className="font-semibold text-gray-900 mb-3">{data.room}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className="text-sm text-gray-600">Completed</span>
            </div>
            <span className="text-lg font-bold text-green-600">{data.completed}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-orange-500"></div>
              <span className="text-sm text-gray-600">Pending</span>
            </div>
            <span className="text-lg font-bold text-orange-600">{data.pending}</span>
          </div>
          <div className="border-t pt-2 mt-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-gray-700">Total</span>
              <span className="text-xl font-bold text-indigo-600">{data.items}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export function CostBreakdownChart({ data }: Props) {
  // Sort by item count descending
  const sortedData = [...data].sort((a, b) => b.items - a.items)

  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sortedData}
          margin={{ top: 10, right: 30, left: 20, bottom: 80 }}
        >
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
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={(value) => {
              return value === 'completed' ? 'Completed' : 'Pending'
            }}
          />
          <Bar dataKey="completed" stackId="items" fill="#10B981" radius={[0, 0, 0, 0]} maxBarSize={60} />
          <Bar dataKey="pending" stackId="items" fill="#F59E0B" radius={[8, 8, 0, 0]} maxBarSize={60} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

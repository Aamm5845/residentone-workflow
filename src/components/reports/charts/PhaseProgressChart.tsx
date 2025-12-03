'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

interface PhaseData {
  name: string
  completed: number
  inProgress: number
  pending: number
  total: number
  percentage: number
}

interface Props {
  phases: PhaseData[]
}

const COLORS = {
  completed: '#14b8a6', // brand teal
  inProgress: '#6366ea', // brand indigo
  pending: '#f6762e', // brand orange
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload
    return (
      <div className="bg-white p-4 rounded-lg shadow-xl border border-gray-200">
        <p className="font-semibold text-gray-900 mb-3">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }}></div>
                <span className="text-sm text-gray-600">{entry.name}</span>
              </div>
              <span className="text-sm font-semibold" style={{ color: entry.color }}>
                {entry.value}% ({entry.payload[`${entry.dataKey}Count`]})
              </span>
            </div>
          ))}
        </div>
        <div className="border-t mt-2 pt-2">
          <span className="text-xs text-gray-500">Total: {data?.totalCount || 0} tasks</span>
        </div>
      </div>
    )
  }
  return null
}

export function PhaseProgressChart({ phases }: Props) {
  const data = phases.map(phase => {
    const total = phase.total
    const completedPercent = total > 0 ? Math.round((phase.completed / total) * 100) : 0
    const inProgressPercent = total > 0 ? Math.round((phase.inProgress / total) * 100) : 0
    const pendingPercent = total > 0 ? Math.round((phase.pending / total) * 100) : 0
    
    return {
      name: phase.name,
      Completed: completedPercent,
      'In Progress': inProgressPercent,
      Pending: pendingPercent,
      CompletedCount: phase.completed,
      'In ProgressCount': phase.inProgress,
      PendingCount: phase.pending,
      totalCount: total
    }
  })

  return (
    <div className="w-full h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 20, left: 80, bottom: 10 }}
        >
          <defs>
            <linearGradient id="completedGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="inProgressGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366ea" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#6366ea" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="pendingGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f6762e" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#f6762e" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            type="number" 
            stroke="#6B7280" 
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <YAxis dataKey="name" type="category" stroke="#6B7280" width={70} style={{ fontSize: '12px' }} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
          />
          <Bar dataKey="Completed" stackId="a" fill="url(#completedGradient)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="In Progress" stackId="a" fill="url(#inProgressGradient)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Pending" stackId="a" fill="url(#pendingGradient)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

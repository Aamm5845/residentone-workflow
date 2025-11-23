'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface PhaseDistribution {
  pending: number
  inProgress: number
  completed: number
  notApplicable: number
}

interface Props {
  distribution: PhaseDistribution
}

const COLORS = {
  pending: '#6B7280', // gray
  inProgress: '#3B82F6', // blue
  completed: '#10B981', // green
  notApplicable: '#64748B' // slate
}

const LABELS = {
  pending: 'Pending',
  inProgress: 'In Progress',
  completed: 'Completed',
  notApplicable: 'Not Applicable'
}

export function PhaseDistributionChart({ distribution }: Props) {
  const data = [
    { name: LABELS.pending, value: distribution.pending, color: COLORS.pending },
    { name: LABELS.inProgress, value: distribution.inProgress, color: COLORS.inProgress },
    { name: LABELS.completed, value: distribution.completed, color: COLORS.completed },
    { name: LABELS.notApplicable, value: distribution.notApplicable, color: COLORS.notApplicable }
  ].filter(item => item.value > 0) // Only show segments with data

  const total = distribution.pending + distribution.inProgress + distribution.completed + distribution.notApplicable

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No phase data available
      </div>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      const percentage = ((data.value / total) * 100).toFixed(1)
      return (
        <div className="bg-white px-4 py-2 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-600">
            {data.value} phases ({percentage}%)
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value, entry: any) => {
              const percentage = ((entry.payload.value / total) * 100).toFixed(0)
              return `${value} (${percentage}%)`
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

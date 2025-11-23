'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface PhaseStats {
  completed: number
  inProgress: number
  pending: number
  notApplicable: number
  total: number
  percentage: number
}

interface Props {
  projects: Array<{
    id: string
    name: string
    phases: Record<string, PhaseStats>
  }>
}

const PHASE_COLORS = {
  DESIGN_CONCEPT: '#A855F7', // purple
  RENDERING: '#F97316', // orange
  CLIENT_APPROVAL: '#3B82F6', // blue
  DRAWINGS: '#6366F1', // indigo
  FFE: '#EC4899' // pink
}

const PHASE_LABELS = {
  DESIGN_CONCEPT: 'Design Concept',
  RENDERING: '3D Rendering',
  CLIENT_APPROVAL: 'Client Approval',
  DRAWINGS: 'Drawings',
  FFE: 'FFE'
}

export function ProjectProgressChart({ projects }: Props) {
  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No project data available
      </div>
    )
  }

  // Transform data for the chart - show top 5 projects
  const chartData = projects.slice(0, 5).map(project => {
    const shortName = project.name.length > 20 
      ? project.name.substring(0, 20) + '...' 
      : project.name

    return {
      name: shortName,
      'Design Concept': project.phases.DESIGN_CONCEPT?.percentage || 0,
      '3D Rendering': project.phases.RENDERING?.percentage || 0,
      'Client Approval': project.phases.CLIENT_APPROVAL?.percentage || 0,
      'Drawings': project.phases.DRAWINGS?.percentage || 0,
      'FFE': project.phases.FFE?.percentage || 0
    }
  })

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm">
              <span className="flex items-center gap-2">
                <span 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </span>
              <span className="font-semibold">{entry.value}%</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            label={{ value: 'Completion %', angle: -90, position: 'insideLeft' }}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
          />
          <Bar dataKey="Design Concept" fill={PHASE_COLORS.DESIGN_CONCEPT} radius={[4, 4, 0, 0]} />
          <Bar dataKey="3D Rendering" fill={PHASE_COLORS.RENDERING} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Client Approval" fill={PHASE_COLORS.CLIENT_APPROVAL} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Drawings" fill={PHASE_COLORS.DRAWINGS} radius={[4, 4, 0, 0]} />
          <Bar dataKey="FFE" fill={PHASE_COLORS.FFE} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

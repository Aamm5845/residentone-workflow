'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { 
  Clock, Users, TrendingUp, Calendar, Timer, 
  Activity, BarChart3, Loader2, AlertCircle,
  Zap, Target, ArrowUp, ArrowDown, Minus,
  Palette, FileImage, FileText, Sofa
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ProgressRing } from '@/components/reports/ui/ProgressRing'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface Props {
  projectId: string
}

const PHASE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  DESIGN_CONCEPT: { label: 'Design Concept', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: Palette },
  THREE_D: { label: '3D Rendering', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: FileImage },
  DRAWINGS: { label: 'Drawings', color: 'text-indigo-700', bgColor: 'bg-indigo-100', icon: FileText },
  FFE: { label: 'FFE', color: 'text-pink-700', bgColor: 'bg-pink-100', icon: Sofa },
  OTHER: { label: 'General', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: Clock }
}

function formatDuration(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`
  }
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  gradient,
  trend
}: { 
  title: string
  value: string | number
  subtitle?: string
  icon: any
  gradient: string
  trend?: { value: number; label: string }
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              trend.value > 0 ? 'text-green-600' : trend.value < 0 ? 'text-red-600' : 'text-gray-500'
            }`}>
              {trend.value > 0 ? <ArrowUp className="w-4 h-4" /> : 
               trend.value < 0 ? <ArrowDown className="w-4 h-4" /> : 
               <Minus className="w-4 h-4" />}
              <span>{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${gradient}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  )
}

function TeamMemberCard({ member }: { member: any }) {
  const topPhases = Object.entries(member.phases || {})
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 3)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all duration-200">
      <div className="flex items-start gap-4">
        <Avatar className="w-14 h-14 border-2 border-gray-200">
          <AvatarImage src={member.userImage} alt={member.userName} />
          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-lg">
            {member.userName?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-gray-900 truncate">{member.userName}</h4>
            <span className="text-2xl font-bold text-indigo-600">
              {formatDuration(member.totalHours)}
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-2">{member.userRole}</p>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              {member.entryCount} entries
            </span>
            {member.lastEntry && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Last: {new Date(member.lastEntry).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Phase breakdown */}
      {topPhases.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">Time by Phase</p>
          <div className="flex flex-wrap gap-2">
            {topPhases.map(([phase, minutes]: [string, any]) => {
              const config = PHASE_CONFIG[phase] || PHASE_CONFIG.OTHER
              const hours = Math.round((minutes / 60) * 10) / 10
              return (
                <div 
                  key={phase}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bgColor} ${config.color} text-xs font-medium`}
                >
                  <config.icon className="w-3 h-3" />
                  {config.label}: {hours}h
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function WeeklyChart({ data }: { data: any[] }) {
  const maxHours = Math.max(...data.map(d => d.hours), 1)
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Weekly Activity</h3>
          <p className="text-sm text-gray-500">Hours tracked over the last 12 weeks</p>
        </div>
        <BarChart3 className="w-5 h-5 text-indigo-600" />
      </div>
      
      <div className="flex items-end gap-1.5 h-40">
        {data.map((week, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div 
              className="w-full bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t-sm transition-all duration-300 hover:from-indigo-600 hover:to-purple-600"
              style={{ 
                height: `${Math.max((week.hours / maxHours) * 100, 2)}%`,
                minHeight: week.hours > 0 ? '8px' : '2px'
              }}
              title={`${week.week}: ${week.hours}h`}
            />
            <span className="text-[10px] text-gray-500 rotate-0 whitespace-nowrap">
              {i % 2 === 0 ? week.week : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PhaseBreakdown({ data }: { data: any[] }) {
  const colors = [
    'from-purple-500 to-purple-600',
    'from-orange-500 to-orange-600', 
    'from-indigo-500 to-indigo-600',
    'from-pink-500 to-pink-600',
    'from-gray-500 to-gray-600'
  ]
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Time by Phase</h3>
          <p className="text-sm text-gray-500">Distribution of hours across phases</p>
        </div>
        <Target className="w-5 h-5 text-indigo-600" />
      </div>
      
      <div className="space-y-4">
        {data.map((phase, i) => {
          const config = PHASE_CONFIG[phase.phase] || PHASE_CONFIG.OTHER
          return (
            <div key={phase.phase}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded ${config.bgColor}`}>
                    <config.icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <span className="font-medium text-gray-900">{phase.label}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">{formatDuration(phase.hours)}</span>
                  <span className="text-sm text-gray-500 ml-2">({phase.percentage}%)</span>
                </div>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${colors[i % colors.length]} transition-all duration-500`}
                  style={{ width: `${phase.percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RecentActivityList({ activities }: { activities: any[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          <p className="text-sm text-gray-500">Latest time entries</p>
        </div>
        <Activity className="w-5 h-5 text-indigo-600" />
      </div>
      
      <div className="space-y-3">
        {activities.map(entry => {
          const config = entry.stageType ? (PHASE_CONFIG[entry.stageType] || PHASE_CONFIG.OTHER) : PHASE_CONFIG.OTHER
          return (
            <div key={entry.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <Avatar className="w-8 h-8">
                <AvatarImage src={entry.user.image} alt={entry.user.name} />
                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                  {entry.user.name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">{entry.user.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {entry.description || 'No description'} • {new Date(entry.date).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <span className="font-semibold text-indigo-600">{formatDuration(entry.hours)}</span>
              </div>
            </div>
          )
        })}
        
        {activities.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No time entries yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function TimeInvestmentView({ projectId }: Props) {
  const { data, error, isLoading } = useSWR(
    `/api/reports/${projectId}/time-investment`,
    fetcher,
    { refreshInterval: 60000 }
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error || !data || !data.summary) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600 mb-2">Failed to load time investment data</p>
        <p className="text-sm text-gray-500">Please try refreshing the page</p>
      </div>
    )
  }

  const summary = data.summary || { totalHours: 0, entryCount: 0, avgHoursPerWeek: 0, projectDuration: { days: 0, weeks: 0, months: 0 }, tracking: { activeDays: 0 } }
  const byMember = data.byMember || []
  const byWeek = data.byWeek || []
  const byPhase = data.byPhase || []
  const recentActivity = data.recentActivity || []

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Hours"
          value={formatDuration(summary.totalHours)}
          subtitle={`${summary.entryCount} time entries`}
          icon={Clock}
          gradient="bg-gradient-to-br from-indigo-500 to-purple-600"
        />
        <StatCard
          title="Team Members"
          value={byMember.length}
          subtitle="Contributing to project"
          icon={Users}
          gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
        />
        <StatCard
          title="Avg Hours/Week"
          value={formatDuration(summary.avgHoursPerWeek)}
          subtitle={`Over ${summary.projectDuration.weeks} weeks`}
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-green-500 to-emerald-600"
        />
        <StatCard
          title="Project Age"
          value={`${summary.projectDuration.days}d`}
          subtitle={`${summary.projectDuration.months} months since start`}
          icon={Calendar}
          gradient="bg-gradient-to-br from-orange-500 to-amber-600"
        />
      </div>

      {/* Quick Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-indigo-100 rounded-xl">
              <Timer className="w-5 h-5 text-indigo-600" />
            </div>
            <h4 className="font-semibold text-gray-900">Time Tracked</h4>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-indigo-600">{formatDuration(summary.totalHours)}</p>
              <p className="text-sm text-gray-600 mt-1">{summary.tracking.activeDays} active days</p>
            </div>
            <ProgressRing 
              percentage={Math.min(100, (summary.totalHours / (summary.projectDuration.weeks * 40)) * 100)} 
              size={70} 
              strokeWidth={6}
              color="auto"
              showLabel={false}
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-green-100 rounded-xl">
              <Zap className="w-5 h-5 text-green-600" />
            </div>
            <h4 className="font-semibold text-gray-900">Most Active</h4>
          </div>
          {byMember[0] ? (
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={byMember[0].userImage} />
                <AvatarFallback className="bg-green-600 text-white">
                  {byMember[0].userName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-gray-900">{byMember[0].userName}</p>
                <p className="text-sm text-green-600 font-medium">{formatDuration(byMember[0].totalHours)} logged</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No data yet</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-orange-100 rounded-xl">
              <Target className="w-5 h-5 text-orange-600" />
            </div>
            <h4 className="font-semibold text-gray-900">Top Phase</h4>
          </div>
          {byPhase[0] ? (
            <div>
              <p className="text-2xl font-bold text-orange-600">{byPhase[0].label}</p>
              <p className="text-sm text-gray-600 mt-1">
                {formatDuration(byPhase[0].hours)} ({byPhase[0].percentage}% of total)
              </p>
            </div>
          ) : (
            <p className="text-gray-500">No data yet</p>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeeklyChart data={byWeek} />
        <PhaseBreakdown data={byPhase} />
      </div>

      {/* Team Members */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Team Contributions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {byMember.map((member: any) => (
            <TeamMemberCard key={member.userId} member={member} />
          ))}
          {byMember.length === 0 && (
            <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No team members have logged time yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivityList activities={recentActivity} />
    </div>
  )
}


'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDuration } from '@/contexts/TimerContext'
import {
  BarChart3,
  Download,
  Calendar,
  Users,
  FolderOpen,
  Clock,
  Loader2,
  TrendingUp,
  DollarSign
} from 'lucide-react'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function TimeReports() {
  // Date range (default to current month)
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(lastDay.toISOString().split('T')[0])
  const [userId, setUserId] = useState<string>('')
  const [projectId, setProjectId] = useState<string>('')

  // Build query string
  const queryParams = new URLSearchParams({
    startDate,
    endDate,
    ...(userId && { userId }),
    ...(projectId && { projectId })
  })

  const { data, error, isLoading } = useSWR(
    `/api/timeline/reports?${queryParams.toString()}`,
    fetcher
  )

  // Fetch team members for filter
  const { data: teamData } = useSWR('/api/timeline/team/active', fetcher)
  const teamMembers = teamData?.team?.map((t: any) => t.user) || []

  // Fetch projects for filter
  const { data: projectsData } = useSWR('/api/projects?status=IN_PROGRESS', fetcher)
  const projects = projectsData?.projects || []

  const summary = data?.summary || { totalMinutes: 0, totalHours: 0, totalEntries: 0 }
  const byUser = data?.byUser || []
  const byProject = data?.byProject || []
  const grouped = data?.grouped || []

  const handleExportCSV = () => {
    if (!data?.entries) return

    const headers = ['Date', 'Start Time', 'End Time', 'Duration (min)', 'User', 'Project', 'Room', 'Phase', 'Description']
    const rows = data.entries.map((e: any) => [
      e.startTime.split('T')[0],
      new Date(e.startTime).toLocaleTimeString(),
      e.endTime ? new Date(e.endTime).toLocaleTimeString() : '',
      e.duration || '',
      e.user?.name || '',
      e.project?.name || '',
      e.room?.name || e.room?.type || '',
      e.stage?.type || '',
      e.description || ''
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `time-report-${startDate}-to-${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const setDateRange = (range: 'week' | 'month' | 'quarter') => {
    const now = new Date()
    let start: Date
    let end: Date = now

    switch (range) {
      case 'week':
        start = new Date(now)
        start.setDate(start.getDate() - 7)
        break
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        break
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3)
        start = new Date(now.getFullYear(), quarter * 3, 1)
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0)
        break
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-600" />
            Time Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Team Member</Label>
              <Select value={userId || 'all'} onValueChange={(v) => setUserId(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {teamMembers.map((member: any) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId || 'all'} onValueChange={(v) => setProjectId(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((project: any) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quick Select</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setDateRange('week')}>
                  Week
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDateRange('month')}>
                  Month
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDateRange('quarter')}>
                  Quarter
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <Clock className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Hours</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {summary.totalHours.toFixed(1)}h
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Entries</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {summary.totalEntries}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Avg Daily</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {grouped.length > 0
                        ? (summary.totalMinutes / grouped.length / 60).toFixed(1)
                        : '0'}h
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Billing Breakdown + Export */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Billed Hours</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {(summary.billedHours || 0).toFixed(1)}h
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Unbilled Hours</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {(summary.unbilledHours || 0).toFixed(1)}h
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Download className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Export</p>
                    <p className="text-sm font-medium text-gray-700">Download CSV</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={!data?.entries?.length}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* By User */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-600" />
                  By Team Member
                </CardTitle>
              </CardHeader>
              <CardContent>
                {byUser.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No data</p>
                ) : (
                  <div className="space-y-3">
                    {byUser.map((user: any) => {
                      const percentage = summary.totalMinutes > 0 
                        ? (user.totalMinutes / summary.totalMinutes) * 100 
                        : 0

                      return (
                        <div key={user.userId} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {user.userImage ? (
                                <img 
                                  src={user.userImage} 
                                  alt={user.userName}
                                  className="w-6 h-6 rounded-full"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center">
                                  <span className="text-white text-xs">
                                    {user.userName?.charAt(0) || '?'}
                                  </span>
                                </div>
                              )}
                              <span className="font-medium">{user.userName}</span>
                            </div>
                            <span className="text-gray-600">
                              {formatDuration(user.totalMinutes)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-cyan-500 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* By Project */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-cyan-600" />
                  By Project
                </CardTitle>
              </CardHeader>
              <CardContent>
                {byProject.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No data</p>
                ) : (
                  <div className="space-y-3">
                    {byProject.map((project: any) => {
                      const percentage = summary.totalMinutes > 0 
                        ? (project.totalMinutes / summary.totalMinutes) * 100 
                        : 0

                      return (
                        <div key={project.projectId || 'no-project'} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                              {project.projectName}
                            </span>
                            <span className="text-gray-600">
                              {formatDuration(project.totalMinutes)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Daily Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-600" />
                Daily Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {grouped.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No data for this period</p>
              ) : (
                <div className="space-y-2">
                  {grouped.map((day: any) => {
                    const hours = day.totalMinutes / 60
                    const maxHours = 10 // For bar scaling
                    const barWidth = Math.min((hours / maxHours) * 100, 100)

                    return (
                      <div key={day.date} className="flex items-center gap-4">
                        <div className="w-24 text-sm text-gray-600">
                          {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="flex-1">
                          <div className="w-full bg-gray-200 rounded-full h-4">
                            <div 
                              className={cn(
                                "h-4 rounded-full transition-all",
                                hours >= 8 ? "bg-green-500" : hours >= 4 ? "bg-cyan-500" : "bg-yellow-500"
                              )}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-16 text-sm font-medium text-right">
                          {formatDuration(day.totalMinutes)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

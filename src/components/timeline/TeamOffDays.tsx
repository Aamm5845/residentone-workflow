'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Palmtree,
  Thermometer,
  User,
  Building,
  HelpCircle,
  CalendarOff,
  Download,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then(res => res.json())

const OFF_DAY_REASONS = [
  { value: 'VACATION', label: 'Vacation', icon: Palmtree, color: 'bg-green-100 text-green-700' },
  { value: 'SICK', label: 'Sick Day', icon: Thermometer, color: 'bg-red-100 text-red-700' },
  { value: 'PERSONAL', label: 'Personal', icon: User, color: 'bg-blue-100 text-blue-700' },
  { value: 'HOLIDAY', label: 'Holiday', icon: Building, color: 'bg-purple-100 text-purple-700' },
  { value: 'OTHER', label: 'Other', icon: HelpCircle, color: 'bg-gray-100 text-gray-700' }
]

export function TeamOffDays() {
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [filterReason, setFilterReason] = useState<string>('all')
  const [filterUser, setFilterUser] = useState<string>('all')

  // Get date range for selected month
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
  const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)

  const startDate = monthStart.toISOString().split('T')[0]
  const endDate = monthEnd.toISOString().split('T')[0]

  const { data, error, isLoading } = useSWR(
    `/api/timeline/off-days/team?startDate=${startDate}&endDate=${endDate}`,
    fetcher
  )

  const offDays = data?.offDays || []
  const summary = data?.summary || []

  // Get unique users for filter
  const uniqueUsers = [...new Map(offDays.map((od: any) => [od.userId, { id: od.userId, name: od.userName }])).values()]

  // Apply filters
  const filteredOffDays = offDays.filter((od: any) => {
    if (filterReason !== 'all' && od.reason !== filterReason) return false
    if (filterUser !== 'all' && od.userId !== filterUser) return false
    return true
  })

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth)
    newMonth.setMonth(newMonth.getMonth() + (direction === 'prev' ? -1 : 1))
    setSelectedMonth(newMonth)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(date)
  }

  const formatMonthYear = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric'
    }).format(date)
  }

  const getReasonConfig = (reason: string) => {
    return OFF_DAY_REASONS.find(r => r.value === reason) || OFF_DAY_REASONS[4]
  }

  const handleExportCSV = () => {
    const headers = ['Date', 'Team Member', 'Email', 'Role', 'Reason', 'Notes']
    const rows = filteredOffDays.map((od: any) => [
      od.date,
      od.userName,
      od.userEmail,
      od.userRole,
      getReasonConfig(od.reason).label,
      od.notes || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row: string[]) => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `team-off-days-${startDate}-to-${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-500">
          Failed to load team off days. Please try again.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Team Off Days</h2>
          <p className="text-sm text-gray-500">
            View all team members' scheduled time off
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-1" />
          Export CSV
        </Button>
      </div>

      {/* Month Navigation */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-lg">{formatMonthYear(selectedMonth)}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigateMonth('next')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {summary.map((user: any) => (
            <Card key={user.userId} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                    {user.userName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="truncate">
                    <p className="font-medium text-sm truncate">{user.userName}</p>
                    <p className="text-xs text-gray-500">{user.totalDays} day{user.totalDays !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(user.byReason).map(([reason, count]) => {
                    const config = getReasonConfig(reason)
                    return (
                      <span
                        key={reason}
                        className={cn('text-xs px-1.5 py-0.5 rounded', config.color)}
                      >
                        {count}
                      </span>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="w-48">
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger>
              <SelectValue placeholder="All team members" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All team members</SelectItem>
              {uniqueUsers.map((user: any) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name || 'Unknown'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={filterReason} onValueChange={setFilterReason}>
            <SelectTrigger>
              <SelectValue placeholder="All reasons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reasons</SelectItem>
              {OFF_DAY_REASONS.map(r => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filteredOffDays.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CalendarOff className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No off days recorded for this period</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOffDays.map((od: any) => {
                  const reasonConfig = getReasonConfig(od.reason)
                  const Icon = reasonConfig.icon

                  return (
                    <TableRow key={od.id}>
                      <TableCell className="font-medium">
                        {formatDate(od.date)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{od.userName}</p>
                          <p className="text-xs text-gray-500">{od.userEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                          {od.userRole}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-1 rounded', reasonConfig.color)}>
                          <Icon className="w-3 h-3" />
                          {reasonConfig.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {od.notes || '-'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Totals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {OFF_DAY_REASONS.map(r => {
              const count = offDays.filter((od: any) => od.reason === r.value).length
              const Icon = r.icon
              return (
                <div key={r.value} className="text-center p-3 rounded-lg bg-gray-50">
                  <Icon className="w-5 h-5 mx-auto mb-1 text-gray-500" />
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500">{r.label}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-4 border-t flex items-center justify-center gap-2 text-gray-600">
            <Users className="w-4 h-4" />
            <span className="text-lg font-semibold">{offDays.length}</span>
            <span className="text-sm">total off days this month</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

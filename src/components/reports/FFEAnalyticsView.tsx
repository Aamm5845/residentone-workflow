'use client'

import { useState, useMemo } from 'react'
import { DollarSign, Package, TrendingUp, ChevronDown, ChevronUp, Download, BarChart3, DoorOpen, Navigation, Baby, UserCheck, Gamepad2, Bed, Bath, Settings, Home } from 'lucide-react'
import { CostBreakdownChart } from '@/components/reports/charts/CostBreakdownChart'
import { motion } from 'framer-motion'

interface FFEItem {
  id: string
  name: string
  status: string
  vendor?: string | null
  cost?: number
  notes?: string | null
}

interface TaskDetail {
  id: string
  roomId: string
  roomName: string
  roomType: string
  ffeItems?: FFEItem[]
}

const ROOM_ICONS: Record<string, any> = {
  ENTRANCE: DoorOpen,
  FOYER: Home,
  STAIRCASE: Navigation,
  LIVING_ROOM: Home,
  DINING_ROOM: Home,
  KITCHEN: Home,
  STUDY_ROOM: Settings,
  OFFICE: Settings,
  PLAYROOM: Gamepad2,
  MASTER_BEDROOM: Bed,
  GIRLS_ROOM: Bed,
  BOYS_ROOM: Bed,
  GUEST_BEDROOM: Bed,
  POWDER_ROOM: Bath,
  MASTER_BATHROOM: Bath,
  FAMILY_BATHROOM: Bath,
  GIRLS_BATHROOM: Bath,
  BOYS_BATHROOM: Bath,
  GUEST_BATHROOM: Bath,
  LAUNDRY_ROOM: Settings,
  SUKKAH: Home,
}

const getRoomIcon = (roomType: string) => {
  return ROOM_ICONS[roomType] || Home
}

interface PhaseStats {
  tasks: TaskDetail[]
}

interface Props {
  phases: Record<string, PhaseStats>
}

type SortField = 'name' | 'room' | 'status' | 'vendor' | 'cost'
type SortDirection = 'asc' | 'desc'

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800',
  DELIVERED: 'bg-green-100 text-green-800',
  ORDERED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-orange-100 text-orange-800',
  NOT_STARTED: 'bg-gray-100 text-gray-800'
}

export function FFEAnalyticsView({ phases }: Props) {
  const [sortField, setSortField] = useState<SortField>('room')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Extract all FFE items with room context
  const allFFEItems = useMemo(() => {
    const items: Array<FFEItem & { roomName: string; roomId: string }> = []
    
    if (phases.FFE && phases.FFE.tasks) {
      phases.FFE.tasks.forEach(task => {
        if (task.ffeItems && task.ffeItems.length > 0) {
          task.ffeItems.forEach(item => {
            items.push({
              ...item,
              roomName: task.roomName,
              roomId: task.roomId
            })
          })
        }
      })
    }
    
    return items
  }, [phases])

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = allFFEItems
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter)
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'room':
          comparison = a.roomName.localeCompare(b.roomName)
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
        case 'vendor':
          comparison = (a.vendor || '').localeCompare(b.vendor || '')
          break
        case 'cost':
          comparison = (a.cost || 0) - (b.cost || 0)
          break
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })
    
    return sorted
  }, [allFFEItems, sortField, sortDirection, statusFilter])

  // Calculate summary stats and cost breakdown by room
  const stats = useMemo(() => {
    const totalItems = allFFEItems.length
    const completedItems = allFFEItems.filter(i => 
      i.status === 'COMPLETED' || i.status === 'ORDERED' || i.status === 'DELIVERED'
    ).length
    const pendingItems = allFFEItems.filter(i => i.status === 'PENDING').length
    const totalCost = allFFEItems.reduce((sum, item) => sum + (item.cost || 0), 0)
    
    // Group by room for item breakdown (completed vs pending)
    const itemsByRoom = allFFEItems.reduce((acc, item) => {
      if (!acc[item.roomName]) {
        acc[item.roomName] = { completed: 0, pending: 0, total: 0 }
      }
      
      const isCompleted = item.status === 'COMPLETED' || item.status === 'ORDERED' || item.status === 'DELIVERED'
      
      if (isCompleted) {
        acc[item.roomName].completed += 1
      } else {
        acc[item.roomName].pending += 1
      }
      acc[item.roomName].total += 1
      
      return acc
    }, {} as Record<string, { completed: number; pending: number; total: number }>)
    
    const costBreakdownData = Object.entries(itemsByRoom).map(([room, data]) => ({
      room,
      completed: data.completed,
      pending: data.pending,
      items: data.total
    }))
    
    return {
      totalItems,
      completedItems,
      pendingItems,
      totalCost,
      completionRate: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      costBreakdownData
    }
  }, [allFFEItems])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    )
  }

  if (allFFEItems.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-lg text-gray-600 font-medium">No FFE items found for this project</p>
        <p className="text-sm text-gray-500 mt-2">FFE items will appear here once they are added to rooms</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 opacity-5" />
          <div className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Total Items</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
              </div>
              <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-br from-indigo-500 to-purple-600" />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="relative overflow-hidden bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 opacity-5" />
          <div className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Completion Rate</p>
                <p className="text-2xl font-bold text-green-600">{stats.completionRate}%</p>
              </div>
              <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-br from-green-500 to-emerald-600" />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="relative overflow-hidden bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-amber-600 opacity-5" />
          <div className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Pending Items</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pendingItems}</p>
              </div>
              <div className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-br from-orange-500 to-amber-600" />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="relative overflow-hidden bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-600 opacity-5" />
          <div className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Total Budget</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${stats.totalCost.toLocaleString()}
                </p>
              </div>
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <div className="h-1 bg-gradient-to-br from-blue-500 to-cyan-600" />
        </motion.div>
      </div>

      {/* Items per Room Chart */}
      {stats.costBreakdownData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Items per Room</h3>
            <BarChart3 className="w-5 h-5 text-indigo-600" />
          </div>
          <CostBreakdownChart data={stats.costBreakdownData} />
        </div>
      )}

      {/* Filters and Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-indigo-600" />
            <h3 className="text-xl font-bold text-gray-900">FFE Items Directory</h3>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 text-sm font-medium border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="all">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="DELIVERED">Delivered</option>
              <option value="ORDERED">Ordered</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PENDING">Pending</option>
              <option value="NOT_STARTED">Not Started</option>
            </select>
            <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all font-medium shadow-md">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-50 border-b-2 border-gray-200 sticky top-0 z-10">
              <tr>
                <th
                  onClick={() => handleSort('name')}
                  className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    Item Name
                    <SortIcon field="name" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('room')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Room
                    <SortIcon field="room" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Status
                    <SortIcon field="status" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('vendor')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Vendor
                    <SortIcon field="vendor" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('cost')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Cost
                    <SortIcon field="cost" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredAndSortedItems.map((item, index) => (
                <tr key={`${item.id}-${index}`} className="hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-200">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {item.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {item.roomName}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1.5 text-xs font-semibold rounded-full ${STATUS_COLORS[item.status] || STATUS_COLORS.NOT_STARTED} shadow-sm`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {item.vendor || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">
                    {item.cost ? `$${item.cost.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                    {item.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAndSortedItems.length === 0 && (
          <div className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-600">No items match the selected filter</p>
            <p className="text-sm text-gray-500 mt-2">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  )
}

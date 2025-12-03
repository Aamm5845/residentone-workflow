'use client'

import { useState, useMemo } from 'react'
import { Package, TrendingUp, ChevronDown, ChevronUp, Download, BarChart3, AlertTriangle, CheckCircle, Plus, Home } from 'lucide-react'
import { CostBreakdownChart } from '@/components/reports/charts/CostBreakdownChart'

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

interface PhaseStats {
  tasks: TaskDetail[]
}

interface Props {
  phases: Record<string, PhaseStats>
}

type SortField = 'name' | 'room' | 'status'
type SortDirection = 'asc' | 'desc'

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-[#14b8a6]/10 text-[#14b8a6]',
  DELIVERED: 'bg-[#14b8a6]/10 text-[#14b8a6]',
  ORDERED: 'bg-[#6366ea]/10 text-[#6366ea]',
  PENDING: 'bg-[#f6762e]/10 text-[#f6762e]',
  UNDECIDED: 'bg-amber-100 text-amber-700',
  NOT_STARTED: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-[#6366ea]/10 text-[#6366ea]'
}

export function FFEAnalyticsView({ phases }: Props) {
  const [sortField, setSortField] = useState<SortField>('room')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showAllItems, setShowAllItems] = useState(false)
  const ITEMS_LIMIT = 10

  // Get all FFE tasks (rooms) to track empty vs populated
  const ffeRoomData = useMemo(() => {
    if (!phases.FFE || !phases.FFE.tasks) {
      return { rooms: [], totalRooms: 0, roomsWithItems: 0, emptyRooms: 0 }
    }

    const rooms = phases.FFE.tasks.map(task => ({
      roomId: task.roomId,
      roomName: task.roomName,
      roomType: task.roomType,
      itemCount: task.ffeItems?.length || 0,
      completedCount: task.ffeItems?.filter(i => 
        i.status === 'COMPLETED' || i.status === 'ORDERED' || i.status === 'DELIVERED'
      ).length || 0,
      items: task.ffeItems || []
    }))

    const totalRooms = rooms.length
    const roomsWithItems = rooms.filter(r => r.itemCount > 0).length
    const emptyRooms = totalRooms - roomsWithItems

    return { rooms, totalRooms, roomsWithItems, emptyRooms }
  }, [phases])

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
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter)
    }
    
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
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })
    
    return sorted
  }, [allFFEItems, sortField, sortDirection, statusFilter])

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalItems = allFFEItems.length
    const completedItems = allFFEItems.filter(i => 
      i.status === 'COMPLETED' || i.status === 'ORDERED' || i.status === 'DELIVERED'
    ).length
    const pendingItems = allFFEItems.filter(i => 
      i.status === 'PENDING' || i.status === 'UNDECIDED' || i.status === 'NOT_STARTED' || i.status === 'IN_PROGRESS'
    ).length
    
    // Group by room for chart
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

  return (
    <div className="space-y-6">
      {/* Room Progress Cards - FFE Workflow Tracking */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Rooms */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Total Rooms</p>
              <p className="text-2xl font-bold text-gray-900">{ffeRoomData.totalRooms}</p>
              <p className="text-xs text-gray-400 mt-1">with FFE stage</p>
            </div>
            <div className="p-2.5 bg-[#e94d97]/10 rounded-lg">
              <Home className="w-5 h-5 text-[#e94d97]" />
            </div>
          </div>
        </div>

        {/* Empty Rooms (Need Items) */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Empty Rooms</p>
              <p className="text-2xl font-bold text-[#f6762e]">{ffeRoomData.emptyRooms}</p>
              <p className="text-xs text-gray-400 mt-1">need items added</p>
            </div>
            <div className="p-2.5 bg-[#f6762e]/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-[#f6762e]" />
            </div>
          </div>
        </div>

        {/* Rooms with Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Rooms with Items</p>
              <p className="text-2xl font-bold text-[#6366ea]">{ffeRoomData.roomsWithItems}</p>
              <p className="text-xs text-gray-400 mt-1">items added</p>
            </div>
            <div className="p-2.5 bg-[#6366ea]/10 rounded-lg">
              <Plus className="w-5 h-5 text-[#6366ea]" />
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Items Complete</p>
              <p className="text-2xl font-bold text-[#14b8a6]">{stats.completionRate}%</p>
              <p className="text-xs text-gray-400 mt-1">{stats.completedItems} of {stats.totalItems}</p>
            </div>
            <div className="p-2.5 bg-[#14b8a6]/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-[#14b8a6]" />
            </div>
          </div>
        </div>
      </div>

      {/* Chart and Empty Rooms - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Items per Room Chart */}
        {stats.costBreakdownData.length > 0 && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Items per Room</h3>
              <BarChart3 className="w-5 h-5 text-[#a657f0]" />
            </div>
            <CostBreakdownChart data={stats.costBreakdownData} />
          </div>
        )}

        {/* Empty Rooms Alert - Only show if there are empty rooms */}
        {ffeRoomData.emptyRooms > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-[#f6762e]/5 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#f6762e]" />
              <h3 className="font-semibold text-gray-900 text-sm">Rooms Needing Items</h3>
            </div>
            <div className="p-3 max-h-[280px] overflow-y-auto">
              <div className="space-y-2">
                {ffeRoomData.rooms
                  .filter(room => room.itemCount === 0)
                  .map(room => (
                    <div 
                      key={room.roomId} 
                      className="px-3 py-2 rounded-lg bg-[#f6762e]/5 border border-[#f6762e]/20 flex items-center gap-2"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-[#f6762e]"></div>
                      <span className="text-sm text-gray-700">{room.roomName}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Items Table */}
      {allFFEItems.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-[#e94d97]" />
              <h3 className="font-semibold text-gray-900">All FFE Items</h3>
              <span className="text-xs text-gray-500">({filteredAndSortedItems.length} items)</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a657f0]"
            >
              <option value="all">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="DELIVERED">Delivered</option>
              <option value="ORDERED">Ordered</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PENDING">Pending</option>
              <option value="UNDECIDED">Undecided</option>
              <option value="NOT_STARTED">Not Started</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th
                    onClick={() => handleSort('name')}
                    className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      Item
                      <SortIcon field="name" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('room')}
                    className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      Room
                      <SortIcon field="room" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      Status
                      <SortIcon field="status" />
                    </div>
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(showAllItems ? filteredAndSortedItems : filteredAndSortedItems.slice(0, ITEMS_LIMIT)).map((item, index) => (
                  <tr key={`${item.id}-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">
                      {item.roomName}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${STATUS_COLORS[item.status] || STATUS_COLORS.NOT_STARTED}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500 max-w-[200px] truncate">
                      {item.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Show more/less button */}
          {filteredAndSortedItems.length > ITEMS_LIMIT && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowAllItems(!showAllItems)}
                className="w-full text-center text-sm font-medium text-[#a657f0] hover:text-[#8b46cc] transition-colors"
              >
                {showAllItems 
                  ? 'Show less' 
                  : `Show all ${filteredAndSortedItems.length} items`}
              </button>
            </div>
          )}

          {filteredAndSortedItems.length === 0 && (
            <div className="p-8 text-center">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No items match the selected filter</p>
            </div>
          )}
        </div>
      )}

      {allFFEItems.length === 0 && ffeRoomData.totalRooms === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No FFE data for this project</p>
          <p className="text-sm text-gray-400 mt-1">FFE items will appear here once added to rooms</p>
        </div>
      )}
    </div>
  )
}

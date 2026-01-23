'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronUp, ChevronDown, Upload, Link as LinkIcon, ExternalLink, Edit, Trash2, Loader2, Plus, UserPlus, ImageIcon, CheckCircle2, Circle, AlertCircle, FileText, File, Download, Clock, Send, MessageSquare, Package, DollarSign, ShoppingCart, Truck, User, Building2, Receipt, CreditCard, FileCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Supplier {
  id: string
  name: string
  contactName?: string
  email: string
  phone?: string
  website?: string
  logo?: string
}

interface AvailableRoom {
  id: string
  name: string
  sections: Array<{ id: string; name: string }>
}

// FFE Item structure for linking
interface FFEItem {
  id: string
  name: string
  description?: string
  hasLinkedSpecs: boolean
  linkedSpecsCount: number
  status: string
}

interface FFESection {
  sectionId: string
  sectionName: string
  items: FFEItem[]
}

interface ItemDocument {
  id: string
  title: string
  description?: string
  fileName: string
  fileUrl: string
  fileSize?: number
  mimeType?: string
  type: string
  dropboxPath?: string
  visibleToClient: boolean
  visibleToSupplier: boolean
  createdAt: string
  uploadedBy?: {
    id: string
    name: string
    email: string
  }
}

// Item component (sub-item like transformer for a light fixture)
interface ItemComponent {
  id: string
  name: string
  modelNumber?: string | null
  image?: string | null
  price?: number | null
  quantity: number
  order: number
  notes?: string | null
}

interface FFERoom {
  roomId: string
  roomName: string
  sections: FFESection[]
}

interface ItemDetailPanelProps {
  isOpen: boolean
  onClose: () => void
  projectId?: string
  item?: {
    id: string
    name: string
    roomId?: string
    sectionId?: string
    roomName?: string
    sectionName?: string
    description?: string
    sku?: string
    productName?: string
    brand?: string
    quantity?: number
    unitType?: string
    supplierName?: string
    supplierLink?: string
    supplierId?: string
    thumbnailUrl?: string
    images?: string[]
    unitCost?: number
    tradePrice?: number
    rrp?: number
    tradeDiscount?: number
    specStatus?: string
    leadTime?: string
    color?: string
    finish?: string
    material?: string
    width?: string
    height?: string
    depth?: string
    length?: string
    roomIds?: string[]
    notes?: string | null
    ffeRequirementId?: string
    ffeRequirementName?: string
    // Multiple linked FFE items (many-to-many)
    linkedFfeItems?: Array<{
      linkId: string
      ffeItemId: string
      ffeItemName: string
      roomId: string
      roomName: string
      sectionName: string
    }>
    linkedFfeCount?: number
    // Client approval
    clientApproved?: boolean
    clientApprovedAt?: string
    clientApprovedVia?: string
    // Components (sub-items)
    components?: ItemComponent[]
    componentsTotal?: number
  } | null
  mode: 'view' | 'edit' | 'create'
  sectionId?: string
  roomId?: string
  availableRooms?: AvailableRoom[]
  // FFE linking props
  ffeItems?: FFERoom[]
  ffeItemsLoading?: boolean
  // Pre-selected FFE item (from FFE Workspace "Choose Product for This" action)
  initialFfeRoomId?: string
  initialFfeSectionId?: string
  initialFfeItemId?: string
  onSave?: () => void
  onNavigate?: (direction: 'prev' | 'next') => void
  hasNext?: boolean
  hasPrev?: boolean
}

const LEAD_TIME_OPTIONS = [
  { value: 'none', label: '-' },
  { value: 'in-stock', label: 'In Stock' },
  { value: '1-2 weeks', label: '1-2 Weeks' },
  { value: '2-4 weeks', label: '2-4 Weeks' },
  { value: '4-6 weeks', label: '4-6 Weeks' },
  { value: '6-8 weeks', label: '6-8 Weeks' },
  { value: '8-12 weeks', label: '8-12 Weeks' },
  { value: '12+ weeks', label: '12+ Weeks' },
]

const UNIT_TYPE_OPTIONS = [
  { value: 'units', label: 'Units' },
  { value: 'SF', label: 'SF (Square Feet)' },
  { value: 'SY', label: 'SY (Square Yards)' },
  { value: 'LF', label: 'LF (Linear Feet)' },
  { value: 'LY', label: 'LY (Linear Yards)' },
  { value: 'sqm', label: 'SQM (Square Meters)' },
  { value: 'meters', label: 'Meters' },
  { value: 'feet', label: 'Feet' },
  { value: 'inches', label: 'Inches' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'sets', label: 'Sets' },
  { value: 'pairs', label: 'Pairs' },
]

// Activity Tab Component
interface ActivityItem {
  id: string
  type: string
  title: string
  description?: string
  timestamp: string
  actor?: {
    id?: string
    name?: string
    email?: string
    image?: string
    type: string
  }
  metadata?: any
}

// Progress stages for items - 8-stage procurement workflow
const ITEM_STAGES = [
  { key: 'selected', label: 'Selected', icon: CheckCircle2, activityTypes: ['ITEM_SELECTED'] },
  { key: 'rfq_sent', label: 'RFQ Sent', icon: Send, activityTypes: ['QUOTE_REQUESTED'] },
  { key: 'quoted', label: 'Quoted', icon: DollarSign, activityTypes: ['QUOTE_RECEIVED', 'QUOTE_ACCEPTED'] },
  { key: 'approved', label: 'Approved', icon: FileCheck, activityTypes: ['CLIENT_APPROVED'] },
  { key: 'invoiced', label: 'Invoiced', icon: Receipt, activityTypes: ['SENT_TO_CLIENT_QUOTE'] },
  { key: 'paid', label: 'Paid', icon: CreditCard, activityTypes: ['CLIENT_QUOTE_PAID'] },
  { key: 'ordered', label: 'Ordered', icon: ShoppingCart, activityTypes: ['ORDERED', 'ADDED_TO_ORDER'] },
  { key: 'delivered', label: 'Delivered', icon: Package, activityTypes: ['DELIVERED'] },
]

function ActivityTab({ itemId, roomId, mode, specStatus, onStageClick }: { itemId?: string; roomId?: string; mode: string; specStatus?: string; onStageClick?: (stageKey: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [deleting, setDeleting] = useState(false)
  const [updatingStage, setUpdatingStage] = useState<string | null>(null)

  useEffect(() => {
    if (itemId && roomId && mode !== 'create') {
      loadActivities()
    }
  }, [itemId, roomId, mode])

  const loadActivities = async () => {
    if (!itemId || !roomId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}/activity`)
      if (res.ok) {
        const data = await res.json()
        setActivities(data.activities || [])
      }
    } catch (error) {
      console.error('Failed to load activities:', error)
    } finally {
      setLoading(false)
    }
  }

  // TEMPORARY: Delete all activities for testing
  const handleDeleteAllActivities = async () => {
    if (!itemId || !roomId) return
    if (!confirm('Are you sure you want to delete ALL activity for this item? This cannot be undone.')) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}/activity`, {
        method: 'DELETE'
      })
      if (res.ok) {
        const data = await res.json()
        setActivities([])
        toast.success(`Deleted ${data.deleted.activities} activities and ${data.deleted.quoteRequests} quote requests`)
      } else {
        toast.error('Failed to delete activities')
      }
    } catch (error) {
      console.error('Failed to delete activities:', error)
      toast.error('Failed to delete activities')
    } finally {
      setDeleting(false)
    }
  }

  // Handle clicking on a stage to manually mark it as complete
  const handleStageClick = async (stageKey: string, stageIndex: number) => {
    if (!itemId || !roomId || mode === 'create') return

    // Map stage keys to activity types and spec statuses
    const stageMapping: Record<string, { activityType: string; specStatus: string; title: string }> = {
      'selected': { activityType: 'ITEM_SELECTED', specStatus: 'SELECTED', title: 'Item Selected' },
      'rfq_sent': { activityType: 'QUOTE_REQUESTED', specStatus: 'RFQ_SENT', title: 'RFQ Sent' },
      'quoted': { activityType: 'QUOTE_RECEIVED', specStatus: 'QUOTE_RECEIVED', title: 'Quote Received' },
      'approved': { activityType: 'CLIENT_APPROVED', specStatus: 'BUDGET_APPROVED', title: 'Client Approved' },
      'invoiced': { activityType: 'SENT_TO_CLIENT_QUOTE', specStatus: 'INVOICED_TO_CLIENT', title: 'Invoiced to Client' },
      'paid': { activityType: 'CLIENT_QUOTE_PAID', specStatus: 'CLIENT_PAID', title: 'Client Paid' },
      'ordered': { activityType: 'ORDERED', specStatus: 'ORDERED', title: 'Ordered from Supplier' },
      'delivered': { activityType: 'DELIVERED', specStatus: 'DELIVERED', title: 'Delivered' },
    }

    const mapping = stageMapping[stageKey]
    if (!mapping) return

    setUpdatingStage(stageKey)
    try {
      // Create activity log entry
      const activityRes = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mapping.activityType,
          title: mapping.title,
          description: `Manually marked as ${mapping.title.toLowerCase()}`,
          metadata: { manual: true }
        })
      })

      if (!activityRes.ok) {
        throw new Error('Failed to create activity')
      }

      // Update item specStatus
      const updateRes = await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specStatus: mapping.specStatus })
      })

      if (!updateRes.ok) {
        throw new Error('Failed to update status')
      }

      // Reload activities to reflect the change
      await loadActivities()
      toast.success(`Marked as ${mapping.title}`)

      // Notify parent if callback provided
      if (onStageClick) {
        onStageClick(stageKey)
      }
    } catch (error) {
      console.error('Failed to update stage:', error)
      toast.error('Failed to update stage')
    } finally {
      setUpdatingStage(null)
    }
  }

  // Get the date when a stage was completed (first occurrence of any matching activity type)
  const getStageDates = () => {
    const stageDates: Record<string, string | null> = {}

    for (const stage of ITEM_STAGES) {
      // Find the first activity that matches this stage (sorted by oldest first for "completed" date)
      const matchingActivities = activities
        .filter(a => stage.activityTypes.includes(a.type))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      stageDates[stage.key] = matchingActivities.length > 0 ? matchingActivities[0].timestamp : null
    }

    // For "selected" stage, if no ITEM_SELECTED activity, check specStatus or use first activity date
    if (!stageDates['selected'] && activities.length > 0) {
      // If item exists and has any activity, consider it selected
      const oldestActivity = [...activities].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )[0]
      stageDates['selected'] = oldestActivity?.timestamp || null
    }

    return stageDates
  }

  // Determine current stage based on specStatus and activities
  const getCurrentStage = () => {
    // Check activities for specific events (8-stage workflow)
    const hasDelivered = activities.some(a => a.type === 'DELIVERED')
    const hasOrdered = activities.some(a => a.type === 'ORDERED' || a.type === 'ADDED_TO_ORDER')
    const hasPaid = activities.some(a => a.type === 'CLIENT_QUOTE_PAID')
    const hasInvoiced = activities.some(a => a.type === 'SENT_TO_CLIENT_QUOTE')
    const hasApproved = activities.some(a => a.type === 'CLIENT_APPROVED')
    const hasQuoted = activities.some(a => a.type === 'QUOTE_RECEIVED' || a.type === 'QUOTE_ACCEPTED')
    const hasRfqSent = activities.some(a => a.type === 'QUOTE_REQUESTED')

    // Return the highest stage achieved
    if (hasDelivered) return 'delivered'
    if (hasOrdered) return 'ordered'
    if (hasPaid) return 'paid'
    if (hasInvoiced) return 'invoiced'
    if (hasApproved) return 'approved'
    if (hasQuoted || specStatus === 'QUOTED' || specStatus === 'PRICE_RECEIVED' || specStatus === 'QUOTE_RECEIVED' || specStatus === 'QUOTE_APPROVED') return 'quoted'
    if (hasRfqSent || specStatus === 'RFQ_SENT') return 'rfq_sent'

    // Check specStatus for other stages
    if (specStatus === 'CLIENT_PAID') return 'paid'
    if (specStatus === 'INVOICED_TO_CLIENT' || specStatus === 'BUDGET_SENT') return 'invoiced'
    if (specStatus === 'BUDGET_APPROVED') return 'approved'
    if (specStatus === 'ORDERED') return 'ordered'
    if (specStatus === 'DELIVERED') return 'delivered'

    return 'selected'
  }

  // Format date for stage display (short format)
  const formatStageDate = (timestamp: string | null) => {
    if (!timestamp) return null
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'QUOTE_REQUESTED':
        return <Send className="w-4 h-4 text-blue-500" />
      case 'QUOTE_RECEIVED':
        return <DollarSign className="w-4 h-4 text-green-500" />
      case 'QUOTE_ACCEPTED':
        return <FileCheck className="w-4 h-4 text-green-500" />
      case 'QUOTE_DECLINED':
        return <X className="w-4 h-4 text-red-500" />
      case 'QUOTE_VIEWED':
        return <ExternalLink className="w-4 h-4 text-purple-500" />
      case 'STATUS_CHANGED':
        return <CheckCircle2 className="w-4 h-4 text-purple-500" />
      case 'PRICE_UPDATED':
        return <DollarSign className="w-4 h-4 text-yellow-500" />
      case 'SENT_TO_CLIENT':
        return <Send className="w-4 h-4 text-blue-500" />
      case 'SENT_TO_CLIENT_QUOTE':
        return <Receipt className="w-4 h-4 text-indigo-500" />
      case 'CLIENT_QUOTE_VIEWED':
        return <ExternalLink className="w-4 h-4 text-purple-500" />
      case 'CLIENT_QUOTE_PAID':
        return <CreditCard className="w-4 h-4 text-green-500" />
      case 'CLIENT_APPROVED':
        return <FileCheck className="w-4 h-4 text-green-500" />
      case 'CLIENT_UNAPPROVED':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case 'CLIENT_REJECTED':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'ADDED_TO_ORDER':
        return <ShoppingCart className="w-4 h-4 text-indigo-500" />
      case 'ORDERED':
        return <Package className="w-4 h-4 text-blue-500" />
      case 'SHIPPED':
        return <Truck className="w-4 h-4 text-orange-500" />
      case 'DELIVERED':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'NOTE_ADDED':
        return <FileText className="w-4 h-4 text-gray-500" />
      case 'DOCUMENT_UPLOADED':
        return <Upload className="w-4 h-4 text-blue-500" />
      case 'ITEM_SELECTED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getActorIcon = (actorType: string) => {
    switch (actorType) {
      case 'supplier':
        return <Building2 className="w-3 h-3" />
      case 'client':
        return <User className="w-3 h-3" />
      default:
        return null
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const showYear = date.getFullYear() !== now.getFullYear()

    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: showYear ? 'numeric' : undefined
    })
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })

    return `${dateStr} at ${timeStr}`
  }

  if (mode === 'create') {
    return (
      <div className="text-center py-12 text-gray-500">
        <Clock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="text-sm">Activity will appear after saving</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const currentStage = getCurrentStage()
  const currentStageIndex = ITEM_STAGES.findIndex(s => s.key === currentStage)
  const stageDates = getStageDates()

  return (
    <div className="space-y-4">
      {/* Progress Tracker */}
      <div className="bg-gradient-to-r from-gray-50 to-white rounded-lg p-4 border">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Item Progress</p>
          <p className="text-[10px] text-gray-400">Click a stage to mark complete</p>
        </div>

        {/* Progress bar with circles */}
        <div className="relative">
          {/* Background line - full width */}
          <div className="absolute top-[14px] left-[20px] right-[20px] h-0.5 bg-gray-200" />

          {/* Completed line - dynamic width */}
          <div
            className="absolute top-[14px] left-[20px] h-0.5 bg-emerald-500 transition-all duration-300"
            style={{
              width: currentStageIndex >= 0
                ? `calc(${(currentStageIndex / (ITEM_STAGES.length - 1)) * 100}% - ${currentStageIndex === ITEM_STAGES.length - 1 ? 0 : 0}px)`
                : '0%'
            }}
          />

          {/* Stage circles and labels */}
          <div className="relative flex justify-between">
            {ITEM_STAGES.map((stage, index) => {
              const isCompleted = index <= currentStageIndex
              const isCurrent = index === currentStageIndex
              const StageIcon = stage.icon
              const stageDate = stageDates[stage.key]
              const isUpdating = updatingStage === stage.key

              return (
                <div key={stage.key} className="flex flex-col items-center" style={{ width: '40px' }}>
                  {/* Stage circle - clickable */}
                  <button
                    onClick={() => handleStageClick(stage.key, index)}
                    disabled={isUpdating || mode === 'create'}
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all relative z-10",
                      isCompleted ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-400",
                      isCurrent && "ring-2 ring-emerald-300 ring-offset-2",
                      !isCompleted && mode !== 'create' && "hover:bg-emerald-100 hover:text-emerald-600 cursor-pointer",
                      isCompleted && mode !== 'create' && "hover:ring-2 hover:ring-emerald-300 cursor-pointer",
                      mode === 'create' && "cursor-default"
                    )}
                    title={isCompleted ? `${stage.label} - ${stageDate ? formatStageDate(stageDate) : 'Completed'}` : `Click to mark as ${stage.label}`}
                  >
                    {isUpdating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <StageIcon className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Label */}
                  <span className={cn(
                    "text-[9px] mt-1.5 text-center leading-tight whitespace-nowrap",
                    isCurrent ? "text-emerald-700 font-semibold" : isCompleted ? "text-gray-700" : "text-gray-400"
                  )}>
                    {stage.label}
                  </span>

                  {/* Date when stage was completed */}
                  <span className={cn(
                    "text-[8px] mt-0.5 h-3",
                    isCompleted && stageDate ? "text-emerald-600" : "text-transparent"
                  )}>
                    {isCompleted && stageDate ? formatStageDate(stageDate) : '-'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Activity List */}
      {activities.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">No activity recorded yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Activity History</p>
            {/* TEMPORARY: Delete all button for testing */}
            <button
              onClick={handleDeleteAllActivities}
              disabled={deleting}
              className="text-[10px] text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : '🧪 Clear All (Test)'}
            </button>
          </div>
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  {getActivityIcon(activity.type)}
                </div>
                {index < activities.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                    {activity.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatTime(activity.timestamp)}
                  </span>
                </div>

                {/* Actor */}
                {activity.actor && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {activity.actor.image ? (
                      <img
                        src={activity.actor.image}
                        alt={activity.actor.name || ''}
                        className="w-4 h-4 rounded-full"
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                        {getActorIcon(activity.actor.type) || (
                          <span className="text-[10px] font-medium">
                            {(activity.actor.name || activity.actor.email || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    )}
                    <span className="text-xs text-gray-500">
                      {activity.actor.name || activity.actor.email}
                    </span>
                    {activity.actor.type !== 'user' && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                        {activity.actor.type}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Metadata badges */}
                {activity.metadata && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {activity.metadata.quoteAmount && !isNaN(Number(activity.metadata.quoteAmount)) && (
                      <Badge variant="secondary" className="text-xs">
                        ${Number(activity.metadata.quoteAmount).toLocaleString()}
                      </Badge>
                    )}
                    {activity.metadata.leadTime && (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        {String(activity.metadata.leadTime).replace(/_/g, ' ')}
                      </Badge>
                    )}
                    {activity.metadata.rfqNumber && (
                      <Badge variant="outline" className="text-xs">
                        {activity.metadata.rfqNumber}
                      </Badge>
                    )}
                    {/* Status change badge (old → new) */}
                    {activity.type === 'STATUS_CHANGED' && activity.metadata.oldStatus && activity.metadata.newStatus && (
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                        {activity.metadata.oldStatus.replace(/_/g, ' ')} → {activity.metadata.newStatus.replace(/_/g, ' ')}
                      </Badge>
                    )}
                    {activity.metadata.status && activity.type !== 'QUOTE_REQUESTED' && activity.type !== 'STATUS_CHANGED' && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          activity.metadata.status === 'QUOTED' && "bg-green-50 text-green-700 border-green-200",
                          activity.metadata.status === 'DECLINED' && "bg-red-50 text-red-700 border-red-200",
                          activity.metadata.status === 'VIEWED' && "bg-blue-50 text-blue-700 border-blue-200"
                        )}
                      >
                        {activity.metadata.status}
                      </Badge>
                    )}
                    {activity.metadata.quoteDocumentUrl && (
                      <a
                        href={activity.metadata.quoteDocumentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <FileText className="w-3 h-3" />
                        View Quote
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ItemDetailPanel({
  isOpen,
  onClose,
  projectId,
  item,
  mode,
  sectionId,
  roomId,
  availableRooms = [],
  ffeItems = [],
  ffeItemsLoading = false,
  initialFfeRoomId,
  initialFfeSectionId,
  initialFfeItemId,
  onSave,
  onNavigate,
  hasNext = false,
  hasPrev = false,
}: ItemDetailPanelProps) {
  const [activeTab, setActiveTab] = useState('summary')
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)

  // Doc Code duplicate warning state
  const [docCodeDuplicateWarning, setDocCodeDuplicateWarning] = useState<{
    docCode: string
    duplicates: Array<{ id: string; name: string; roomName: string; sectionName: string }>
  } | null>(null)
  const [checkingDocCode, setCheckingDocCode] = useState(false)
  const docCodeCheckTimerRef = useRef<NodeJS.Timeout | null>(null)

  // FFE Linking state - cascading selection
  const [selectedFfeRoom, setSelectedFfeRoom] = useState<string>('')
  const [selectedFfeSection, setSelectedFfeSection] = useState<string>('')
  const [selectedFfeItemId, setSelectedFfeItemId] = useState<string>('')
  const [showAlreadyChosenWarning, setShowAlreadyChosenWarning] = useState(false)
  
  // Track if FFE selection has been initialized for current panel session
  const ffeInitializedRef = useRef(false)
  
  // Reset initialization flag when panel closes
  useEffect(() => {
    if (!isOpen) {
      ffeInitializedRef.current = false
      setSelectedFfeRoom('')
      setSelectedFfeSection('')
      setSelectedFfeItemId('')
      setShowAlreadyChosenWarning(false)
      // Clear original value refs
      originalFormDataRef.current = null
      originalImagesRef.current = null
      // Clear doc code duplicate warning
      setDocCodeDuplicateWarning(null)
      setCheckingDocCode(false)
    }
  }, [isOpen])
  
  // Initialize FFE selection when panel opens with initial values
  useEffect(() => {
    // Only run when panel is open, in create mode, has initial values, AND ffeItems are loaded
    if (isOpen && mode === 'create' && !ffeInitializedRef.current && initialFfeRoomId && ffeItems.length > 0) {
      // Verify the initialFfeRoomId exists in the ffeItems
      const roomExists = ffeItems.some(r => r.roomId === initialFfeRoomId)
      if (!roomExists) {
        return // Don't initialize yet, ffeItems might not be fully loaded
      }
      
      ffeInitializedRef.current = true
      setSelectedFfeRoom(initialFfeRoomId)
      setSelectedFfeSection(initialFfeSectionId || '')
      setSelectedFfeItemId(initialFfeItemId || '')
      
      // Check if item already has linked specs to show warning
      if (initialFfeItemId) {
        const room = ffeItems.find(r => r.roomId === initialFfeRoomId)
        const section = room?.sections.find(s => s.sectionId === initialFfeSectionId)
        const ffeItem = section?.items.find(i => i.id === initialFfeItemId)
        setShowAlreadyChosenWarning(ffeItem?.hasLinkedSpecs || false)
      }
    }
  }, [isOpen, mode, initialFfeRoomId, initialFfeSectionId, initialFfeItemId, ffeItems])


  // Get filtered sections based on selected room (with fallback to initial value)
  const effectiveRoomId = selectedFfeRoom || initialFfeRoomId
  const filteredFfeSections = effectiveRoomId 
    ? ffeItems.find(r => r.roomId === effectiveRoomId)?.sections || []
    : []
  
  // Get filtered items based on selected section (with fallback to initial value)
  const effectiveSectionId = selectedFfeSection || initialFfeSectionId
  const filteredFfeItemsList = effectiveSectionId
    ? filteredFfeSections.find(s => s.sectionId === effectiveSectionId)?.items || []
    : []

  // Flatten all FFE items into a single list for single-dropdown selection
  const allFfeItemsFlat = ffeItems.flatMap(room => 
    room.sections.flatMap(section => 
      section.items.map(item => ({
        value: `${room.roomId}|${section.sectionId}|${item.id}`,
        roomId: room.roomId,
        roomName: room.roomName,
        sectionId: section.sectionId,
        sectionName: section.sectionName,
        itemId: item.id,
        itemName: item.name,
        hasLinkedSpecs: item.hasLinkedSpecs,
        linkedSpecsCount: item.linkedSpecsCount || 0,
        label: `${room.roomName} > ${section.sectionName} > ${item.name}`
      }))
    )
  )

  // Handle single dropdown FFE item selection
  const handleFlatFfeItemSelect = (compositeValue: string) => {
    const [roomId, sectionId, itemId] = compositeValue.split('|')
    const item = allFfeItemsFlat.find(i => i.value === compositeValue)
    
    if (item) {
      setSelectedFfeRoom(roomId)
      setSelectedFfeSection(sectionId)
      setSelectedFfeItemId(itemId)
      setShowAlreadyChosenWarning(item.hasLinkedSpecs)
    }
  }

  // Get the composite value for the current selection
  const currentFfeCompositeValue = (selectedFfeRoom || initialFfeRoomId) && 
    (selectedFfeSection || initialFfeSectionId) && 
    (selectedFfeItemId || initialFfeItemId)
    ? `${selectedFfeRoom || initialFfeRoomId}|${selectedFfeSection || initialFfeSectionId}|${selectedFfeItemId || initialFfeItemId}`
    : ''
  
  // Get selected FFE item details
  const selectedFfeItem = selectedFfeItemId && selectedFfeRoom && selectedFfeSection
    ? (() => {
        const room = ffeItems.find(r => r.roomId === selectedFfeRoom)
        const section = room?.sections.find(s => s.sectionId === selectedFfeSection)
        const item = section?.items.find(i => i.id === selectedFfeItemId)
        if (room && section && item) {
          return {
            roomId: room.roomId,
            roomName: room.roomName,
            sectionId: section.sectionId,
            sectionName: section.sectionName,
            itemId: item.id,
            itemName: item.name,
            hasLinkedSpecs: item.hasLinkedSpecs,
            linkedSpecsCount: item.linkedSpecsCount
          }
        }
        return null
      })()
    : null
  
  // Add New Supplier modal
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [changingSupplier, setChangingSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    notes: '',
    logo: '',
    categoryId: '',
    currency: 'CAD'
  })
  const [supplierCategories, setSupplierCategories] = useState<Array<{ id: string; name: string; icon?: string; color?: string }>>([])
  const [loadingSupplierCategories, setLoadingSupplierCategories] = useState(false)

  // Warn before page refresh/navigation when saving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saving || savingSupplier) {
        e.preventDefault()
        e.returnValue = 'Changes are being saved. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saving, savingSupplier])

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',         // Model number
    docCode: '',     // Document Code (separate from SKU)
    productName: '',
    brand: '',
    quantity: 1,
    unitType: 'units',
    supplierName: '',
    supplierLink: '',
    supplierId: '',
    supplierContactName: '',
    supplierEmail: '',
    supplierLogo: '',
    leadTime: '',
    color: '',
    finish: '',
    material: '',
    width: '',
    height: '',
    depth: '',
    length: '',
    tradePrice: '',
    rrp: '',
    tradeDiscount: '',
    markupPercent: '',
    rrpCurrency: 'CAD',
    tradePriceCurrency: 'CAD',
    notes: '',
  })
  
  const [images, setImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([])

  // Documents state
  const [documents, setDocuments] = useState<ItemDocument[]>([])
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null)
  const [pendingDocumentFiles, setPendingDocumentFiles] = useState<File[]>([])
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('Quotes')
  const [customDocumentType, setCustomDocumentType] = useState('')
  const [documentNote, setDocumentNote] = useState('')
  // Edit document state
  const [editingDocument, setEditingDocument] = useState<ItemDocument | null>(null)
  const [editDocumentTitle, setEditDocumentTitle] = useState('')
  const [editDocumentNote, setEditDocumentNote] = useState('')
  const [savingDocumentEdit, setSavingDocumentEdit] = useState(false)

  // Components state (sub-items like transformer for a light fixture)
  const [components, setComponents] = useState<ItemComponent[]>([])
  const [savingComponent, setSavingComponent] = useState(false)
  const [editingComponent, setEditingComponent] = useState<ItemComponent | null>(null)
  const [newComponent, setNewComponent] = useState({ name: '', modelNumber: '', price: '', quantity: 1, image: '' })
  const [showAddComponent, setShowAddComponent] = useState(false)
  const componentImageInputRef = useRef<HTMLInputElement>(null)
  const editComponentImageInputRef = useRef<HTMLInputElement>(null)
  const [uploadingComponentImage, setUploadingComponentImage] = useState(false)
  const [uploadingEditComponentImage, setUploadingEditComponentImage] = useState(false)

  // Track original values to detect changes
  const originalFormDataRef = useRef<typeof formData | null>(null)
  const originalImagesRef = useRef<string[] | null>(null)

  // Default document types with labels and colors
  const defaultDocumentTypes = [
    { id: 'Quotes', label: 'Quote', color: 'blue', dbType: 'SUPPLIER_QUOTE' },
    { id: 'Drawings', label: 'Spec Sheet', color: 'purple', dbType: 'DRAWING' },
    { id: 'Invoices', label: 'Invoice', color: 'green', dbType: 'INVOICE' },
    { id: 'Receipts', label: 'Receipt', color: 'emerald', dbType: 'RECEIPT' },
    { id: 'Shipping', label: 'Shipping', color: 'orange', dbType: 'SHIPPING_DOC' },
    { id: 'Other', label: 'Other', color: 'gray', dbType: 'OTHER' },
  ]
  
  // Handle file upload - allow up to 10 images
  const MAX_IMAGES = 10
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (images.length >= MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`)
      return
    }

    const file = files[0]
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.error('Image must be less than 4MB')
      return
    }

    setUploadingImage(true)
    try {
      // Upload to server and get URL
      const formData = new FormData()
      formData.append('file', file)
      formData.append('imageType', 'general')

      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          setImages(prev => [...prev, data.url].slice(0, MAX_IMAGES))
          toast.success('Image uploaded')
        } else {
          throw new Error('No URL returned')
        }
      } else {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  // Load documents for item
  const loadDocuments = async () => {
    if (!item?.id || !item?.roomId) return

    setLoadingDocuments(true)
    try {
      const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}/documents`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Failed to load documents:', error)
    } finally {
      setLoadingDocuments(false)
    }
  }

  // Handle file selection for documents - show type selector
  const handleDocumentFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!item?.id || !item?.roomId) {
      toast.error('Please save the item first before uploading documents')
      return
    }

    const validFiles: File[] = []
    const errors: string[] = []

    // Validate each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > 25 * 1024 * 1024) {
        errors.push(`${file.name} exceeds 25MB limit`)
      } else {
        validFiles.push(file)
      }
    }

    if (errors.length > 0) {
      toast.error(errors.join(', '))
    }

    if (validFiles.length > 0) {
      // Add to existing pending files
      setPendingDocumentFiles(prev => [...prev, ...validFiles])
    }
  }

  // Upload documents with selected type
  const handleDocumentUpload = async () => {
    if (pendingDocumentFiles.length === 0 || !item?.id || !item?.roomId) return

    // Get the document type config
    const typeConfig = defaultDocumentTypes.find(t => t.id === selectedDocumentType)
    const dbType = typeConfig?.dbType || 'OTHER'

    // For custom "Other" type, prepend the custom label to the description
    let description = documentNote.trim()
    if (selectedDocumentType === 'Other' && customDocumentType.trim()) {
      description = `[${customDocumentType.trim()}] ${description}`.trim()
    }

    setUploadingDocument(true)
    const uploadedDocs: ItemDocument[] = []
    const failedFiles: string[] = []

    try {
      // Upload each file sequentially
      for (const file of pendingDocumentFiles) {
        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('fileType', selectedDocumentType)
          formData.append('documentType', dbType)
          formData.append('title', file.name)
          if (description) {
            formData.append('description', description)
          }

          const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}/documents`, {
            method: 'POST',
            body: formData
          })

          if (res.ok) {
            const data = await res.json()
            uploadedDocs.push(data.document)
          } else {
            failedFiles.push(file.name)
          }
        } catch (error) {
          console.error('Upload error for file:', file.name, error)
          failedFiles.push(file.name)
        }
      }

      // Update state with uploaded documents
      if (uploadedDocs.length > 0) {
        setDocuments(prev => [...uploadedDocs, ...prev])
        toast.success(`${uploadedDocs.length} document${uploadedDocs.length > 1 ? 's' : ''} uploaded successfully`)
      }

      if (failedFiles.length > 0) {
        toast.error(`Failed to upload: ${failedFiles.join(', ')}`)
      }

      // Clear pending files and reset form
      setPendingDocumentFiles([])
      setSelectedDocumentType('Quotes')
      setCustomDocumentType('')
      setDocumentNote('')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload documents')
    } finally {
      setUploadingDocument(false)
    }
  }

  // Cancel pending upload
  const cancelDocumentUpload = () => {
    setPendingDocumentFiles([])
    setSelectedDocumentType('Quotes')
    setCustomDocumentType('')
    setDocumentNote('')
  }

  // Remove a specific file from pending files
  const removePendingFile = (index: number) => {
    setPendingDocumentFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Delete document
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return
    }

    setDeletingDocumentId(documentId)
    try {
      // Use direct delete endpoint which works with any document type
      const res = await fetch(`/api/documents/${documentId}`, { method: 'DELETE' })

      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== documentId))
        toast.success('Document deleted')
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('Delete failed:', res.status, errorData)
        toast.error(errorData.error || 'Failed to delete document')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete document - network error')
    } finally {
      setDeletingDocumentId(null)
    }
  }

  // Open edit document dialog
  const handleEditDocument = (doc: ItemDocument) => {
    setEditingDocument(doc)
    setEditDocumentTitle(doc.title || doc.fileName)
    setEditDocumentNote(doc.description || '')
  }

  // Save document edits
  const handleSaveDocumentEdit = async () => {
    if (!editingDocument || !item?.id) return

    const targetRoomId = item.roomId || roomId
    if (!targetRoomId) {
      toast.error('Cannot update document - missing room information')
      return
    }

    setSavingDocumentEdit(true)
    try {
      const res = await fetch(
        `/api/ffe/v2/rooms/${targetRoomId}/items/${item.id}/documents`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: editingDocument.id,
            title: editDocumentTitle,
            description: editDocumentNote
          })
        }
      )

      if (res.ok) {
        const data = await res.json()
        setDocuments(prev => prev.map(d =>
          d.id === editingDocument.id
            ? { ...d, title: editDocumentTitle, description: editDocumentNote }
            : d
        ))
        setEditingDocument(null)
        toast.success('Document updated')
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('Update failed:', res.status, errorData)
        toast.error(errorData.error || 'Failed to update document')
      }
    } catch (error) {
      console.error('Update error:', error)
      toast.error('Failed to update document - network error')
    } finally {
      setSavingDocumentEdit(false)
    }
  }

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Get icon for file type
  const getFileIcon = (mimeType?: string, fileName?: string) => {
    const ext = fileName?.split('.').pop()?.toLowerCase()
    if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return ImageIcon
    }
    if (mimeType === 'application/pdf' || ext === 'pdf') {
      return FileText
    }
    return File
  }

  // Component management functions
  const handleAddComponent = async () => {
    if (!newComponent.name.trim()) {
      toast.error('Component name is required')
      return
    }

    const targetRoomId = item?.roomId || roomId
    if (!targetRoomId || !item?.id) {
      // For new items, just add to local state
      const tempId = `temp-${Date.now()}`
      setComponents(prev => [...prev, {
        id: tempId,
        name: newComponent.name,
        modelNumber: newComponent.modelNumber || null,
        image: newComponent.image || null,
        price: newComponent.price ? parseFloat(newComponent.price) : null,
        quantity: newComponent.quantity || 1,
        order: prev.length,
        notes: null
      }])
      setNewComponent({ name: '', modelNumber: '', price: '', quantity: 1, image: '' })
      setShowAddComponent(false)
      return
    }

    setSavingComponent(true)
    try {
      const res = await fetch(`/api/ffe/v2/rooms/${targetRoomId}/items/${item.id}/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newComponent.name,
          modelNumber: newComponent.modelNumber || null,
          image: newComponent.image || null,
          price: newComponent.price || null,
          quantity: newComponent.quantity || 1
        })
      })

      if (res.ok) {
        const data = await res.json()
        setComponents(prev => [...prev, data.component])
        setNewComponent({ name: '', modelNumber: '', price: '', quantity: 1, image: '' })
        setShowAddComponent(false)
        toast.success('Component added')
        onSave?.()
      } else {
        const errorData = await res.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to add component')
      }
    } catch (error) {
      console.error('Error adding component:', error)
      toast.error('Failed to add component')
    } finally {
      setSavingComponent(false)
    }
  }

  const handleUpdateComponent = async (component: ItemComponent) => {
    const targetRoomId = item?.roomId || roomId
    if (!targetRoomId || !item?.id) return

    setSavingComponent(true)
    try {
      const res = await fetch(`/api/ffe/v2/rooms/${targetRoomId}/items/${item.id}/components`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId: component.id,
          name: component.name,
          modelNumber: component.modelNumber,
          image: component.image,
          price: component.price,
          quantity: component.quantity
        })
      })

      if (res.ok) {
        const data = await res.json()
        setComponents(prev => prev.map(c => c.id === component.id ? data.component : c))
        setEditingComponent(null)
        toast.success('Component updated')
        onSave?.()
      } else {
        const errorData = await res.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to update component')
      }
    } catch (error) {
      console.error('Error updating component:', error)
      toast.error('Failed to update component')
    } finally {
      setSavingComponent(false)
    }
  }

  const handleDeleteComponent = async (componentId: string) => {
    const targetRoomId = item?.roomId || roomId
    if (!targetRoomId || !item?.id) {
      // For local components (new items), just remove from state
      setComponents(prev => prev.filter(c => c.id !== componentId))
      return
    }

    if (!confirm('Delete this component?')) return

    setSavingComponent(true)
    try {
      const res = await fetch(`/api/ffe/v2/rooms/${targetRoomId}/items/${item.id}/components?componentId=${componentId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setComponents(prev => prev.filter(c => c.id !== componentId))
        toast.success('Component deleted')
        onSave?.()
      } else {
        const errorData = await res.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to delete component')
      }
    } catch (error) {
      console.error('Error deleting component:', error)
      toast.error('Failed to delete component')
    } finally {
      setSavingComponent(false)
    }
  }

  const handleComponentImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.error('Image must be less than 4MB')
      return
    }

    setUploadingComponentImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('imageType', 'general')

      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          setNewComponent(prev => ({ ...prev, image: data.url }))
          toast.success('Image uploaded')
        }
      } else {
        toast.error('Failed to upload image')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload image')
    } finally {
      setUploadingComponentImage(false)
    }
  }

  // Handle image upload for editing component
  const handleEditComponentImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !editingComponent) return

    const file = files[0]
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.error('Image must be less than 4MB')
      return
    }

    setUploadingEditComponentImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('imageType', 'general')

      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          setEditingComponent({ ...editingComponent, image: data.url })
          toast.success('Image uploaded')
        }
      } else {
        toast.error('Failed to upload image')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload image')
    } finally {
      setUploadingEditComponentImage(false)
      if (editComponentImageInputRef.current) {
        editComponentImageInputRef.current.value = ''
      }
    }
  }

  // Calculate component total price
  const componentsTotal = components.reduce((sum, c) => {
    const price = c.price || 0
    const qty = c.quantity || 1
    return sum + (price * qty)
  }, 0)

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileUpload(e.dataTransfer.files)
  }
  
  // Load suppliers
  useEffect(() => {
    const loadSuppliers = async () => {
      setLoadingSuppliers(true)
      try {
        const res = await fetch('/api/suppliers')
        const data = await res.json()
        if (data.suppliers) {
          setSuppliers(data.suppliers)
        }
      } catch (error) {
        console.error('Failed to load suppliers:', error)
      } finally {
        setLoadingSuppliers(false)
      }
    }
    
    if (isOpen) {
      loadSuppliers()
    }
  }, [isOpen])

  // Check for duplicate doc code when value changes
  const checkDuplicateDocCode = useCallback(async (docCode: string) => {
    if (!docCode.trim() || !projectId) {
      setDocCodeDuplicateWarning(null)
      return
    }

    setCheckingDocCode(true)
    try {
      const excludeId = item?.id || ''
      const res = await fetch(`/api/projects/${projectId}/check-doc-code?docCode=${encodeURIComponent(docCode.trim())}&excludeItemId=${excludeId}`)
      const data = await res.json()

      if (data.isDuplicate && data.duplicates.length > 0) {
        setDocCodeDuplicateWarning({
          docCode: docCode.trim(),
          duplicates: data.duplicates
        })
      } else {
        setDocCodeDuplicateWarning(null)
      }
    } catch (error) {
      console.error('Error checking doc code:', error)
      setDocCodeDuplicateWarning(null)
    } finally {
      setCheckingDocCode(false)
    }
  }, [projectId, item?.id])

  // Debounced doc code check
  useEffect(() => {
    if (docCodeCheckTimerRef.current) {
      clearTimeout(docCodeCheckTimerRef.current)
    }

    docCodeCheckTimerRef.current = setTimeout(() => {
      checkDuplicateDocCode(formData.docCode)
    }, 500)

    return () => {
      if (docCodeCheckTimerRef.current) {
        clearTimeout(docCodeCheckTimerRef.current)
      }
    }
  }, [formData.docCode, checkDuplicateDocCode])

  // Load documents for existing items
  useEffect(() => {
    if (isOpen && item?.id && mode !== 'create') {
      loadDocuments()
    } else {
      setDocuments([])
    }
  }, [isOpen, item?.id, mode])
  
  // Load supplier categories
  const loadSupplierCategories = async () => {
    try {
      setLoadingSupplierCategories(true)
      const res = await fetch('/api/supplier-categories')
      if (res.ok) {
        const data = await res.json()
        setSupplierCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Failed to load supplier categories:', error)
    } finally {
      setLoadingSupplierCategories(false)
    }
  }

  // Create new supplier
  const handleCreateSupplier = async () => {
    if (!newSupplier.name || !newSupplier.contactName || !newSupplier.email) {
      toast.error('Business name, contact name, and email are required')
      return
    }
    
    setSavingSupplier(true)
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSupplier,
          categoryId: newSupplier.categoryId || null
        })
      })
      
      if (res.ok) {
        const data = await res.json()
        // Add to local suppliers list
        setSuppliers(prev => [...prev, data.supplier])
        // Select the new supplier with all details (don't overwrite supplierLink/Product URL)
        setFormData(prev => ({
          ...prev,
          supplierId: data.supplier.id,
          supplierName: data.supplier.name,
          supplierContactName: data.supplier.contactName || '',
          supplierEmail: data.supplier.email || '',
          supplierLogo: data.supplier.logo || ''
        }))
        // Reset and close modal
        setNewSupplier({ name: '', contactName: '', email: '', phone: '', address: '', website: '', notes: '', logo: '', categoryId: '', currency: 'CAD' })
        setShowAddSupplier(false)
        toast.success('Supplier added to phonebook')
      } else {
        const errorData = await res.json()
        toast.error(errorData.error || 'Failed to create supplier')
      }
    } catch (error) {
      console.error('Failed to create supplier:', error)
      toast.error('Failed to create supplier')
    } finally {
      setSavingSupplier(false)
    }
  }
  
  // Initialize form with item data
  useEffect(() => {
    if (item && (mode === 'view' || mode === 'edit')) {
      // Look up supplier details if item has a supplierId
      const supplier = item.supplierId ? suppliers.find(s => s.id === item.supplierId) : null
      // Parse supplierName for contact info if it contains " / " format
      let businessName = item.supplierName || ''
      let contactName = ''
      if (businessName.includes(' / ')) {
        const parts = businessName.split(' / ')
        businessName = parts[0]
        contactName = parts.slice(1).join(' / ')
      }

      const newFormData = {
        name: item.name || '',
        description: item.description || '',
        sku: (item as any).sku || '',
        docCode: (item as any).docCode || '',
        productName: item.productName || '',
        brand: item.brand || '',
        quantity: item.quantity || 1,
        unitType: item.unitType || 'units',
        supplierName: supplier?.name || businessName,
        supplierLink: item.supplierLink || '',
        supplierId: item.supplierId || '',
        supplierContactName: supplier?.contactName || contactName || '',
        supplierEmail: supplier?.email || '',
        supplierLogo: supplier?.logo || '',
        leadTime: item.leadTime || 'none',
        color: item.color || '',
        finish: item.finish || '',
        material: item.material || '',
        width: item.width || '',
        height: item.height || '',
        depth: item.depth || '',
        length: item.length || '',
        tradePrice: item.tradePrice?.toString() || '',
        rrp: item.rrp?.toString() || '',
        tradeDiscount: item.tradeDiscount?.toString() || '',
        // Calculate markup from trade price and RRP if not manually set
        markupPercent: (item as any).markupPercent?.toString() ||
          (item.tradePrice && item.rrp && item.tradePrice > 0
            ? (((item.rrp - item.tradePrice) / item.tradePrice) * 100).toFixed(1)
            : ''),
        rrpCurrency: (item as any).rrpCurrency || 'CAD',
        tradePriceCurrency: (item as any).tradePriceCurrency || 'CAD',
        notes: item.notes || '',
      }
      setFormData(newFormData)
      // Filter out empty/null image URLs
      const validImages = (item.images || []).filter((img: string) => img && img.trim())
      const newImages = validImages.length > 0 ? validImages : (item.thumbnailUrl ? [item.thumbnailUrl] : [])
      setImages(newImages)
      // Set rooms - either from roomIds array or from single roomId
      setSelectedRoomIds(item.roomIds || (item.roomId ? [item.roomId] : []))
      // Set components from item
      setComponents(item.components || [])
      // Store original values to detect changes on close
      originalFormDataRef.current = { ...newFormData }
      originalImagesRef.current = [...newImages]
    } else if (mode === 'create') {
      // Reset form for new item
      setFormData({
        name: '',
        description: '',
        sku: '',
        docCode: '',
        productName: '',
        brand: '',
        quantity: 1,
        unitType: 'units',
        supplierName: '',
        supplierLink: '',
        supplierId: '',
        leadTime: '',
        color: '',
        finish: '',
        material: '',
        width: '',
        height: '',
        depth: '',
        length: '',
        tradePrice: '',
        rrp: '',
        tradeDiscount: '',
        markupPercent: '',
        currency: 'CAD',
        notes: '',
      })
      setImages([])
      setComponents([])
      // Set initial room from prop if provided
      setSelectedRoomIds(roomId ? [roomId] : [])
      // Reset FFE selection
      setSelectedFfeRoom('')
      setSelectedFfeSection('')
      setSelectedFfeItemId('')
      setShowAlreadyChosenWarning(false)
    }
  }, [item, mode, roomId, suppliers])
  
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Product name is required')
      return
    }
    
    setSaving(true)
    try {
      const targetRoomId = item?.roomId || roomId
      const targetSectionId = item?.sectionId || sectionId
      
      if (mode === 'create' && targetRoomId && targetSectionId) {
        // Determine if this is an option (FFE item already has specs)
        const isOption = selectedFfeItem?.hasLinkedSpecs || false
        const optionNumber = isOption ? (selectedFfeItem?.linkedSpecsCount || 0) + 1 : null
        
        // Use the section from FFE item if linked, otherwise use the target section
        const finalSectionId = selectedFfeItem?.sectionId || targetSectionId
        
        // Create new item with FFE linking if selected
        const res = await fetch(`/api/ffe/v2/rooms/${selectedFfeItem?.roomId || targetRoomId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectionId: finalSectionId,
            name: formData.name,
            description: formData.description,
            sku: formData.sku,
            docCode: formData.docCode,
            brand: formData.brand,
            supplierName: formData.supplierName,
            supplierLink: formData.supplierLink,
            supplierId: formData.supplierId || undefined,
            quantity: formData.quantity,
            unitType: formData.unitType,
            leadTime: formData.leadTime === 'none' ? null : formData.leadTime,
            color: formData.color,
            finish: formData.finish,
            material: formData.material,
            width: formData.width,
            height: formData.height,
            depth: formData.depth,
            length: formData.length,
            notes: formData.notes,
            tradePrice: formData.tradePrice ? parseFloat(formData.tradePrice) : undefined,
            rrp: formData.rrp ? parseFloat(formData.rrp) : undefined,
            tradeDiscount: formData.tradeDiscount ? parseFloat(formData.tradeDiscount) : undefined,
            markupPercent: formData.markupPercent ? parseFloat(formData.markupPercent) : undefined,
            rrpCurrency: formData.rrpCurrency,
            tradePriceCurrency: formData.tradePriceCurrency,
            images: images,
            // FFE Linking fields
            isSpecItem: true,
            ffeRequirementId: selectedFfeItem?.itemId || null,
            isOption: isOption,
            optionNumber: optionNumber,
            specStatus: 'SELECTED',
            visibility: 'VISIBLE',
          })
        })
        
        if (res.ok) {
          const linkedMsg = selectedFfeItem 
            ? ` and linked to "${selectedFfeItem.itemName}"${isOption ? ` as Option #${optionNumber}` : ''}`
            : ''
          toast.success(`Item created${linkedMsg}`)
          onSave?.()
          onClose()
        } else {
          throw new Error('Failed to create item')
        }
      } else if ((mode === 'edit' || mode === 'view') && item?.id && targetRoomId) {
        // Update existing item
        const res = await fetch(`/api/ffe/v2/rooms/${targetRoomId}/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            sku: formData.sku,
            docCode: formData.docCode,
            productName: formData.productName,
            brand: formData.brand,
            supplierName: formData.supplierName,
            supplierLink: formData.supplierLink,
            supplierId: formData.supplierId || undefined,
            quantity: formData.quantity,
            unitType: formData.unitType,
            leadTime: formData.leadTime === 'none' ? null : formData.leadTime,
            color: formData.color,
            finish: formData.finish,
            material: formData.material,
            width: formData.width,
            height: formData.height,
            depth: formData.depth,
            length: formData.length,
            notes: formData.notes,
            tradePrice: formData.tradePrice ? parseFloat(formData.tradePrice) : undefined,
            rrp: formData.rrp ? parseFloat(formData.rrp) : undefined,
            tradeDiscount: formData.tradeDiscount ? parseFloat(formData.tradeDiscount) : undefined,
            markupPercent: formData.markupPercent ? parseFloat(formData.markupPercent) : undefined,
            rrpCurrency: formData.rrpCurrency,
            tradePriceCurrency: formData.tradePriceCurrency,
            images: images,
          })
        })

        if (res.ok) {
          toast.success('Item updated successfully')
          onSave?.()
        } else {
          throw new Error('Failed to update item')
        }
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  // Auto-save: debounced save for existing items (edit/view mode)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialLoadRef = useRef(true)
  const lastSavedDataRef = useRef<string>('')

  // Auto-save effect - triggers on formData or images change (for existing items only)
  useEffect(() => {
    // Skip auto-save for create mode or if no item
    if (mode === 'create' || !item?.id || !item?.roomId) {
      return
    }

    // Skip initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      // Store initial state
      lastSavedDataRef.current = JSON.stringify({ formData, images })
      return
    }

    // Check if data actually changed
    const currentData = JSON.stringify({ formData, images })
    if (currentData === lastSavedDataRef.current) {
      return
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Debounce auto-save by 1 second
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!formData.name.trim()) return // Don't save empty name

      setSaving(true)
      try {
        const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            sku: formData.sku,
            docCode: formData.docCode,
            productName: formData.productName,
            brand: formData.brand,
            supplierName: formData.supplierName,
            supplierLink: formData.supplierLink,
            supplierId: formData.supplierId || undefined,
            quantity: formData.quantity,
            unitType: formData.unitType,
            leadTime: formData.leadTime === 'none' ? null : formData.leadTime,
            color: formData.color,
            finish: formData.finish,
            material: formData.material,
            width: formData.width,
            height: formData.height,
            depth: formData.depth,
            length: formData.length,
            notes: formData.notes,
            tradePrice: formData.tradePrice ? parseFloat(formData.tradePrice) : undefined,
            rrp: formData.rrp ? parseFloat(formData.rrp) : undefined,
            tradeDiscount: formData.tradeDiscount ? parseFloat(formData.tradeDiscount) : undefined,
            markupPercent: formData.markupPercent ? parseFloat(formData.markupPercent) : undefined,
            rrpCurrency: formData.rrpCurrency,
            tradePriceCurrency: formData.tradePriceCurrency,
            images: images,
          })
        })

        if (res.ok) {
          lastSavedDataRef.current = currentData
          // Don't call onSave during auto-save - it causes full page refresh and scroll loss
          // Data is saved to DB; parent gets fresh data when panel closes or on next open
        }
      } catch (error) {
        console.error('Auto-save error:', error)
      } finally {
        setSaving(false)
      }
    }, 1000)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [formData, images, mode, item?.id, item?.roomId])

  // Reset initial load ref when panel opens with new item
  useEffect(() => {
    if (isOpen && item?.id) {
      isInitialLoadRef.current = true
      setChangingSupplier(false)
    }
  }, [isOpen, item?.id])

  // Check if form data has changed from original
  const hasChanges = useCallback(() => {
    if (!originalFormDataRef.current || !originalImagesRef.current) return false

    // Compare form data
    const orig = originalFormDataRef.current
    const formChanged = Object.keys(formData).some(key => {
      const k = key as keyof typeof formData
      return formData[k] !== orig[k]
    })

    // Compare images
    const imagesChanged = images.length !== originalImagesRef.current.length ||
      images.some((img, i) => img !== originalImagesRef.current![i])

    return formChanged || imagesChanged
  }, [formData, images])

  // Handle close with immediate save (no debounce)
  // Only save if changes were made
  const handleClose = useCallback(async () => {
    // Cancel any pending auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }

    // Skip save for create mode or if no item
    if (mode === 'create' || !item?.id || !item?.roomId) {
      onClose()
      return
    }

    // Only save if changes were made
    if (!hasChanges()) {
      onClose()
      return
    }

    // Save changes on close (if name is valid)
    if (formData.name.trim()) {
      try {
        const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            sku: formData.sku,
            docCode: formData.docCode,
            productName: formData.productName,
            brand: formData.brand,
            supplierName: formData.supplierName,
            supplierLink: formData.supplierLink,
            supplierId: formData.supplierId || undefined,
            quantity: formData.quantity,
            unitType: formData.unitType,
            leadTime: formData.leadTime === 'none' ? null : formData.leadTime,
            color: formData.color,
            finish: formData.finish,
            material: formData.material,
            width: formData.width,
            height: formData.height,
            depth: formData.depth,
            length: formData.length,
            notes: formData.notes,
            tradePrice: formData.tradePrice ? parseFloat(formData.tradePrice) : undefined,
            rrp: formData.rrp ? parseFloat(formData.rrp) : undefined,
            tradeDiscount: formData.tradeDiscount ? parseFloat(formData.tradeDiscount) : undefined,
            markupPercent: formData.markupPercent ? parseFloat(formData.markupPercent) : undefined,
            rrpCurrency: formData.rrpCurrency,
            tradePriceCurrency: formData.tradePriceCurrency,
            images: images,
          })
        })

        if (res.ok) {
          // Call onSave to refresh the list so changes appear when reopening
          onSave?.()
          return
        }
      } catch (error) {
        console.error('Save on close error:', error)
      }
    }

    onClose()
  }, [mode, item?.id, item?.roomId, formData, images, onClose, onSave, hasChanges])

  const handleSelectSupplier = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId)
    if (supplier) {
      // Store business name in supplierName, contact name separately
      // Auto-fill markup from supplier's default markup if set
      // Auto-sync currency from supplier (CAD or USD)
      const supplierCurrency = (supplier as any).currency || 'CAD'
      setFormData(prev => ({
        ...prev,
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierContactName: supplier.contactName || '',
        supplierEmail: supplier.email || '',
        supplierLogo: supplier.logo || '',
        // Auto-fill markup from supplier if not already set
        markupPercent: !prev.markupPercent && (supplier as any).markupPercent
          ? (supplier as any).markupPercent.toString()
          : prev.markupPercent,
        // Auto-sync currency from supplier - prices from this supplier are in this currency
        tradePriceCurrency: supplierCurrency,
        rrpCurrency: supplierCurrency
        // Don't overwrite supplierLink (Product URL) - that's separate from supplier's website
      }))
      setChangingSupplier(false) // Close the supplier selector
    }
  }
  
  if (!isOpen) return null
  
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={handleClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[600px] max-w-[98vw] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300 overflow-x-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {/* Navigation Arrows */}
            {(hasNext || hasPrev) && (
              <div className="flex flex-col gap-0.5">
                <button 
                  onClick={() => onNavigate?.('prev')}
                  disabled={!hasPrev}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onNavigate?.('next')}
                  disabled={!hasNext}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <h2 className="text-lg font-semibold text-gray-900 truncate max-w-[300px]">
              {mode === 'create' ? 'Add New Item' : formData.name || 'Item Details'}
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            {formData.supplierLink && (
              <a 
                href={formData.supplierLink}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600"
                title="Open product link"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-5 overflow-x-auto">
          {['Summary', 'Financial', 'Attachments', 'Activity', 'Approvals'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase())}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                activeTab === tab.toLowerCase()
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        
        {/* Content */}
        <ScrollArea className="flex-1 overflow-x-hidden">
          <div className="p-5 space-y-6 overflow-x-hidden">
            {activeTab === 'summary' && (
              <>
                {/* Image Upload - supports up to 10 images */}
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                  <div className="space-y-3">
                    {/* Image Grid */}
                    {images.filter(img => img && img.trim()).length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {images.filter(img => img && img.trim()).map((img, idx) => (
                          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border group">
                            <img src={img} alt="" className="w-full h-full object-cover" />
                            <button
                              onClick={() => setImages(images.filter((_, i) => i !== idx))}
                              className="absolute top-1 right-1 p-1 bg-white/80 rounded-full hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            {idx === 0 && (
                              <span className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 bg-emerald-500 text-white rounded font-medium">
                                Main
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Upload Area */}
                    {images.filter(img => img && img.trim()).length < MAX_IMAGES && (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={cn(
                          "border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
                          isDragging
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                        )}
                      >
                        {uploadingImage ? (
                          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500">
                              Drag & drop or <span className="text-blue-600 hover:underline">browse files</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {images.filter(img => img && img.trim()).length}/{MAX_IMAGES} images
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* FFE Linked Items - Show all linked FFE items (many-to-many) */}
                {mode !== 'create' && item?.linkedFfeItems && item.linkedFfeItems.length > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="space-y-2">
                      <p className="text-xs text-blue-600 font-medium">
                        Linked FFE Items ({item.linkedFfeItems.length})
                      </p>
                      <div className="space-y-1.5">
                        {item.linkedFfeItems.map((ffeItem) => (
                          <div key={ffeItem.linkId} className="flex items-center justify-between bg-white rounded-md p-2 border border-blue-100">
                            <div>
                              <p className="text-sm font-medium text-blue-900">{ffeItem.ffeItemName}</p>
                              <p className="text-xs text-gray-500">{ffeItem.roomName} · {ffeItem.sectionName}</p>
                            </div>
                            {projectId && (
                              <a
                                href={`/ffe/${ffeItem.roomId}/workspace?highlight=${ffeItem.ffeItemId}`}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Legacy FFE Requirement Link - Fallback for old one-to-one links */}
                {mode !== 'create' && (!item?.linkedFfeItems || item.linkedFfeItems.length === 0) && item?.ffeRequirementId && item?.ffeRequirementName && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-blue-600 font-medium mb-0.5">FFE Requirement</p>
                        <p className="text-sm font-medium text-blue-900">{item.ffeRequirementName}</p>
                      </div>
                      {projectId && item.roomId && (
                        <a
                          href={`/ffe/${item.roomId}/workspace?highlight=${item.ffeRequirementId}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-white rounded-md border border-blue-200 hover:border-blue-300 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View in FFE
                        </a>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Item Name & Product */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Item Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Kitchen Faucet"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Product</Label>
                    <Input
                      value={formData.productName}
                      onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                      placeholder="e.g., Kohler K-560-VS"
                    />
                    <p className="text-[10px] text-gray-400">Specific product model or name</p>
                  </div>
                </div>
                
                {/* Description & Doc Code */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Doc Code
                      {checkingDocCode && (
                        <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                      )}
                    </Label>
                    <Input
                      value={formData.docCode}
                      onChange={(e) => setFormData({ ...formData, docCode: e.target.value })}
                      placeholder="Document code"
                      className={cn(
                        docCodeDuplicateWarning && "border-amber-400 focus:ring-amber-200"
                      )}
                    />
                    {docCodeDuplicateWarning && (
                      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2 space-y-1">
                        <p className="font-medium">Duplicate code found:</p>
                        {docCodeDuplicateWarning.duplicates.slice(0, 2).map((dup) => (
                          <p key={dup.id} className="text-amber-700">
                            • {dup.name} ({dup.roomName})
                          </p>
                        ))}
                        {docCodeDuplicateWarning.duplicates.length > 2 && (
                          <p className="text-amber-500">+{docCodeDuplicateWarning.duplicates.length - 2} more</p>
                        )}
                        <p className="text-amber-500 italic">You can still use this code if needed.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Components Section */}
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-600" />
                      <Label className="text-sm font-medium text-gray-900">Components</Label>
                      {components.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {components.length}
                        </Badge>
                      )}
                    </div>
                    {componentsTotal > 0 && (
                      <span className="text-sm font-medium text-gray-700">
                        Total: ${componentsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Add sub-items like transformers, mounting brackets, etc. Component prices are added to the item total.</p>

                  {/* Existing Components */}
                  {components.length > 0 && (
                    <div className="space-y-2">
                      {components.map((comp) => (
                        <div key={comp.id} className="p-3 bg-white rounded-lg border border-gray-200">
                          <div className="flex items-start gap-3">
                            {/* Component Image */}
                            <div className="flex-shrink-0">
                              {comp.image ? (
                                <img src={comp.image} alt={comp.name} className="w-10 h-10 rounded object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                                  <Package className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                            </div>

                            {/* Component Info - takes remaining space */}
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className="text-sm font-medium text-gray-900 break-words">{comp.name}</p>
                              {comp.modelNumber && (
                                <p className="text-xs text-gray-500 truncate">{comp.modelNumber}</p>
                              )}
                            </div>

                            {/* Actions - fixed width, always visible */}
                            <div className="flex-shrink-0 flex items-center gap-1">
                              <button
                                onClick={() => setEditingComponent(comp)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit component"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteComponent(comp.id)}
                                disabled={savingComponent}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                title="Delete component"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Price row - separate line */}
                          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              Qty: {comp.quantity || 1} {comp.price ? `× $${comp.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                            </span>
                            {comp.price ? (
                              <span className="text-sm font-medium text-gray-900">
                                ${(comp.price * (comp.quantity || 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">No price</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Component Form */}
                  {showAddComponent ? (
                    <div className="p-3 bg-white rounded-lg border border-blue-200 space-y-3">
                      <input
                        ref={componentImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleComponentImageUpload(e.target.files)}
                      />

                      <div className="flex gap-3">
                        {/* Image Upload */}
                        <div
                          onClick={() => componentImageInputRef.current?.click()}
                          className="w-16 h-16 rounded border-2 border-dashed border-gray-300 hover:border-blue-400 cursor-pointer flex items-center justify-center bg-gray-50 hover:bg-blue-50 transition-colors overflow-hidden"
                        >
                          {uploadingComponentImage ? (
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                          ) : newComponent.image ? (
                            <img src={newComponent.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-gray-400" />
                          )}
                        </div>

                        <div className="flex-1 space-y-2">
                          <Input
                            value={newComponent.name}
                            onChange={(e) => setNewComponent(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Component name *"
                            className="h-8 text-sm"
                          />
                          <Input
                            value={newComponent.modelNumber}
                            onChange={(e) => setNewComponent(prev => ({ ...prev, modelNumber: e.target.value }))}
                            placeholder="Model number (optional)"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-gray-500">Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={newComponent.price}
                            onChange={(e) => setNewComponent(prev => ({ ...prev, price: e.target.value }))}
                            placeholder="0.00"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            value={newComponent.quantity}
                            onChange={(e) => setNewComponent(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowAddComponent(false)
                            setNewComponent({ name: '', modelNumber: '', price: '', quantity: 1, image: '' })
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAddComponent}
                          disabled={savingComponent || !newComponent.name.trim()}
                        >
                          {savingComponent ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            'Add Component'
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddComponent(true)}
                      className="w-full border-dashed"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Component
                    </Button>
                  )}
                </div>

                {/* Edit Component Dialog */}
                {editingComponent && (
                  <Dialog open={!!editingComponent} onOpenChange={() => setEditingComponent(null)}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Edit Component</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {/* Image Section */}
                        <div className="space-y-2">
                          <Label>Image</Label>
                          <input
                            ref={editComponentImageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleEditComponentImageUpload(e.target.files)}
                          />
                          <div className="flex items-center gap-3">
                            <div
                              onClick={() => editComponentImageInputRef.current?.click()}
                              className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 cursor-pointer flex items-center justify-center bg-gray-50 hover:bg-blue-50 transition-colors overflow-hidden"
                            >
                              {uploadingEditComponentImage ? (
                                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                              ) : editingComponent.image ? (
                                <img src={editingComponent.image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="w-6 h-6 text-gray-400" />
                              )}
                            </div>
                            <div className="flex flex-col gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => editComponentImageInputRef.current?.click()}
                                disabled={uploadingEditComponentImage}
                              >
                                {editingComponent.image ? 'Change Image' : 'Upload Image'}
                              </Button>
                              {editingComponent.image && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setEditingComponent({ ...editingComponent, image: null })}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Remove Image
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={editingComponent.name}
                            onChange={(e) => setEditingComponent({ ...editingComponent, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Model Number</Label>
                          <Input
                            value={editingComponent.modelNumber || ''}
                            onChange={(e) => setEditingComponent({ ...editingComponent, modelNumber: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Price</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingComponent.price || ''}
                              onChange={(e) => setEditingComponent({ ...editingComponent, price: e.target.value ? parseFloat(e.target.value) : null })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              min="1"
                              value={editingComponent.quantity}
                              onChange={(e) => setEditingComponent({ ...editingComponent, quantity: parseInt(e.target.value) || 1 })}
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingComponent(null)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleUpdateComponent(editingComponent)}
                          disabled={savingComponent}
                        >
                          {savingComponent ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save Changes'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                {/* FFE Linking Section - Step by Step */}
                {mode === 'create' && ffeItems.length > 0 && (
                  <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-blue-600" />
                      <Label className="text-sm font-medium text-blue-900">Link to FFE Workspace Item *</Label>
                    </div>
                    <p className="text-xs text-blue-700">Select the FFE item this product fulfills.</p>
                    
                    {ffeItemsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading FFE items...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Step 1: Select Room */}
                        {!selectedFfeRoom && !initialFfeRoomId && (
                          <Select value={selectedFfeRoom} onValueChange={(v) => {
                            setSelectedFfeRoom(v)
                            setSelectedFfeSection('')
                            setSelectedFfeItemId('')
                            setShowAlreadyChosenWarning(false)
                          }}>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Select room..." />
                            </SelectTrigger>
                            <SelectContent>
                              {ffeItems.map(room => (
                                <SelectItem key={room.roomId} value={room.roomId}>
                                  {room.roomName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {/* Step 2: Show selected room + Section dropdown */}
                        {(selectedFfeRoom || initialFfeRoomId) && !(selectedFfeSection || initialFfeSectionId) && (
                          <>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-500">Room:</span>
                              <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => {
                                setSelectedFfeRoom('')
                                setSelectedFfeSection('')
                                setSelectedFfeItemId('')
                                setShowAlreadyChosenWarning(false)
                              }}>
                                {ffeItems.find(r => r.roomId === (selectedFfeRoom || initialFfeRoomId))?.roomName}
                                <X className="w-3 h-3 ml-1" />
                              </Badge>
                            </div>
                            <Select value={selectedFfeSection} onValueChange={(v) => {
                              setSelectedFfeSection(v)
                              setSelectedFfeItemId('')
                              setShowAlreadyChosenWarning(false)
                            }}>
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Select category..." />
                              </SelectTrigger>
                              <SelectContent>
                                {filteredFfeSections.map(section => (
                                  <SelectItem key={section.sectionId} value={section.sectionId}>
                                    {section.sectionName} ({section.items.length} items)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        
                        {/* Step 3: Show selected room + section + Item dropdown */}
                        {(selectedFfeRoom || initialFfeRoomId) && (selectedFfeSection || initialFfeSectionId) && !(selectedFfeItemId || initialFfeItemId) && (
                          <>
                            <div className="flex items-center gap-2 text-sm flex-wrap">
                              <span className="text-gray-500">Room:</span>
                              <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => {
                                setSelectedFfeRoom('')
                                setSelectedFfeSection('')
                                setSelectedFfeItemId('')
                                setShowAlreadyChosenWarning(false)
                              }}>
                                {ffeItems.find(r => r.roomId === (selectedFfeRoom || initialFfeRoomId))?.roomName}
                                <X className="w-3 h-3 ml-1" />
                              </Badge>
                              <span className="text-gray-500">Category:</span>
                              <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200" onClick={() => {
                                setSelectedFfeSection('')
                                setSelectedFfeItemId('')
                                setShowAlreadyChosenWarning(false)
                              }}>
                                {filteredFfeSections.find(s => s.sectionId === (selectedFfeSection || initialFfeSectionId))?.sectionName}
                                <X className="w-3 h-3 ml-1" />
                              </Badge>
                            </div>
                            <Select value={selectedFfeItemId} onValueChange={(v) => {
                              setSelectedFfeItemId(v)
                              const item = filteredFfeItemsList.find(i => i.id === v)
                              setShowAlreadyChosenWarning(item?.hasLinkedSpecs || false)
                            }}>
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Select item..." />
                              </SelectTrigger>
                              <SelectContent>
                                {filteredFfeItemsList.map(item => (
                                  <SelectItem key={item.id} value={item.id}>
                                    <div className="flex items-center gap-2">
                                      {item.hasLinkedSpecs ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                      ) : (
                                        <Circle className="w-3.5 h-3.5 text-gray-300" />
                                      )}
                                      <span>{item.name}</span>
                                      {item.hasLinkedSpecs && (
                                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">
                                          {item.linkedSpecsCount}
                                        </Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        
                        {/* Final: Show all selections with confirmation */}
                        {selectedFfeItem && (
                          <div className={cn(
                            "p-3 rounded-lg border text-sm",
                            showAlreadyChosenWarning 
                              ? "bg-amber-50 border-amber-200" 
                              : "bg-emerald-50 border-emerald-200"
                          )}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {showAlreadyChosenWarning ? (
                                  <AlertCircle className="w-4 h-4 text-amber-600" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                )}
                                <span className={showAlreadyChosenWarning ? "text-amber-800" : "text-emerald-800"}>
                                  {showAlreadyChosenWarning 
                                    ? `"${selectedFfeItem.itemName}" already has ${selectedFfeItem.linkedSpecsCount} product(s). This will be added as Option #${selectedFfeItem.linkedSpecsCount + 1}.`
                                    : `${selectedFfeItem.roomName} > ${selectedFfeItem.sectionName} > ${selectedFfeItem.itemName}`
                                  }
                                </span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  setSelectedFfeRoom('')
                                  setSelectedFfeSection('')
                                  setSelectedFfeItemId('')
                                  setShowAlreadyChosenWarning(false)
                                }}
                                className="text-xs text-gray-500 hover:text-gray-700 underline"
                              >
                                Change
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Quantity & Unit Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Type</Label>
                    <Select value={formData.unitType} onValueChange={(v) => setFormData({ ...formData, unitType: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit..." />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_TYPE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Brand & Lead Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Brand</Label>
                    <Input
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="Brand name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lead Time</Label>
                    <Select value={formData.leadTime} onValueChange={(v) => setFormData({ ...formData, leadTime: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="-" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_TIME_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Model */}
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="Model number"
                  />
                </div>
                
                {/* Product URL */}
                <div className="space-y-2">
                  <Label>Product URL</Label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      value={formData.supplierLink}
                      onChange={(e) => setFormData({ ...formData, supplierLink: e.target.value })}
                      placeholder="https://..."
                      className="pl-9"
                    />
                  </div>
                </div>
                
                {/* Supplier */}
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  {/* Show current supplier if selected and not changing */}
                  {formData.supplierName && !changingSupplier && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                      {/* Logo or Initial */}
                      {formData.supplierLogo ? (
                        <img
                          src={formData.supplierLogo}
                          alt={formData.supplierName}
                          className="w-10 h-10 rounded-lg object-cover border"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold">
                          {formData.supplierName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{formData.supplierName}</p>
                        {/* Contact Name and Email */}
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                          {formData.supplierContactName && (
                            <span className="truncate">{formData.supplierContactName}</span>
                          )}
                          {formData.supplierContactName && formData.supplierEmail && (
                            <span>•</span>
                          )}
                          {formData.supplierEmail && (
                            <a
                              href={`mailto:${formData.supplierEmail}`}
                              className="text-blue-600 hover:underline truncate"
                            >
                              {formData.supplierEmail}
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => setChangingSupplier(true)}
                        >
                          Change
                        </button>
                        <button
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => setFormData({ ...formData, supplierName: '', supplierId: '', supplierContactName: '', supplierEmail: '', supplierLogo: '' })}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Show supplier selector when changing or no supplier */}
                  {(changingSupplier || !formData.supplierName) && (
                    <div className="space-y-2">
                      {changingSupplier && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500">Select new supplier:</span>
                          <button
                            className="text-xs text-gray-500 hover:text-gray-700"
                            onClick={() => setChangingSupplier(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      <Select onValueChange={handleSelectSupplier}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose from phonebook..." />
                        </SelectTrigger>
                        <SelectContent>
                          {loadingSuppliers ? (
                            <div className="flex items-center justify-center p-4">
                              <Loader2 className="w-4 h-4 animate-spin" />
                            </div>
                          ) : suppliers.length === 0 ? (
                            <div className="text-center p-4 text-sm text-gray-500">
                              No suppliers in phonebook
                            </div>
                          ) : (
                            suppliers.map(supplier => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                <div className="flex items-center gap-2">
                                  {supplier.logo ? (
                                    <img src={supplier.logo} alt={supplier.name} className="w-6 h-6 rounded object-cover" />
                                  ) : (
                                    <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs font-medium">
                                      {supplier.name.charAt(0)}
                                    </div>
                                  )}
                                  <div className="flex flex-col">
                                    <span className="font-medium">{supplier.name}</span>
                                    {(supplier.contactName || supplier.email) && (
                                      <span className="text-xs text-gray-400">
                                        {supplier.contactName}{supplier.contactName && supplier.email ? ' • ' : ''}{supplier.email}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <button 
                        onClick={() => setShowAddSupplier(true)}
                        className="w-full text-sm text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1.5 py-2 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                        Add New Supplier to Phonebook
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Internal notes about this item..."
                    rows={3}
                  />
                </div>
                
                {/* Product Specifications */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Product Specifications</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Height</Label>
                      <Input
                        value={formData.height}
                        onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Depth</Label>
                      <Input
                        value={formData.depth}
                        onChange={(e) => setFormData({ ...formData, depth: e.target.value })}
                        placeholder="-"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Width</Label>
                      <Input
                        value={formData.width}
                        onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Length</Label>
                      <Input
                        value={formData.length}
                        onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                        placeholder="-"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Colour</Label>
                      <Input
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Finish</Label>
                      <Input
                        value={formData.finish}
                        onChange={(e) => setFormData({ ...formData, finish: e.target.value })}
                        placeholder="-"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Material</Label>
                    <Input
                      value={formData.material}
                      onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                      placeholder="-"
                    />
                  </div>
                </div>
              </>
            )}
            
            {activeTab === 'financial' && (
              <div className="space-y-6">
                {/* Currency Selector - Prominent at top */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Currency</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, rrpCurrency: 'CAD', tradePriceCurrency: 'CAD' })}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all flex items-center justify-center gap-2",
                        formData.rrpCurrency === 'CAD'
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-gray-200 hover:border-gray-300 text-gray-600"
                      )}
                    >
                      🇨🇦 CAD
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, rrpCurrency: 'USD', tradePriceCurrency: 'USD' })}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all flex items-center justify-center gap-2",
                        formData.rrpCurrency === 'USD'
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 hover:border-gray-300 text-gray-600"
                      )}
                    >
                      🇺🇸 USD
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Select the currency for this item's pricing</p>
                </div>

                {/* Trade Price Row */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Trade Price ({formData.tradePriceCurrency})</Label>
                    <button
                      type="button"
                      onClick={() => {
                        // Toggle between unit price and total input mode
                        const currentTotal = (parseFloat(formData.tradePrice) || 0) * (formData.quantity || 1)
                        const totalInput = document.getElementById('trade-total-input') as HTMLInputElement
                        if (totalInput) {
                          totalInput.value = currentTotal > 0 ? currentTotal.toFixed(2) : ''
                          totalInput.focus()
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Enter quote total
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.tradePrice}
                        onChange={(e) => {
                          const newTradePrice = e.target.value
                          const rrp = parseFloat(formData.rrp) || 0

                          // Auto-calculate markup if RRP exists
                          if (rrp > 0 && newTradePrice) {
                            const tradePriceValue = parseFloat(newTradePrice)
                            const calculatedMarkup = ((rrp - tradePriceValue) / tradePriceValue * 100).toFixed(0)
                            setFormData({ ...formData, tradePrice: newTradePrice, markupPercent: calculatedMarkup })
                          } else {
                            setFormData({ ...formData, tradePrice: newTradePrice })
                          }
                        }}
                        placeholder="0.00"
                        className="pl-7"
                      />
                    </div>
                    {/* Quote Total Input - divides by quantity */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 whitespace-nowrap">or total:</span>
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <Input
                          id="trade-total-input"
                          type="number"
                          step="0.01"
                          placeholder={`Total ÷ ${formData.quantity || 1} qty`}
                          className="pl-6 h-8 text-sm"
                          onChange={(e) => {
                            const total = parseFloat(e.target.value) || 0
                            const qty = formData.quantity || 1
                            const unitPrice = (total / qty).toFixed(2)
                            const rrp = parseFloat(formData.rrp) || 0

                            // Auto-calculate markup if RRP exists
                            if (rrp > 0 && unitPrice) {
                              const tradePriceValue = parseFloat(unitPrice)
                              const calculatedMarkup = ((rrp - tradePriceValue) / tradePriceValue * 100).toFixed(0)
                              setFormData({ ...formData, tradePrice: unitPrice, markupPercent: calculatedMarkup })
                            } else {
                              setFormData({ ...formData, tradePrice: unitPrice })
                            }
                          }}
                        />
                      </div>
                    </div>
                    {formData.quantity > 1 && formData.tradePrice && (
                      <p className="text-xs text-gray-500">
                        Total: ${((parseFloat(formData.tradePrice) || 0) * formData.quantity).toFixed(2)} ({formData.quantity} × ${formData.tradePrice})
                      </p>
                    )}
                  </div>
                </div>

                {/* Markup & Discount Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Markup %</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="1"
                        value={formData.markupPercent}
                        onChange={(e) => {
                          const newMarkup = e.target.value
                          const tradePrice = parseFloat(formData.tradePrice) || 0

                          // Auto-calculate RRP from trade price + markup
                          if (tradePrice > 0 && newMarkup) {
                            const markupValue = parseFloat(newMarkup)
                            const calculatedRrp = (tradePrice * (1 + markupValue / 100)).toFixed(2)
                            setFormData({ ...formData, markupPercent: newMarkup, rrp: calculatedRrp })
                          } else {
                            setFormData({ ...formData, markupPercent: newMarkup })
                          }
                        }}
                        placeholder="0"
                        className="pr-7"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                    <p className="text-[10px] text-gray-400">Enter markup to calculate RRP from trade</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Trade Discount %</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="1"
                        value={formData.tradeDiscount}
                        onChange={(e) => {
                          const newDiscount = e.target.value
                          const rrp = parseFloat(formData.rrp) || 0

                          // Auto-calculate trade price from RRP - discount
                          if (rrp > 0 && newDiscount) {
                            const discountValue = parseFloat(newDiscount)
                            const calculatedTradePrice = (rrp * (1 - discountValue / 100)).toFixed(2)
                            setFormData({ ...formData, tradeDiscount: newDiscount, tradePrice: calculatedTradePrice })
                          } else {
                            setFormData({ ...formData, tradeDiscount: newDiscount })
                          }
                        }}
                        placeholder="0"
                        className="pr-7"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                    <p className="text-[10px] text-gray-400">Enter discount to calculate trade from RRP</p>
                  </div>
                </div>

                {/* RRP Row */}
                <div className="space-y-2">
                  <Label>RRP ({formData.rrpCurrency})</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.rrp}
                      onChange={(e) => {
                        const newRrp = e.target.value
                        const tradePrice = parseFloat(formData.tradePrice) || 0
                        const discount = parseFloat(formData.tradeDiscount) || 0

                        // Auto-calculate trade price if discount is set
                        if (discount > 0 && newRrp) {
                          const calculatedTradePrice = (parseFloat(newRrp) * (1 - discount / 100)).toFixed(2)
                          setFormData({ ...formData, rrp: newRrp, tradePrice: calculatedTradePrice })
                        }
                        // Auto-calculate markup if trade price exists
                        else if (tradePrice > 0 && newRrp) {
                          const rrpValue = parseFloat(newRrp)
                          const calculatedMarkup = ((rrpValue - tradePrice) / tradePrice * 100).toFixed(0)
                          setFormData({ ...formData, rrp: newRrp, markupPercent: calculatedMarkup })
                        } else {
                          setFormData({ ...formData, rrp: newRrp })
                        }
                      }}
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                </div>

                {/* Quantity Row */}
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>

                {/* Trade Price TOTAL Section - includes components */}
                {(parseFloat(formData.tradePrice) > 0 || componentsTotal > 0) && (
                  <div className="bg-blue-50 rounded-lg p-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-blue-700 font-medium">TRADE TOTAL</span>
                      <span className="font-semibold text-xl text-blue-600">
                        ${(((parseFloat(formData.tradePrice) || 0) * (formData.quantity || 1)) + componentsTotal).toFixed(2)}
                        <span className="text-sm text-gray-500 ml-1">{formData.tradePriceCurrency}</span>
                      </span>
                    </div>
                    {/* Breakdown */}
                    <div className="text-xs text-blue-600/70 text-right mt-2 space-y-0.5">
                      {formData.tradePrice && parseFloat(formData.tradePrice) > 0 && (
                        <p>Item: ${parseFloat(formData.tradePrice).toFixed(2)} × {formData.quantity || 1} = ${((parseFloat(formData.tradePrice) || 0) * (formData.quantity || 1)).toFixed(2)}</p>
                      )}
                      {components.length > 0 && components.map(comp => (
                        comp.price ? (
                          <p key={comp.id}>
                            {comp.name}: ${Number(comp.price).toFixed(2)} × {comp.quantity || 1} = ${(Number(comp.price) * (comp.quantity || 1)).toFixed(2)}
                          </p>
                        ) : null
                      ))}
                    </div>
                  </div>
                )}

                {/* RRP TOTAL Section - includes components with markup */}
                <div className="bg-emerald-50 rounded-lg p-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-700 font-medium">RRP TOTAL</span>
                    {(() => {
                      const markupPercent = parseFloat(formData.markupPercent) || 0
                      const itemRrp = (parseFloat(formData.rrp) || 0) * (formData.quantity || 1)
                      // Apply markup to components as well
                      const componentsRrp = componentsTotal * (1 + markupPercent / 100)
                      const total = itemRrp + componentsRrp
                      return (
                        <span className={cn(
                          "font-semibold text-xl",
                          formData.rrpCurrency === 'USD' ? "text-blue-600" : "text-emerald-600"
                        )}>
                          ${total.toFixed(2)}
                          <span className="text-sm text-gray-500 ml-1">{formData.rrpCurrency}</span>
                        </span>
                      )
                    })()}
                  </div>
                  {/* Breakdown */}
                  <div className="text-xs text-emerald-600/70 text-right mt-2 space-y-0.5">
                    {formData.rrp && parseFloat(formData.rrp) > 0 && (
                      <p>Item: ${parseFloat(formData.rrp).toFixed(2)} × {formData.quantity || 1} = ${((parseFloat(formData.rrp) || 0) * (formData.quantity || 1)).toFixed(2)}</p>
                    )}
                    {components.length > 0 && (() => {
                      const markupPercent = parseFloat(formData.markupPercent) || 0
                      return components.map(comp => {
                        if (!comp.price) return null
                        const compUnitPrice = Number(comp.price)
                        const compQty = comp.quantity || 1
                        const compTradeTotal = compUnitPrice * compQty
                        const compUnitRrp = compUnitPrice * (1 + markupPercent / 100)
                        const compRrpTotal = compTradeTotal * (1 + markupPercent / 100)
                        return (
                          <p key={comp.id}>
                            {comp.name}: ${compUnitRrp.toFixed(2)} × {compQty} = ${compRrpTotal.toFixed(2)} {markupPercent > 0 && `(+${markupPercent}%)`}
                          </p>
                        )
                      })
                    })()}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'attachments' && (
              <div className="space-y-4">
                {/* Hidden file input for documents - allows multiple */}
                <input
                  ref={documentInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif,.dwg,.dxf"
                  className="hidden"
                  multiple
                  onChange={(e) => {
                    handleDocumentFileSelect(e.target.files)
                    e.target.value = '' // Reset input
                  }}
                />

                {/* Header with upload button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Documents</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Spec sheets, quotes, invoices & receipts
                    </p>
                  </div>
                  {mode !== 'create' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => documentInputRef.current?.click()}
                      disabled={uploadingDocument}
                      className="gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </Button>
                  )}
                </div>

                {/* Pending files - show type selector */}
                {pendingDocumentFiles.length > 0 && (
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
                    {/* List of pending files */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-gray-700">
                          {pendingDocumentFiles.length} file{pendingDocumentFiles.length > 1 ? 's' : ''} selected
                        </Label>
                        <button
                          onClick={() => documentInputRef.current?.click()}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          + Add more
                        </button>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1.5">
                        {pendingDocumentFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white rounded px-2 py-1.5 border border-blue-100">
                            <div className="flex items-center gap-2 min-w-0">
                              <File className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              <span className="text-sm text-gray-900 truncate">
                                {file.name}
                              </span>
                              <span className="text-xs text-gray-500 flex-shrink-0">
                                ({formatFileSize(file.size)})
                              </span>
                            </div>
                            <button
                              onClick={() => removePendingFile(index)}
                              className="p-0.5 hover:bg-red-100 rounded"
                              title="Remove file"
                            >
                              <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Type (applies to all files)</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {defaultDocumentTypes.map((type) => (
                          <button
                            key={type.id}
                            onClick={() => {
                              setSelectedDocumentType(type.id)
                              if (type.id !== 'Other') setCustomDocumentType('')
                            }}
                            className={cn(
                              "py-1.5 px-3 rounded-full border text-xs font-medium transition-all",
                              selectedDocumentType === type.id
                                ? type.color === 'blue' ? "border-blue-500 bg-blue-100 text-blue-700"
                                : type.color === 'purple' ? "border-purple-500 bg-purple-100 text-purple-700"
                                : type.color === 'green' ? "border-green-500 bg-green-100 text-green-700"
                                : type.color === 'emerald' ? "border-emerald-500 bg-emerald-100 text-emerald-700"
                                : type.color === 'orange' ? "border-orange-500 bg-orange-100 text-orange-700"
                                : "border-gray-500 bg-gray-100 text-gray-700"
                                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                            )}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                      {selectedDocumentType === 'Other' && (
                        <Input
                          value={customDocumentType}
                          onChange={(e) => setCustomDocumentType(e.target.value)}
                          placeholder="Enter custom type (e.g., Customs, Duties)"
                          className="mt-2 text-sm h-9"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">Note (optional, applies to all)</Label>
                      <Textarea
                        value={documentNote}
                        onChange={(e) => setDocumentNote(e.target.value)}
                        placeholder="Add a note about these documents..."
                        className="h-16 text-sm resize-none bg-white"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelDocumentUpload}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleDocumentUpload}
                        disabled={uploadingDocument}
                        size="sm"
                        className="flex-1"
                      >
                        {uploadingDocument ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-1.5" />
                            Upload {pendingDocumentFiles.length > 1 ? `${pendingDocumentFiles.length} files` : ''}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {mode === 'create' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-700">
                      Save the item first to upload documents.
                    </p>
                  </div>
                )}

                {/* Loading state */}
                {loadingDocuments && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                )}

                {/* Documents list grouped by type */}
                {!loadingDocuments && documents.length > 0 && (
                  <div className="space-y-3">
                    {/* Group documents by type */}
                    {['SUPPLIER_QUOTE', 'DRAWING', 'INVOICE', 'RECEIPT', 'SHIPPING_DOC', 'OTHER'].map(docType => {
                      const knownTypes = ['SUPPLIER_QUOTE', 'DRAWING', 'INVOICE', 'RECEIPT', 'SHIPPING_DOC']
                      const typeDocs = documents.filter(d =>
                        docType === 'OTHER'
                          ? !knownTypes.includes(d.type)
                          : d.type === docType
                      )
                      if (typeDocs.length === 0) return null

                      const typeLabel = docType === 'DRAWING' ? 'Spec Sheets'
                        : docType === 'SUPPLIER_QUOTE' ? 'Quotes'
                        : docType === 'INVOICE' ? 'Invoices'
                        : docType === 'RECEIPT' ? 'Receipts'
                        : docType === 'SHIPPING_DOC' ? 'Shipping'
                        : 'Other'
                      const typeColor = docType === 'DRAWING' ? 'bg-purple-100 text-purple-700 border-purple-200'
                        : docType === 'SUPPLIER_QUOTE' ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : docType === 'INVOICE' ? 'bg-green-100 text-green-700 border-green-200'
                        : docType === 'RECEIPT' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : docType === 'SHIPPING_DOC' ? 'bg-orange-100 text-orange-700 border-orange-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'

                      return (
                        <div key={docType} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", typeColor)}>
                              {typeLabel}
                            </span>
                            <span className="text-xs text-gray-400">{typeDocs.length}</span>
                          </div>
                          <div className="space-y-1.5">
                            {typeDocs.map(doc => {
                              const FileIcon = getFileIcon(doc.mimeType, doc.fileName)
                              const uploadDate = new Date(doc.createdAt)
                              const dateStr = uploadDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })
                              return (
                                <div
                                  key={doc.id}
                                  className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 group hover:bg-white hover:border-gray-300 transition-all"
                                >
                                  {/* Document info row */}
                                  <div className="flex items-start gap-2">
                                    <div className="w-8 h-8 rounded bg-white border flex items-center justify-center flex-shrink-0">
                                      <FileIcon className="w-4 h-4 text-gray-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 break-words">
                                        {doc.title || doc.fileName}
                                      </p>
                                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                                        <span>{dateStr}</span>
                                        <span className="text-gray-300">•</span>
                                        <span>{formatFileSize(doc.fileSize)}</span>
                                      </div>
                                      {doc.description && (
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 italic">
                                          {doc.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {/* Action buttons row */}
                                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
                                    {doc.fileUrl && !doc.fileUrl.startsWith('dropbox:') && (
                                      <a
                                        href={doc.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded border border-blue-200 flex items-center gap-1"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        Open
                                      </a>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleEditDocument(doc)
                                      }}
                                      className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-200 flex items-center gap-1"
                                    >
                                      <Edit className="w-3 h-3" />
                                      Edit
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteDocument(doc.id)
                                      }}
                                      disabled={deletingDocumentId === doc.id}
                                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200 flex items-center gap-1 disabled:opacity-50"
                                    >
                                      {deletingDocumentId === doc.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-3 h-3" />
                                      )}
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Empty state */}
                {!loadingDocuments && documents.length === 0 && mode !== 'create' && pendingDocumentFiles.length === 0 && (
                  <div
                    onClick={() => documentInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm font-medium text-gray-600">No documents yet</p>
                    <p className="text-xs text-gray-400 mt-1">Click to upload spec sheets, quotes, or invoices</p>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'activity' && (
              <ActivityTab itemId={item?.id} roomId={item?.roomId || roomId} mode={mode} specStatus={item?.specStatus} />
            )}

            {activeTab === 'approvals' && (
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-4">Client Approval</h4>
                {item?.clientApproved ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-emerald-800">Approved by Client</p>
                        <p className="text-xs text-emerald-600">
                          {item.clientApprovedAt
                            ? new Date(item.clientApprovedAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Date not recorded'}
                          {item.clientApprovedVia === 'share_link' ? ' • via Share Link' :
                           item.clientApprovedVia === 'budget_quote' ? ' • via Budget Approval' :
                           ' • Manually'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={async () => {
                        if (!item?.id || !item?.roomId) return
                        try {
                          const res = await fetch(`/api/ffe/v2/rooms/${item.roomId}/items/${item.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              clientApproved: false
                            })
                          })
                          if (res.ok) {
                            toast.success('Approval removed')
                            onClose()
                          } else {
                            toast.error('Failed to remove approval')
                          }
                        } catch (err) {
                          toast.error('Failed to remove approval')
                        }
                      }}
                    >
                      Remove Approval
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <Clock className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Pending Approval</p>
                      <p className="text-xs text-gray-500">Client has not yet approved this item</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500">
            {item?.roomName && <span>{item.roomName}</span>}
            {item?.sectionName && <span> / {item.sectionName}</span>}
          </div>
          {saving && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </div>
          )}
        </div>
      </div>
      
      {/* Add New Supplier Modal */}
      <Dialog open={showAddSupplier} onOpenChange={(open) => {
        if (open) {
          loadSupplierCategories()
        }
        setShowAddSupplier(open)
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              Add New Supplier
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Category Selection */}
            <div className="space-y-2">
              <Label>Category</Label>
              {loadingSupplierCategories ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {supplierCategories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNewSupplier({ ...newSupplier, categoryId: cat.id })}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                        newSupplier.categoryId === cat.id
                          ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Currency Selection */}
            <div className="space-y-2">
              <Label>Currency</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewSupplier({ ...newSupplier, currency: 'CAD' })}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium text-sm transition-all ${
                    newSupplier.currency === 'CAD'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  🇨🇦 CAD
                </button>
                <button
                  type="button"
                  onClick={() => setNewSupplier({ ...newSupplier, currency: 'USD' })}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium text-sm transition-all ${
                    newSupplier.currency === 'USD'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  🇺🇸 USD
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Business Name <span className="text-red-500">*</span></Label>
              <Input
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                placeholder="Company name"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Contact Name <span className="text-red-500">*</span></Label>
              <Input
                value={newSupplier.contactName}
                onChange={(e) => setNewSupplier({ ...newSupplier, contactName: e.target.value })}
                placeholder="Contact person"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input
                type="email"
                value={newSupplier.email}
                onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                placeholder="supplier@example.com"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={newSupplier.website}
                  onChange={(e) => setNewSupplier({ ...newSupplier, website: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={newSupplier.address}
                onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                placeholder="Optional"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={newSupplier.notes}
                onChange={(e) => setNewSupplier({ ...newSupplier, notes: e.target.value })}
                placeholder="Internal notes about this supplier"
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSupplier(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateSupplier}
              disabled={savingSupplier || !newSupplier.name || !newSupplier.contactName || !newSupplier.email}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {savingSupplier ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Add to Phonebook'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Document Dialog */}
      <Dialog open={!!editingDocument} onOpenChange={(open) => !open && setEditingDocument(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Edit Document
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Title</Label>
              <Input
                value={editDocumentTitle}
                onChange={(e) => setEditDocumentTitle(e.target.value)}
                placeholder="Document title"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Note</Label>
              <Textarea
                value={editDocumentNote}
                onChange={(e) => setEditDocumentNote(e.target.value)}
                placeholder="Add a note about this document..."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDocument(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDocumentEdit} disabled={savingDocumentEdit}>
              {savingDocumentEdit && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}


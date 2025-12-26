'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Truck,
  Package,
  CheckCircle,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  ExternalLink,
  Edit2,
  Save,
  X,
  Camera,
  FileSignature
} from 'lucide-react'

interface Delivery {
  id: string
  status: string
  scheduledDate?: string
  actualDate?: string
  carrier?: string
  trackingNumber?: string
  notes?: string
  receivedBy?: string
  signatureUrl?: string
  photoUrls?: string[]
  createdAt: string
  order: {
    id: string
    orderNumber: string
    supplier?: {
      id: string
      name: string
      phone?: string
      email?: string
    }
  }
}

interface DeliveryTrackerProps {
  orderId: string
  canEdit?: boolean
  onDeliveryUpdate?: () => void
}

const DELIVERY_STATUSES = [
  { value: 'PENDING', label: 'Pending', color: 'bg-gray-100 text-gray-700', icon: Clock },
  { value: 'SCHEDULED', label: 'Scheduled', color: 'bg-blue-100 text-blue-700', icon: Calendar },
  { value: 'IN_TRANSIT', label: 'In Transit', color: 'bg-purple-100 text-purple-700', icon: Truck },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', color: 'bg-orange-100 text-orange-700', icon: MapPin },
  { value: 'DELIVERED', label: 'Delivered', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  { value: 'FAILED', label: 'Failed', color: 'bg-red-100 text-red-700', icon: AlertCircle }
]

const CARRIERS = [
  'UPS',
  'FedEx',
  'USPS',
  'DHL',
  'Amazon',
  'Local Delivery',
  'Freight',
  'Other'
]

export default function DeliveryTracker({ orderId, canEdit = false, onDeliveryUpdate }: DeliveryTrackerProps) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state for editing
  const [formData, setFormData] = useState({
    status: '',
    scheduledDate: '',
    actualDate: '',
    carrier: '',
    trackingNumber: '',
    notes: '',
    receivedBy: ''
  })

  const fetchDeliveries = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/deliveries?orderId=${orderId}`)
      if (!response.ok) throw new Error('Failed to fetch deliveries')
      const data = await response.json()
      setDeliveries(data.deliveries || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deliveries')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchDeliveries()
  }, [fetchDeliveries])

  const getStatusConfig = (status: string) => {
    return DELIVERY_STATUSES.find(s => s.value === status) || DELIVERY_STATUSES[0]
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const startEditing = (delivery: Delivery) => {
    setFormData({
      status: delivery.status,
      scheduledDate: delivery.scheduledDate?.split('T')[0] || '',
      actualDate: delivery.actualDate?.split('T')[0] || '',
      carrier: delivery.carrier || '',
      trackingNumber: delivery.trackingNumber || '',
      notes: delivery.notes || '',
      receivedBy: delivery.receivedBy || ''
    })
    setEditingId(delivery.id)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setFormData({
      status: '',
      scheduledDate: '',
      actualDate: '',
      carrier: '',
      trackingNumber: '',
      notes: '',
      receivedBy: ''
    })
  }

  const handleSave = async (deliveryId: string) => {
    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/deliveries/${deliveryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: formData.status,
          scheduledDate: formData.scheduledDate || undefined,
          actualDate: formData.actualDate || undefined,
          carrier: formData.carrier || undefined,
          trackingNumber: formData.trackingNumber || undefined,
          notes: formData.notes || undefined,
          receivedBy: formData.receivedBy || undefined
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update delivery')
      }

      cancelEditing()
      await fetchDeliveries()
      onDeliveryUpdate?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update delivery')
    } finally {
      setSaving(false)
    }
  }

  const getTrackingUrl = (carrier: string, trackingNumber: string): string | null => {
    const carrierUrls: Record<string, string> = {
      'UPS': `https://www.ups.com/track?tracknum=${trackingNumber}`,
      'FedEx': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      'USPS': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
      'DHL': `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`
    }
    return carrierUrls[carrier] || null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100px]">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (deliveries.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
        <Truck className="h-12 w-12 mx-auto text-gray-300 mb-2" />
        <p className="text-gray-500">No delivery records</p>
        <p className="text-sm text-gray-400">Delivery information will appear here once added</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {deliveries.map((delivery) => {
        const statusConfig = getStatusConfig(delivery.status)
        const StatusIcon = statusConfig.icon
        const isEditing = editingId === delivery.id
        const trackingUrl = delivery.carrier && delivery.trackingNumber
          ? getTrackingUrl(delivery.carrier, delivery.trackingNumber)
          : null

        return (
          <div
            key={delivery.id}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${statusConfig.color}`}>
                  <StatusIcon className="h-4 w-4" />
                </div>
                <div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                    {statusConfig.label}
                  </span>
                  <div className="text-xs text-gray-500 mt-1">
                    Created {formatDateTime(delivery.createdAt)}
                  </div>
                </div>
              </div>
              {canEdit && !isEditing && (
                <button
                  onClick={() => startEditing(delivery)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Edit2 className="h-4 w-4 text-gray-500" />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {DELIVERY_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>{status.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
                      <select
                        value={formData.carrier}
                        onChange={(e) => setFormData(prev => ({ ...prev, carrier: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select carrier...</option>
                        {CARRIERS.map((carrier) => (
                          <option key={carrier} value={carrier}>{carrier}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Number</label>
                    <input
                      type="text"
                      value={formData.trackingNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, trackingNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
                      <input
                        type="date"
                        value={formData.scheduledDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Actual Delivery Date</label>
                      <input
                        type="date"
                        value={formData.actualDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, actualDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {formData.status === 'DELIVERED' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Received By</label>
                      <input
                        type="text"
                        value={formData.receivedBy}
                        onChange={(e) => setFormData(prev => ({ ...prev, receivedBy: e.target.value }))}
                        placeholder="Name of person who received the delivery"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={cancelEditing}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSave(delivery.id)}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Carrier & Tracking */}
                  {(delivery.carrier || delivery.trackingNumber) && (
                    <div className="flex items-center gap-4">
                      {delivery.carrier && (
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{delivery.carrier}</span>
                        </div>
                      )}
                      {delivery.trackingNumber && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-gray-600">{delivery.trackingNumber}</span>
                          {trackingUrl && (
                            <a
                              href={trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                              title="Track shipment"
                            >
                              <ExternalLink className="h-4 w-4 text-blue-600" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dates */}
                  <div className="flex items-center gap-6 text-sm">
                    {delivery.scheduledDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">
                          Scheduled: {formatDate(delivery.scheduledDate)}
                        </span>
                      </div>
                    )}
                    {delivery.actualDate && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-green-600">
                          Delivered: {formatDate(delivery.actualDate)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Received By */}
                  {delivery.receivedBy && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileSignature className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">Received by: {delivery.receivedBy}</span>
                    </div>
                  )}

                  {/* Photos */}
                  {delivery.photoUrls && delivery.photoUrls.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{delivery.photoUrls.length} photo(s)</span>
                    </div>
                  )}

                  {/* Notes */}
                  {delivery.notes && (
                    <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                      {delivery.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Timeline View */}
      {deliveries.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-4">Delivery Timeline</h4>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
            <div className="space-y-4">
              {deliveries.map((delivery) => {
                const statusConfig = getStatusConfig(delivery.status)
                const StatusIcon = statusConfig.icon

                return (
                  <div key={`timeline-${delivery.id}`} className="relative flex items-start gap-4 pl-10">
                    <div className={`absolute left-2 p-1.5 rounded-full ${statusConfig.color} -translate-x-1/2`}>
                      <StatusIcon className="h-3 w-3" />
                    </div>
                    <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{statusConfig.label}</span>
                        <span className="text-xs text-gray-500">{formatDateTime(delivery.createdAt)}</span>
                      </div>
                      {delivery.carrier && (
                        <p className="text-sm text-gray-600 mt-1">
                          Via {delivery.carrier}
                          {delivery.trackingNumber && ` - ${delivery.trackingNumber}`}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

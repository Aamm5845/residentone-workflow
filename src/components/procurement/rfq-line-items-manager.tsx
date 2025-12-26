'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  GripVertical,
  Package,
  AlertCircle,
  CheckCircle,
  FileText
} from 'lucide-react'

interface FFEItem {
  id: string
  name: string
  description?: string
  category?: string
}

interface RFQLineItem {
  id: string
  description: string
  quantity: number
  specifications?: string
  order: number
  ffeItem?: FFEItem
}

interface RFQLineItemsManagerProps {
  rfqId: string
  isDraft: boolean
  onItemsChange?: (items: RFQLineItem[]) => void
}

export default function RFQLineItemsManager({
  rfqId,
  isDraft,
  onItemsChange
}: RFQLineItemsManagerProps) {
  const [lineItems, setLineItems] = useState<RFQLineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    description: '',
    quantity: '1',
    specifications: ''
  })

  const fetchLineItems = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/rfq/${rfqId}/line-items`)
      if (!response.ok) throw new Error('Failed to fetch line items')
      const data = await response.json()
      setLineItems(data.lineItems || [])
      onItemsChange?.(data.lineItems || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load line items')
    } finally {
      setLoading(false)
    }
  }, [rfqId, onItemsChange])

  useEffect(() => {
    fetchLineItems()
  }, [fetchLineItems])

  const handleAdd = async () => {
    if (!formData.description || !formData.quantity) {
      setError('Description and quantity are required')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/rfq/${rfqId}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: formData.description,
          quantity: parseInt(formData.quantity),
          specifications: formData.specifications || undefined
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add line item')
      }

      setSuccess('Line item added successfully')
      setTimeout(() => setSuccess(null), 3000)
      resetForm()
      setShowAddForm(false)
      await fetchLineItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add line item')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (lineItemId: string) => {
    if (!formData.description || !formData.quantity) {
      setError('Description and quantity are required')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/rfq/${rfqId}/line-items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItemId,
          description: formData.description,
          quantity: parseInt(formData.quantity),
          specifications: formData.specifications || undefined
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update line item')
      }

      setSuccess('Line item updated successfully')
      setTimeout(() => setSuccess(null), 3000)
      resetForm()
      setEditingId(null)
      await fetchLineItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update line item')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (lineItemId: string) => {
    if (!confirm('Are you sure you want to delete this line item?')) return

    try {
      setSaving(true)
      setError(null)

      const response = await fetch(
        `/api/rfq/${rfqId}/line-items?lineItemId=${lineItemId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete line item')
      }

      setSuccess('Line item deleted successfully')
      setTimeout(() => setSuccess(null), 3000)
      await fetchLineItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete line item')
    } finally {
      setSaving(false)
    }
  }

  const startEditing = (item: RFQLineItem) => {
    setFormData({
      description: item.description,
      quantity: item.quantity.toString(),
      specifications: item.specifications || ''
    })
    setEditingId(item.id)
    setShowAddForm(false)
  }

  const resetForm = () => {
    setFormData({
      description: '',
      quantity: '1',
      specifications: ''
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    resetForm()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100px]">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
        {isDraft && (
          <button
            onClick={() => {
              setShowAddForm(true)
              setEditingId(null)
              resetForm()
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && isDraft && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Add New Line Item</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Item description"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specifications
                </label>
                <input
                  type="text"
                  value={formData.specifications}
                  onChange={(e) => setFormData(prev => ({ ...prev, specifications: e.target.value }))}
                  placeholder="Size, color, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowAddForm(false)
                  resetForm()
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !formData.description || !formData.quantity}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Line Items List */}
      {lineItems.length > 0 ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Specifications</th>
                {isDraft && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {lineItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  {editingId === item.id ? (
                    <>
                      <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          value={formData.quantity}
                          onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-center"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={formData.specifications}
                          onChange={(e) => setFormData(prev => ({ ...prev, specifications: e.target.value }))}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          >
                            <X className="h-4 w-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => handleUpdate(item.id)}
                            disabled={saving}
                            className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.ffeItem && (
                            <Package className="h-4 w-4 text-gray-400" />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{item.description}</div>
                            {item.ffeItem && (
                              <div className="text-xs text-gray-500">From FFE: {item.ffeItem.name}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.specifications || '—'}</td>
                      {isDraft && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => startEditing(item)}
                              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4 text-gray-500" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 hover:bg-red-100 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </button>
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <FileText className="h-12 w-12 mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500">No line items added yet</p>
          {isDraft && (
            <button
              onClick={() => {
                setShowAddForm(true)
                resetForm()
              }}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add your first item
            </button>
          )}
        </div>
      )}
    </div>
  )
}

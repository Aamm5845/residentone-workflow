'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Settings,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle,
  Percent,
  Tag,
  Edit2,
  X
} from 'lucide-react'

interface CategoryMarkup {
  id: string
  category: string
  markupPercentage: number
  description?: string
}

// Common FFE categories
const PRESET_CATEGORIES = [
  'FURNITURE',
  'FIXTURES',
  'EQUIPMENT',
  'LIGHTING',
  'ACCESSORIES',
  'WINDOW_TREATMENTS',
  'RUGS',
  'ART',
  'PLANTS',
  'OUTDOOR',
  'AUDIO_VISUAL',
  'APPLIANCES',
  'MILLWORK',
  'SIGNAGE',
  'OTHER'
]

interface CategoryMarkupSettingsProps {
  onClose?: () => void
}

export default function CategoryMarkupSettings({ onClose }: CategoryMarkupSettingsProps) {
  const [markups, setMarkups] = useState<CategoryMarkup[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newPercentage, setNewPercentage] = useState('')
  const [newDescription, setNewDescription] = useState('')

  const fetchMarkups = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/category-markups')
      if (!response.ok) throw new Error('Failed to fetch markups')
      const data = await response.json()
      setMarkups(data.markups || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load markups')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMarkups()
  }, [fetchMarkups])

  const handleSave = async (category: string, percentage: number, description?: string) => {
    try {
      setSaving(true)
      setError(null)

      const response = await fetch('/api/category-markups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          markupPercentage: percentage,
          description
        })
      })

      if (!response.ok) throw new Error('Failed to save markup')

      setSuccess('Markup saved successfully')
      setTimeout(() => setSuccess(null), 3000)
      await fetchMarkups()
      setEditingId(null)
      setShowAddForm(false)
      setNewCategory('')
      setNewPercentage('')
      setNewDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save markup')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (category: string) => {
    if (!confirm('Are you sure you want to delete this category markup?')) return

    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/category-markups?category=${encodeURIComponent(category)}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete markup')

      setSuccess('Markup deleted successfully')
      setTimeout(() => setSuccess(null), 3000)
      await fetchMarkups()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete markup')
    } finally {
      setSaving(false)
    }
  }

  const formatCategory = (category: string) => {
    return category
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')
  }

  const usedCategories = new Set(markups.map(m => m.category))
  const availableCategories = PRESET_CATEGORIES.filter(c => !usedCategories.has(c))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Settings className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Category Markup Settings</h2>
            <p className="text-sm text-gray-500">Set default markup percentages for product categories</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {/* Existing Markups */}
        {markups.length > 0 ? (
          <div className="space-y-3 mb-6">
            {markups.map((markup) => (
              <div
                key={markup.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {editingId === markup.id ? (
                  <EditMarkupForm
                    markup={markup}
                    onSave={(percentage, description) => handleSave(markup.category, percentage, description)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Tag className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {formatCategory(markup.category)}
                        </div>
                        {markup.description && (
                          <div className="text-sm text-gray-500">{markup.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 rounded-lg">
                        <Percent className="h-4 w-4 text-amber-600" />
                        <span className="font-semibold text-amber-700">{markup.markupPercentage}%</span>
                      </div>
                      <button
                        onClick={() => setEditingId(markup.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(markup.category)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 mb-6 border border-dashed border-gray-300 rounded-lg">
            <Percent className="h-12 w-12 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500">No category markups configured</p>
            <p className="text-sm text-gray-400">Add markups to automatically calculate client pricing</p>
          </div>
        )}

        {/* Add New Markup */}
        {showAddForm ? (
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Add Category Markup</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select category...</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>{formatCategory(cat)}</option>
                  ))}
                  <option value="CUSTOM">Custom Category</option>
                </select>
                {newCategory === 'CUSTOM' && (
                  <input
                    type="text"
                    placeholder="Enter custom category"
                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onChange={(e) => setNewCategory(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Markup %</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="200"
                    step="0.5"
                    value={newPercentage}
                    onChange={(e) => setNewPercentage(e.target.value)}
                    placeholder="e.g., 25"
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setNewCategory('')
                  setNewPercentage('')
                  setNewDescription('')
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newCategory && newPercentage) {
                    handleSave(newCategory, parseFloat(newPercentage), newDescription || undefined)
                  }
                }}
                disabled={!newCategory || !newPercentage || saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Category Markup
          </button>
        )}

        {/* Info */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">How Markups Work</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Markups are applied when creating client quotes from supplier quotes</li>
            <li>• Items are matched by category to apply the appropriate markup</li>
            <li>• You can override markups on individual line items if needed</li>
            <li>• Items without a matching category will use a default 0% markup</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

// Inline edit form component
function EditMarkupForm({
  markup,
  onSave,
  onCancel,
  saving
}: {
  markup: CategoryMarkup
  onSave: (percentage: number, description?: string) => void
  onCancel: () => void
  saving: boolean
}) {
  const [percentage, setPercentage] = useState(markup.markupPercentage.toString())
  const [description, setDescription] = useState(markup.description || '')

  const formatCategory = (category: string) => {
    return category
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')
  }

  return (
    <div className="flex items-center gap-4 w-full">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-gray-500" />
        <span className="font-medium text-gray-700">{formatCategory(markup.category)}</span>
      </div>
      <div className="flex items-center gap-2 flex-1">
        <div className="relative w-24">
          <input
            type="number"
            min="0"
            max="200"
            step="0.5"
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
            className="w-full px-3 py-1.5 pr-6 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
        </div>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
        <button
          onClick={() => onSave(parseFloat(percentage), description || undefined)}
          disabled={saving || !percentage}
          className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Save className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

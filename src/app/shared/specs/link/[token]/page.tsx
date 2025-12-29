'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Package,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  Ban,
  CheckCheck,
  Truck,
  CreditCard,
  Factory,
  PackageCheck,
  Sparkles,
  X,
  Download,
  LinkIcon
} from 'lucide-react'

// Item status options
const ITEM_STATUS_OPTIONS: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  'DRAFT': { label: 'Draft', icon: Circle, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' },
  'HIDDEN': { label: 'Hidden', icon: Circle, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200' },
  'OPTION': { label: 'Option', icon: Circle, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200' },
  'SELECTED': { label: 'Selected', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'NEED_SAMPLE': { label: 'Need Sample', icon: Package, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  'QUOTING': { label: 'Quoting', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  'BETTER_PRICE': { label: 'Better Price', icon: CreditCard, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  'ISSUE': { label: 'Issue', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  'NEED_TO_ORDER': { label: 'Need to Order', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  'CLIENT_TO_ORDER': { label: 'Client to Order', icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  'ORDERED': { label: 'Ordered', icon: PackageCheck, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  'IN_PRODUCTION': { label: 'In Production', icon: Factory, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  'COMPLETED': { label: 'Completed', icon: CheckCheck, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  'INTERNAL_REVIEW': { label: 'In Review', icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  'CLIENT_REVIEW': { label: 'Awaiting Approval', icon: AlertCircle, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  'APPROVED': { label: 'Approved', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'DELIVERED': { label: 'Delivered', icon: PackageCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
}

interface SpecItem {
  id: string
  name: string
  description: string | null
  roomName: string
  sectionName: string
  categoryName: string
  productName: string | null
  brand: string | null
  sku: string | null
  quantity: number
  leadTime: string | null
  supplierName: string | null
  supplierLink: string | null
  specStatus: string
  images: string[]
  thumbnailUrl: string | null
  tradePrice: number | null
  rrp: number | null
  color: string | null
  finish: string | null
  material: string | null
}

interface CategoryGroup {
  name: string
  items: SpecItem[]
}

interface ShareSettings {
  showSupplier: boolean
  showBrand: boolean
  showPricing: boolean
  showDetails: boolean
}

export default function SharedSpecLinkPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linkName, setLinkName] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [specs, setSpecs] = useState<SpecItem[]>([])
  const [groupedSpecs, setGroupedSpecs] = useState<CategoryGroup[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  const [imageLightbox, setImageLightbox] = useState<{
    open: boolean
    imageUrl: string
    imageTitle: string
  }>({ open: false, imageUrl: '', imageTitle: '' })

  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    showSupplier: false,
    showBrand: true,
    showPricing: false,
    showDetails: true
  })

  // Sort/group mode: 'category' or 'room'
  const [groupBy, setGroupBy] = useState<'category' | 'room'>('category')

  useEffect(() => {
    const fetchSharedSpecs = async () => {
      try {
        const res = await fetch(`/api/shared/specs/link/${token}`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Failed to load specs')
          return
        }

        setLinkName(data.linkName)
        setProjectName(data.projectName || 'Project Specifications')
        setOrgName(data.orgName || '')
        setSpecs(data.specs || [])
        setExpiresAt(data.expiresAt)
        setShareSettings(data.shareSettings || {
          showSupplier: false,
          showBrand: true,
          showPricing: false,
          showDetails: true
        })

        // Store raw specs - grouping will be computed based on groupBy state
        // Initial grouping by category
        const groups: Record<string, CategoryGroup> = {}
        data.specs?.forEach((spec: SpecItem) => {
          const key = spec.categoryName || 'General'
          if (!groups[key]) {
            groups[key] = { name: key, items: [] }
          }
          groups[key].items.push(spec)
        })

        const groupedArray = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name))
        setGroupedSpecs(groupedArray)
        setExpandedCategories(new Set(groupedArray.map(g => g.name)))
      } catch (err) {
        console.error('Error fetching shared specs:', err)
        setError('Failed to load specifications')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchSharedSpecs()
    }
  }, [token])

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName)
      } else {
        newSet.add(categoryName)
      }
      return newSet
    })
  }

  // Compute groups based on groupBy state
  const displayGroups = useMemo(() => {
    if (groupBy === 'room') {
      const groups: Record<string, CategoryGroup> = {}
      specs.forEach((spec) => {
        const key = spec.roomName || 'Unassigned'
        if (!groups[key]) {
          groups[key] = { name: key, items: [] }
        }
        groups[key].items.push(spec)
      })
      return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name))
    }
    return groupedSpecs
  }, [specs, groupBy, groupedSpecs])

  // Expand all when groupBy changes
  useEffect(() => {
    setExpandedCategories(new Set(displayGroups.map(g => g.name)))
  }, [groupBy, displayGroups])

  const getStatusBadge = (status: string) => {
    const option = ITEM_STATUS_OPTIONS[status] || ITEM_STATUS_OPTIONS['SELECTED']
    const Icon = option.icon
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        option.bg,
        option.color,
        option.border
      )}>
        <Icon className="w-3.5 h-3.5" />
        {option.label}
      </span>
    )
  }

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return null
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
          <p className="text-slate-600 font-medium text-lg">Loading specifications...</p>
          <p className="text-slate-400 text-sm mt-1">Please wait a moment</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-100">
            <LinkIcon className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-3">Unable to Load</h1>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{projectName}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {orgName && (
                    <span className="text-slate-500 font-medium">{orgName}</span>
                  )}
                  {linkName && (
                    <>
                      {orgName && <span className="text-slate-300">•</span>}
                      <span className="text-emerald-600 font-medium">{linkName}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Pills & Sort Toggle */}
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-slate-100 rounded-full">
                <span className="text-sm font-semibold text-slate-700">{specs.length} Items</span>
              </div>
              <div className="px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">
                <span className="text-sm font-semibold text-emerald-700">{displayGroups.length} {groupBy === 'room' ? 'Rooms' : 'Categories'}</span>
              </div>
              {/* Sort Toggle */}
              <div className="flex items-center bg-slate-100 rounded-full p-1">
                <button
                  onClick={() => setGroupBy('category')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                    groupBy === 'category' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Category
                </button>
                <button
                  onClick={() => setGroupBy('room')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                    groupBy === 'room' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Room
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {displayGroups.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Specifications</h2>
            <p className="text-slate-500">No items have been shared in this link.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayGroups.map((group) => (
              <div
                key={group.name}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Group Header */}
                <button
                  onClick={() => toggleCategory(group.name)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                      expandedCategories.has(group.name)
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-slate-100 text-slate-500"
                    )}>
                      {expandedCategories.has(group.name) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="text-left">
                      <h2 className="text-base font-semibold text-slate-900">{group.name}</h2>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {group.items.length}
                    </span>
                  </div>
                </button>

                {/* Compact Items List */}
                {expandedCategories.has(group.name) && (
                  <div className="border-t border-slate-100">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                      <div className="col-span-1"></div>
                      <div className="col-span-3">Item</div>
                      <div className="col-span-2">{groupBy === 'category' ? 'Room' : 'Category'}</div>
                      {shareSettings.showBrand && <div className="col-span-2">Brand</div>}
                      {shareSettings.showSupplier && <div className="col-span-2">Supplier</div>}
                      <div className="col-span-1 text-center">Qty</div>
                      {shareSettings.showPricing && <div className="col-span-1 text-right">Price</div>}
                    </div>

                    {/* Items */}
                    <div className="divide-y divide-slate-100">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-slate-50 transition-colors"
                        >
                          {/* Thumbnail */}
                          <div className="col-span-1">
                            <div
                              className={cn(
                                "w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden",
                                (item.thumbnailUrl || item.images?.[0]) && "cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all"
                              )}
                              onClick={() => {
                                if (item.thumbnailUrl || item.images?.[0]) {
                                  setImageLightbox({
                                    open: true,
                                    imageUrl: item.thumbnailUrl || item.images[0],
                                    imageTitle: `${item.sectionName}: ${item.name}`
                                  })
                                }
                              }}
                            >
                              {item.thumbnailUrl || item.images?.[0] ? (
                                <img
                                  src={item.thumbnailUrl || item.images[0]}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-slate-300" />
                              )}
                            </div>
                          </div>

                          {/* Item Name */}
                          <div className="col-span-3 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                            {item.sku && (
                              <p className="text-xs text-slate-400 truncate">{item.sku}</p>
                            )}
                          </div>

                          {/* Room or Category */}
                          <div className="col-span-2 min-w-0">
                            <p className="text-sm text-slate-600 truncate">
                              {groupBy === 'category' ? item.roomName : item.categoryName}
                            </p>
                          </div>

                          {/* Brand */}
                          {shareSettings.showBrand && (
                            <div className="col-span-2 min-w-0">
                              <p className="text-sm text-slate-600 truncate">{item.brand || '-'}</p>
                            </div>
                          )}

                          {/* Supplier with Link */}
                          {shareSettings.showSupplier && (
                            <div className="col-span-2 min-w-0">
                              {item.supplierName ? (
                                <div className="flex items-center gap-1">
                                  {item.supplierLink ? (
                                    <a
                                      href={item.supplierLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline truncate flex items-center gap-1"
                                    >
                                      {item.supplierName}
                                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                    </a>
                                  ) : (
                                    <p className="text-sm text-slate-600 truncate">{item.supplierName}</p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-slate-400">-</p>
                              )}
                            </div>
                          )}

                          {/* Quantity */}
                          <div className="col-span-1 text-center">
                            <span className="text-sm font-medium text-slate-700">{item.quantity || 1}</span>
                          </div>

                          {/* Price */}
                          {shareSettings.showPricing && (
                            <div className="col-span-1 text-right">
                              <span className="text-sm font-medium text-slate-900">
                                {formatCurrency(item.rrp) || '-'}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm text-slate-500">
                Powered by <span className="font-semibold text-slate-700">StudioFlow</span>
              </span>
            </div>
            <p className="text-sm text-slate-400">
              © {new Date().getFullYear()} All rights reserved
            </p>
          </div>
        </div>
      </footer>

      {/* Image Lightbox */}
      {imageLightbox.open && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={() => setImageLightbox(prev => ({ ...prev, open: false }))}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] p-4 w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-lg font-medium truncate pr-4">
                {imageLightbox.imageTitle}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(imageLightbox.imageUrl)
                      const blob = await response.blob()
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = imageLightbox.imageTitle || 'image.jpg'
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      document.body.removeChild(a)
                    } catch (error) {
                      console.error('Error downloading image:', error)
                    }
                  }}
                  className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setImageLightbox(prev => ({ ...prev, open: false }))}
                  className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <img
              src={imageLightbox.imageUrl}
              alt={imageLightbox.imageTitle}
              className="max-w-full max-h-[80vh] object-contain mx-auto rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}

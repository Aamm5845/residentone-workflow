'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  ChevronDown,
  Search,
  List,
  Grid3X3,
  X,
  Download
} from 'lucide-react'

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
  width: string | null
  length: string | null
  height: string | null
  depth: string | null
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

export default function SharedSpecsPage() {
  const params = useParams()
  const projectId = params.projectId as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [specs, setSpecs] = useState<SpecItem[]>([])
  const [groupedSpecs, setGroupedSpecs] = useState<CategoryGroup[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

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

  // UI State
  const [activeTab, setActiveTab] = useState<'summary' | 'financial'>('summary')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [selectedDetail, setSelectedDetail] = useState<SpecItem | null>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const fetchSharedSpecs = async () => {
      try {
        const res = await fetch(`/api/shared/specs/${projectId}`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Failed to load specs')
          return
        }

        setProjectName(data.projectName || 'Specifications')
        setOrgName(data.orgName || '')
        setSpecs(data.specs || [])
        setLastUpdated(data.lastUpdated || null)
        setShareSettings(data.shareSettings || {
          showSupplier: false,
          showBrand: true,
          showPricing: false,
          showDetails: true
        })

        // Group specs by category
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

    if (projectId) {
      fetchSharedSpecs()
    }
  }, [projectId])

  // Filter specs based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedSpecs

    const query = searchQuery.toLowerCase()
    return groupedSpecs
      .map(group => ({
        ...group,
        items: group.items.filter(item =>
          item.name.toLowerCase().includes(query) ||
          item.productName?.toLowerCase().includes(query) ||
          item.brand?.toLowerCase().includes(query) ||
          item.roomName.toLowerCase().includes(query) ||
          item.sectionName.toLowerCase().includes(query)
        )
      }))
      .filter(group => group.items.length > 0)
  }, [groupedSpecs, searchQuery])

  // Calculate total cost for financial tab
  const totalCost = useMemo(() => {
    return specs.reduce((sum, item) => {
      const price = item.rrp || item.tradePrice || 0
      return sum + (price * (item.quantity || 1))
    }, 0)
  }, [specs])

  // Calculate category costs
  const categoryCosts = useMemo(() => {
    const costs: Record<string, number> = {}
    specs.forEach(item => {
      const category = item.categoryName || 'General'
      const price = item.rrp || item.tradePrice || 0
      costs[category] = (costs[category] || 0) + (price * (item.quantity || 1))
    })
    return costs
  }, [specs])

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

  const scrollToSection = (categoryName: string) => {
    const ref = sectionRefs.current[categoryName]
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setExpandedCategories(prev => new Set([...prev, categoryName]))
    }
  }

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  const formatLastUpdated = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Updated today'
    if (diffDays === 1) return 'Last Updated 1 day ago'
    if (diffDays < 30) return `Last Updated ${diffDays} days ago`
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30)
      return `Last Updated ${months} month${months > 1 ? 's' : ''} ago`
    }
    return `Last Updated ${date.toLocaleDateString()}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading specifications...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-medium text-gray-900 mb-2">Unable to Load</h1>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Clean Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Logo & Title */}
            <div className="flex items-center gap-4">
              {/* Simple Logo Placeholder */}
              <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                <span className="text-xs font-medium text-gray-500">
                  {orgName.charAt(0) || 'M'}
                </span>
              </div>
              <div>
                <h1 className="text-base font-medium text-gray-900">{orgName || 'Meisner Interiors'}</h1>
                <p className="text-sm text-gray-500">
                  {projectName} / <span className="font-medium text-gray-700">Specs</span>
                </p>
              </div>
            </div>

            {/* Right: Last Updated */}
            {lastUpdated && (
              <div className="text-sm text-gray-400">
                {formatLastUpdated(lastUpdated)}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tab Bar & Controls */}
      <div className="border-b border-gray-200 bg-white sticky top-[73px] z-40">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center justify-between h-12">
            {/* Left: Tabs */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('summary')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                  activeTab === 'summary'
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                Summary
              </button>
              {shareSettings.showPricing && (
                <button
                  onClick={() => setActiveTab('financial')}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                    activeTab === 'financial'
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  )}
                >
                  Financial
                </button>
              )}

              {/* Navigate to Section Dropdown */}
              <div className="relative ml-2">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      scrollToSection(e.target.value)
                      e.target.value = ''
                    }
                  }}
                  className="appearance-none bg-transparent text-sm text-gray-500 hover:text-gray-700 pr-6 cursor-pointer focus:outline-none"
                  defaultValue=""
                >
                  <option value="" disabled>Navigate to Section</option>
                  {filteredGroups.map(group => (
                    <option key={group.name} value={group.name}>
                      {group.name} ({group.items.length})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Total Cost for Financial Tab */}
              {activeTab === 'financial' && shareSettings.showPricing && (
                <div className="ml-4 pl-4 border-l border-gray-200">
                  <span className="text-lg font-semibold text-gray-900">{formatCurrency(totalCost)}</span>
                  <span className="text-xs text-gray-400 uppercase ml-2">Total Cost</span>
                </div>
              )}
            </div>

            {/* Right: Search & View Toggle */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 w-48 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* View Toggle */}
              <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-1.5 transition-colors",
                    viewMode === 'list' ? "bg-gray-100 text-gray-700" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-1.5 transition-colors",
                    viewMode === 'grid' ? "bg-gray-100 text-gray-700" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm">
              {searchQuery ? 'No items match your search' : 'No specifications available'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredGroups.map((group) => (
              <div
                key={group.name}
                ref={(el) => { sectionRefs.current[group.name] = el }}
                className="bg-white"
              >
                {/* Section Header */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-gray-900">{group.name}</h2>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {group.items.length}
                    </span>
                    {activeTab === 'financial' && shareSettings.showPricing && categoryCosts[group.name] && (
                      <div className="ml-2">
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(categoryCosts[group.name])}
                        </span>
                        <span className="text-[10px] text-gray-400 uppercase ml-1">Total Cost</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleCategory(group.name)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {expandedCategories.has(group.name) ? 'Collapse' : 'Expand'}
                    <ChevronDown className={cn(
                      "w-4 h-4 transition-transform",
                      !expandedCategories.has(group.name) && "-rotate-90"
                    )} />
                  </button>
                </div>

                {/* Items Table */}
                {expandedCategories.has(group.name) && (
                  <div className="mt-1">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-12 gap-3 py-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors items-start"
                      >
                        {/* Image */}
                        <div className="col-span-1">
                          <div
                            className={cn(
                              "w-14 h-14 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden",
                              (item.thumbnailUrl || item.images?.[0]) && "cursor-pointer hover:ring-2 hover:ring-gray-300 transition-all"
                            )}
                            onClick={() => {
                              if (item.thumbnailUrl || item.images?.[0]) {
                                setImageLightbox({
                                  open: true,
                                  imageUrl: item.thumbnailUrl || item.images[0],
                                  imageTitle: item.name
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
                              <ImageIcon className="w-5 h-5 text-gray-300" />
                            )}
                          </div>
                        </div>

                        {/* Name & Location */}
                        <div className="col-span-2 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                            {item.supplierLink && (
                              <a
                                href={item.supplierLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{item.sectionName}</p>
                          <p className="text-xs text-gray-500 mt-1">{item.roomName}</p>
                        </div>

                        {/* Brand */}
                        <div className="col-span-1 min-w-0">
                          {item.productName && (
                            <>
                              <p className="text-sm text-gray-900 truncate">{item.productName}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Color</p>
                            </>
                          )}
                          {item.brand && (
                            <div className="mt-1">
                              <p className="text-sm text-gray-600 truncate">{item.brand}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Brand</p>
                            </div>
                          )}
                        </div>

                        {/* Dimensions: Width, Length, Height, Depth */}
                        {activeTab === 'summary' ? (
                          <>
                            <div className="col-span-1 text-center">
                              <p className="text-sm text-gray-900">{item.width || '-'}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Width (in)</p>
                            </div>
                            <div className="col-span-1 text-center">
                              <p className="text-sm text-gray-900">{item.length || '-'}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Length (in)</p>
                            </div>
                            <div className="col-span-1 text-center">
                              <p className="text-sm text-gray-900">{item.height || '-'}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Height (in)</p>
                            </div>
                            <div className="col-span-1 text-center">
                              <p className="text-sm text-gray-900">{item.depth || '-'}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Depth (in)</p>
                            </div>
                          </>
                        ) : (
                          /* Financial Tab: Qty, Unit Price, Total Price, Unit RRP */
                          <>
                            <div className="col-span-1 text-center">
                              <p className="text-sm text-gray-900">{item.quantity || 0}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Qty</p>
                            </div>
                            <div className="col-span-1 text-center">
                              <p className="text-sm text-gray-900">{formatCurrency(item.rrp)}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Unit Client Price</p>
                            </div>
                            <div className="col-span-1 text-center">
                              <p className="text-sm font-medium text-gray-900">
                                {formatCurrency((item.rrp || 0) * (item.quantity || 1))}
                              </p>
                              <p className="text-[10px] text-gray-400 uppercase">Total Client Price</p>
                            </div>
                            <div className="col-span-1 text-center">
                              <p className="text-sm text-gray-900">{formatCurrency(item.rrp)}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Unit RRP</p>
                            </div>
                          </>
                        )}

                        {/* Qty */}
                        {activeTab === 'summary' && (
                          <div className="col-span-1 text-center">
                            <p className="text-sm text-gray-900">{item.quantity || 0}</p>
                            <p className="text-[10px] text-gray-400 uppercase">Qty</p>
                          </div>
                        )}

                        {/* Lead Time */}
                        <div className="col-span-1 text-center">
                          <p className="text-sm text-gray-900">{item.leadTime || '-'}</p>
                          <p className="text-[10px] text-gray-400 uppercase">Lead Time</p>
                        </div>

                        {/* Vendor */}
                        <div className="col-span-1 min-w-0">
                          {item.supplierName && (
                            <>
                              <p className="text-sm text-gray-900 truncate">{item.supplierName}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Vendor</p>
                            </>
                          )}
                        </div>

                        {/* Status & Details */}
                        <div className="col-span-1 flex flex-col items-end gap-2">
                          {/* Draft indicator */}
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <div className="w-3 h-3 rounded-full border border-gray-300" />
                            <span>{item.specStatus === 'DRAFT' ? 'Draft' : item.specStatus || 'Draft'}</span>
                          </div>
                          {/* Details button */}
                          <button
                            onClick={() => setSelectedDetail(item)}
                            className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Details Modal */}
      {selectedDetail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDetail(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">{selectedDetail.name}</h3>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="flex gap-6">
                {/* Image */}
                {(selectedDetail.thumbnailUrl || selectedDetail.images?.[0]) && (
                  <div className="flex-shrink-0">
                    <img
                      src={selectedDetail.thumbnailUrl || selectedDetail.images[0]}
                      alt={selectedDetail.name}
                      className="w-48 h-48 object-cover rounded-lg border border-gray-200"
                    />
                  </div>
                )}

                {/* Details */}
                <div className="flex-1 space-y-4">
                  {/* Location */}
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">Location</p>
                    <p className="text-sm text-gray-900">{selectedDetail.roomName} • {selectedDetail.sectionName}</p>
                  </div>

                  {/* Product & Brand */}
                  <div className="grid grid-cols-2 gap-4">
                    {selectedDetail.productName && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase mb-1">Product</p>
                        <p className="text-sm text-gray-900">{selectedDetail.productName}</p>
                      </div>
                    )}
                    {selectedDetail.brand && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase mb-1">Brand</p>
                        <p className="text-sm text-gray-900">{selectedDetail.brand}</p>
                      </div>
                    )}
                  </div>

                  {/* Dimensions */}
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-1">Width</p>
                      <p className="text-sm text-gray-900">{selectedDetail.width || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-1">Length</p>
                      <p className="text-sm text-gray-900">{selectedDetail.length || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-1">Height</p>
                      <p className="text-sm text-gray-900">{selectedDetail.height || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-1">Depth</p>
                      <p className="text-sm text-gray-900">{selectedDetail.depth || '-'}</p>
                    </div>
                  </div>

                  {/* Quantity & Lead Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-1">Quantity</p>
                      <p className="text-sm text-gray-900">{selectedDetail.quantity || 1}</p>
                    </div>
                    {selectedDetail.leadTime && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase mb-1">Lead Time</p>
                        <p className="text-sm text-gray-900">{selectedDetail.leadTime}</p>
                      </div>
                    )}
                  </div>

                  {/* Material Details */}
                  {(selectedDetail.color || selectedDetail.finish || selectedDetail.material) && (
                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex flex-wrap gap-2">
                        {selectedDetail.color && (
                          <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 rounded text-xs text-gray-700">
                            <span className="w-2 h-2 rounded-full bg-gray-400 mr-1.5" />
                            {selectedDetail.color}
                          </span>
                        )}
                        {selectedDetail.finish && (
                          <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 rounded text-xs text-gray-700">
                            {selectedDetail.finish}
                          </span>
                        )}
                        {selectedDetail.material && (
                          <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 rounded text-xs text-gray-700">
                            {selectedDetail.material}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {selectedDetail.description && (
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400 uppercase mb-1">Description</p>
                      <p className="text-sm text-gray-600">{selectedDetail.description}</p>
                    </div>
                  )}

                  {/* Supplier Link */}
                  {selectedDetail.supplierLink && (
                    <div className="pt-3">
                      <a
                        href={selectedDetail.supplierLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Product
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

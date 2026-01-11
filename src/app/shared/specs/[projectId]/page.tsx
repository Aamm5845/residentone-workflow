'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { formatCurrency as formatPriceCurrency } from '@/lib/pricing'
import {
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  ChevronDown,
  Search,
  X
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
  rrpCurrency?: string
  color: string | null
  finish: string | null
  material: string | null
  width: string | null
  length: string | null
  height: string | null
  depth: string | null
  componentsTotal?: number
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
  const router = useRouter()
  const projectId = params.projectId as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [specs, setSpecs] = useState<SpecItem[]>([])
  const [groupedSpecs, setGroupedSpecs] = useState<CategoryGroup[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    showSupplier: false,
    showBrand: true,
    showPricing: false,
    showDetails: true
  })

  // UI State
  const [activeTab, setActiveTab] = useState<'summary' | 'financial'>('summary')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const searchInputRef = useRef<HTMLInputElement>(null)

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
          item.sectionName.toLowerCase().includes(query) ||
          item.sku?.toLowerCase().includes(query) ||
          item.supplierName?.toLowerCase().includes(query)
        )
      }))
      .filter(group => group.items.length > 0)
  }, [groupedSpecs, searchQuery])

  // Calculate total cost by currency using same formula as centralized pricing
  // RRP only - don't show trade prices to clients
  // Components already have markup applied from API (componentsTotal includes markup)
  // Formula: (item.rrp × quantity) + componentsTotal
  const totals = useMemo(() => {
    const cadTotal = specs.reduce((sum, item) => {
      const currency = item.rrpCurrency || 'CAD'
      if (currency !== 'CAD') return sum
      const price = item.rrp || 0
      const qty = item.quantity || 1
      const componentsPrice = item.componentsTotal || 0
      return sum + (price * qty) + componentsPrice
    }, 0)

    const usdTotal = specs.reduce((sum, item) => {
      const currency = item.rrpCurrency || 'CAD'
      if (currency !== 'USD') return sum
      const price = item.rrp || 0
      const qty = item.quantity || 1
      const componentsPrice = item.componentsTotal || 0
      return sum + (price * qty) + componentsPrice
    }, 0)

    return { cadTotal, usdTotal }
  }, [specs])

  // Calculate category costs (RRP only, including components)
  const categoryCosts = useMemo(() => {
    const costs: Record<string, number> = {}
    specs.forEach(item => {
      const category = item.categoryName || 'General'
      const price = item.rrp || 0
      const componentsPrice = item.componentsTotal || 0
      costs[category] = (costs[category] || 0) + (price * (item.quantity || 1)) + componentsPrice
    })
    return costs
  }, [specs])

  // Total filtered items count
  const filteredItemsCount = useMemo(() => {
    return filteredGroups.reduce((sum, group) => sum + group.items.length, 0)
  }, [filteredGroups])

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

  const openItemDetail = (itemId: string) => {
    router.push(`/shared/specs/${projectId}/item/${itemId}`)
  }

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape' && isSearchFocused) {
        setSearchQuery('')
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchFocused])

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
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
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
                <div className="flex items-center gap-4 ml-4 pl-4 border-l border-gray-200">
                  {totals.cadTotal > 0 && (
                    <div>
                      <span className="text-lg font-semibold text-gray-900">${totals.cadTotal.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-xs text-gray-400 uppercase ml-1">CAD</span>
                    </div>
                  )}
                  {totals.usdTotal > 0 && (
                    <div>
                      <span className="text-lg font-semibold text-blue-600">${totals.usdTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-xs text-blue-400 uppercase ml-1">USD</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Search */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "relative transition-all duration-200",
                isSearchFocused ? "w-80" : "w-56"
              )}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search Sections"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className="pl-9 pr-16 py-2 w-full text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    ⌘K
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Results Count */}
      {searchQuery && (
        <div className="max-w-[1400px] mx-auto px-6 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-sm text-gray-600">
            Found <span className="font-medium">{filteredItemsCount}</span> items matching "{searchQuery}"
          </p>
        </div>
      )}

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
          <div className="space-y-8">
            {filteredGroups.map((group) => (
              <div
                key={group.name}
                ref={(el) => { sectionRefs.current[group.name] = el }}
              >
                {/* Section Header */}
                <div className="flex items-center justify-between py-2 mb-2">
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

                {/* Items */}
                {expandedCategories.has(group.name) && (
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => openItemDetail(item.id)}
                        className="grid grid-cols-12 gap-3 py-4 px-4 -mx-4 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors items-center group"
                      >
                        {/* Image */}
                        <div className="col-span-1">
                          <div className="w-14 h-14 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                            {item.thumbnailUrl || item.images?.[0] ? (
                              <img
                                src={item.thumbnailUrl || item.images?.[0]}
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
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-gray-700">
                              {item.name}
                            </p>
                            {item.supplierLink && (
                              <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{item.sectionName}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.roomName}</p>
                        </div>

                        {/* Brand & Color */}
                        <div className="col-span-1 min-w-0">
                          {item.productName && (
                            <>
                              <p className="text-sm text-gray-700 truncate">{item.productName}</p>
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

                        {/* Dimensions or Financial */}
                        {activeTab === 'summary' ? (
                          <>
                            <div className="col-span-1 text-center">
                              <p className="text-sm text-gray-700">{item.width || '-'}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Width (in)</p>
                            </div>
                            <div className="col-span-1 text-center">
                              <p className="text-sm text-gray-700">{item.length || '-'}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Length (in)</p>
                            </div>
                            <div className="col-span-1 text-center">
                              <p className="text-sm text-gray-700">{item.height || '-'}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Height (in)</p>
                            </div>
                            <div className="col-span-1 text-center">
                              <p className="text-sm text-gray-700">{item.depth || '-'}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Depth (in)</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="col-span-1 text-center">
                              <p className="text-sm text-gray-700">{item.quantity || 0}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Qty</p>
                            </div>
                            <div className="col-span-1 text-center">
                              <p className="text-sm text-gray-700">{formatCurrency(item.rrp)}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Unit Price</p>
                            </div>
                            <div className="col-span-1 text-center">
                              <p className="text-sm font-medium text-gray-900">
                                {formatCurrency(((item.rrp || 0) * (item.quantity || 1)) + (item.componentsTotal || 0))}
                              </p>
                              <p className="text-[10px] text-gray-400 uppercase">Total</p>
                            </div>
                            <div className="col-span-1 text-center">
                              <p className="text-sm text-gray-700">{formatCurrency(item.rrp)}</p>
                              <p className="text-[10px] text-gray-400 uppercase">RRP</p>
                            </div>
                          </>
                        )}

                        {/* Qty (Summary only) */}
                        {activeTab === 'summary' && (
                          <div className="col-span-1 text-center">
                            <p className="text-sm text-gray-700">{item.quantity || 0}</p>
                            <p className="text-[10px] text-gray-400 uppercase">Qty</p>
                          </div>
                        )}

                        {/* Lead Time */}
                        <div className="col-span-1 text-center">
                          <p className="text-sm text-gray-700">{item.leadTime || '-'}</p>
                          <p className="text-[10px] text-gray-400 uppercase">Lead Time</p>
                        </div>

                        {/* Vendor */}
                        <div className="col-span-1 min-w-0">
                          {item.supplierName ? (
                            <>
                              <p className="text-sm text-gray-700 truncate">{item.supplierName}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Vendor</p>
                            </>
                          ) : (
                            <p className="text-sm text-gray-400">-</p>
                          )}
                        </div>

                        {/* Status & Details */}
                        <div className="col-span-1 flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <div className="w-3 h-3 rounded-full border border-gray-300" />
                            <span>{item.specStatus === 'DRAFT' ? 'Draft' : item.specStatus || 'Draft'}</span>
                          </div>
                          <span className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded group-hover:bg-gray-100 transition-colors">
                            Details
                          </span>
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
    </div>
  )
}

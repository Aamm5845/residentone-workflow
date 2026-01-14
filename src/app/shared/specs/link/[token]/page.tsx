'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { calculateItemRRPTotal, formatCurrency as formatPriceCurrency } from '@/lib/pricing'
import {
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  ChevronDown,
  Search,
  X,
  Check,
  CheckCircle2,
  Info
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import toast from 'react-hot-toast'

interface ComponentItem {
  id: string
  name: string
  modelNumber: string | null
  price: number | null
  quantity: number
}

interface SpecItem {
  id: string
  name: string
  description: string | null
  roomName: string
  sectionName: string
  categoryName: string
  modelNumber: string | null
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
  tradePriceCurrency: string
  rrpCurrency: string
  color: string | null
  finish: string | null
  material: string | null
  width: string | null
  length: string | null
  height: string | null
  depth: string | null
  clientApproved: boolean
  clientApprovedAt: string | null
  components?: ComponentItem[]
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
  showNotes: boolean
  allowApproval: boolean
}

export default function SharedSpecLinkPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linkName, setLinkName] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [clientName, setClientName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [orgEmail, setOrgEmail] = useState('')
  const [specs, setSpecs] = useState<SpecItem[]>([])
  const [groupedSpecs, setGroupedSpecs] = useState<CategoryGroup[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [approvingItems, setApprovingItems] = useState<Set<string>>(new Set())

  // Address verification for approval
  const [verifiedAddress, setVerifiedAddress] = useState<string | null>(null)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [addressInput, setAddressInput] = useState('')
  const [addressError, setAddressError] = useState<string | null>(null)
  const [pendingApprovalItemId, setPendingApprovalItemId] = useState<string | null>(null)
  const [pendingApprovalCategory, setPendingApprovalCategory] = useState<string | null>(null)
  const [approvingCategories, setApprovingCategories] = useState<Set<string>>(new Set())

  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    showSupplier: false,
    showBrand: true,
    showPricing: false,
    showDetails: true,
    showNotes: true,
    allowApproval: false
  })

  // UI State
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const searchInputRef = useRef<HTMLInputElement>(null)

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
        setProjectName(data.projectName || 'Specifications')
        setClientName(data.clientName || '')
        setOrgName(data.orgName || '')
        setOrgEmail(data.orgEmail || '')
        setSpecs(data.specs || [])
        setLastUpdated(data.lastUpdated || null)
        setShareSettings(data.shareSettings || {
          showSupplier: false,
          showBrand: true,
          showPricing: false,
          showDetails: true,
          showNotes: true,
          allowApproval: false
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

    if (token) {
      fetchSharedSpecs()
    }
  }, [token])

  // Filter specs based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedSpecs

    const query = searchQuery.toLowerCase()
    return groupedSpecs
      .map(group => ({
        ...group,
        items: group.items.filter(item =>
          item.name.toLowerCase().includes(query) ||
          item.modelNumber?.toLowerCase().includes(query) ||
          item.brand?.toLowerCase().includes(query) ||
          item.roomName.toLowerCase().includes(query) ||
          item.sectionName.toLowerCase().includes(query) ||
          item.sku?.toLowerCase().includes(query) ||
          item.supplierName?.toLowerCase().includes(query)
        )
      }))
      .filter(group => group.items.length > 0)
  }, [groupedSpecs, searchQuery])

  // Calculate total cost by currency using centralized pricing
  // RRP only - don't show trade prices to clients
  // Components already have markup applied from API (componentsTotal includes markup)
  const totals = useMemo(() => {
    if (!specs || specs.length === 0) return { cadTotal: 0, usdTotal: 0 }

    const cadTotal = specs.reduce((sum, item) => {
      const currency = item.rrpCurrency || 'CAD'
      if (currency !== 'CAD') return sum
      // componentsTotal from API already has markup applied, so just add directly
      const price = item.rrp ?? item.tradePrice ?? 0
      const qty = item.quantity || 1
      const componentsPrice = (item as any).componentsTotal || 0
      return sum + (price * qty) + componentsPrice
    }, 0)

    const usdTotal = specs.reduce((sum, item) => {
      const currency = item.rrpCurrency || 'CAD'
      if (currency !== 'USD') return sum
      const price = item.rrp ?? item.tradePrice ?? 0
      const qty = item.quantity || 1
      const componentsPrice = (item as any).componentsTotal || 0
      return sum + (price * qty) + componentsPrice
    }, 0)

    return { cadTotal: cadTotal || 0, usdTotal: usdTotal || 0 }
  }, [specs])

  // Total filtered items count
  const filteredItemsCount = useMemo(() => {
    return filteredGroups.reduce((sum, group) => sum + group.items.length, 0)
  }, [filteredGroups])

  // Count approved items
  const approvedCount = useMemo(() => {
    return specs.filter(s => s.clientApproved).length
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

  const formatCurrency = (value: number | null, currency: string = 'CAD') => {
    if (value === null || value === undefined) return '-'
    const currencyCode = currency === 'USD' ? 'USD' : 'CAD'
    const locale = currency === 'USD' ? 'en-US' : 'en-CA'
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(value)
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
    router.push(`/shared/specs/link/${token}/item/${itemId}`)
  }

  // Format spec status for display
  const formatSpecStatus = (status: string | null) => {
    if (!status) return null
    const statusMap: Record<string, { label: string; color: string }> = {
      'PENDING': { label: 'Pending', color: 'bg-gray-100 text-gray-600' },
      'SPECIFYING': { label: 'Specifying', color: 'bg-blue-50 text-blue-700' },
      'RFQ_SENT': { label: 'RFQ Sent', color: 'bg-amber-50 text-amber-700' },
      'QUOTED': { label: 'Quoted', color: 'bg-purple-50 text-purple-700' },
      'QUOTE_APPROVED': { label: 'Quote Accepted', color: 'bg-emerald-50 text-emerald-700' },
      'APPROVED': { label: 'Approved', color: 'bg-emerald-50 text-emerald-700' },
      'ORDERED': { label: 'Ordered', color: 'bg-indigo-50 text-indigo-700' },
      'SHIPPED': { label: 'Shipped', color: 'bg-cyan-50 text-cyan-700' },
      'DELIVERED': { label: 'Delivered', color: 'bg-green-50 text-green-700' },
      'INSTALLED': { label: 'Installed', color: 'bg-green-100 text-green-800' },
    }
    return statusMap[status] || { label: status.replace(/_/g, ' '), color: 'bg-gray-100 text-gray-600' }
  }

  const handleApproveItem = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (approvingItems.has(itemId)) return

    // If no verified address yet, show modal to ask for it
    if (!verifiedAddress) {
      setPendingApprovalItemId(itemId)
      setShowAddressModal(true)
      setAddressError(null)
      return
    }

    // Proceed with approval using verified address
    await submitApproval(itemId, verifiedAddress)
  }

  const submitApproval = async (itemId: string, address: string) => {
    setApprovingItems(prev => new Set([...prev, itemId]))

    try {
      const res = await fetch(`/api/shared/specs/link/${token}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, projectAddress: address })
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.invalidAddress) {
          // Address was wrong - clear verified address and show error
          setVerifiedAddress(null)
          setAddressError(data.error || 'Invalid address')
          setPendingApprovalItemId(itemId)
          setShowAddressModal(true)
          return
        }
        throw new Error(data.error || 'Failed to approve')
      }

      // Address is correct - save it for future approvals
      setVerifiedAddress(address)
      setShowAddressModal(false)
      setAddressInput('')
      setPendingApprovalItemId(null)

      // Update local state
      setSpecs(prev => prev.map(s =>
        s.id === itemId
          ? { ...s, clientApproved: true, clientApprovedAt: new Date().toISOString() }
          : s
      ))
      setGroupedSpecs(prev => prev.map(g => ({
        ...g,
        items: g.items.map(s =>
          s.id === itemId
            ? { ...s, clientApproved: true, clientApprovedAt: new Date().toISOString() }
            : s
        )
      })))

      toast.success('Item approved')
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve item')
    } finally {
      setApprovingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
    }
  }

  const handleAddressSubmit = () => {
    if (!addressInput.trim()) {
      setAddressError('Please enter the street number')
      return
    }
    if (pendingApprovalItemId) {
      submitApproval(pendingApprovalItemId, addressInput.trim())
    } else if (pendingApprovalCategory) {
      submitCategoryApproval(pendingApprovalCategory, addressInput.trim())
    }
  }

  // Get items that can be approved in a category (have RRP, not already approved, not contractor-to-order)
  const getApprovableItems = (categoryName: string) => {
    const group = groupedSpecs.find(g => g.name === categoryName)
    if (!group) return []
    return group.items.filter(item =>
      item.rrp &&
      item.rrp > 0 &&
      !item.clientApproved &&
      item.specStatus !== 'CONTRACTOR_TO_ORDER'
    )
  }

  // Handle "Approve All" for a category
  const handleApproveCategory = (categoryName: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (approvingCategories.has(categoryName)) return

    const approvableItems = getApprovableItems(categoryName)
    if (approvableItems.length === 0) {
      toast.error('No items to approve in this category')
      return
    }

    // If no verified address yet, show modal
    if (!verifiedAddress) {
      setPendingApprovalCategory(categoryName)
      setPendingApprovalItemId(null)
      setShowAddressModal(true)
      setAddressError(null)
      return
    }

    // Proceed with bulk approval
    submitCategoryApproval(categoryName, verifiedAddress)
  }

  const submitCategoryApproval = async (categoryName: string, address: string) => {
    const approvableItems = getApprovableItems(categoryName)
    if (approvableItems.length === 0) return

    setApprovingCategories(prev => new Set([...prev, categoryName]))

    // Add all items to approving state
    const itemIds = approvableItems.map(item => item.id)
    setApprovingItems(prev => new Set([...prev, ...itemIds]))

    let successCount = 0
    let failedCount = 0
    let addressInvalid = false

    // Approve items sequentially to avoid overwhelming the server
    for (const item of approvableItems) {
      try {
        const res = await fetch(`/api/shared/specs/link/${token}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, projectAddress: address })
        })

        const data = await res.json()

        if (!res.ok) {
          if (data.invalidAddress) {
            // Address was wrong - stop and show error
            addressInvalid = true
            setVerifiedAddress(null)
            setAddressError(data.error || 'Invalid address')
            setPendingApprovalCategory(categoryName)
            setShowAddressModal(true)
            break
          }
          failedCount++
          continue
        }

        // Address is correct - save it for future approvals
        setVerifiedAddress(address)
        successCount++

        // Update local state for this item
        setSpecs(prev => prev.map(s =>
          s.id === item.id
            ? { ...s, clientApproved: true, clientApprovedAt: new Date().toISOString() }
            : s
        ))
        setGroupedSpecs(prev => prev.map(g => ({
          ...g,
          items: g.items.map(s =>
            s.id === item.id
              ? { ...s, clientApproved: true, clientApprovedAt: new Date().toISOString() }
              : s
          )
        })))
      } catch (err) {
        failedCount++
      }
    }

    // Cleanup
    setApprovingCategories(prev => {
      const newSet = new Set(prev)
      newSet.delete(categoryName)
      return newSet
    })
    setApprovingItems(prev => {
      const newSet = new Set(prev)
      itemIds.forEach(id => newSet.delete(id))
      return newSet
    })

    if (!addressInvalid) {
      setShowAddressModal(false)
      setAddressInput('')
      setPendingApprovalCategory(null)

      if (successCount > 0) {
        toast.success(`Approved ${successCount} item${successCount > 1 ? 's' : ''} in ${categoryName}`)
      }
      if (failedCount > 0) {
        toast.error(`Failed to approve ${failedCount} item${failedCount > 1 ? 's' : ''}`)
      }
    }
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
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{projectName}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {clientName ? `${clientName} · ` : ''}Specifications
              </p>
            </div>

            <div className="flex items-center gap-4">
              {shareSettings.allowApproval && (
                <div className="text-sm text-gray-500">
                  <span className="font-medium text-emerald-600">{approvedCount}</span>
                  <span className="text-gray-400"> / {specs.length} approved</span>
                </div>
              )}
              {lastUpdated && (
                <div className="text-sm text-gray-400">
                  {formatLastUpdated(lastUpdated)}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Controls Bar */}
      <div className="border-b border-gray-200 bg-white sticky top-[73px] z-40">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center justify-between h-12">
            {/* Left: Navigation & Total */}
            <div className="flex items-center gap-4">
              {/* Navigate to Section Dropdown */}
              <div className="relative">
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

              {/* Total Cost - only if pricing is shown */}
              {shareSettings.showPricing && totals && (
                <div className="flex items-center gap-4 pl-4 border-l border-gray-200">
                  {(totals.cadTotal || 0) > 0 && (
                    <div>
                      <span className="text-lg font-semibold text-gray-900">${(totals.cadTotal || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-xs text-gray-400 uppercase ml-1">CAD</span>
                    </div>
                  )}
                  {(totals.usdTotal || 0) > 0 && (
                    <div>
                      <span className="text-lg font-semibold text-blue-600">${(totals.usdTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-xs text-blue-400 uppercase ml-1">USD</span>
                    </div>
                  )}
                  {(totals.cadTotal || 0) === 0 && (totals.usdTotal || 0) === 0 && (
                    <span className="text-sm text-gray-400">No pricing set</span>
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
      <main className="max-w-[1400px] mx-auto px-8 py-6">
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
                    {/* Approve All button - only show if approval is allowed and there are approvable items */}
                    {shareSettings.allowApproval && getApprovableItems(group.name).length > 0 && (
                      <button
                        onClick={(e) => handleApproveCategory(group.name, e)}
                        disabled={approvingCategories.has(group.name)}
                        className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white text-xs font-medium rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {approvingCategories.has(group.name) ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Approving...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            Approve All ({getApprovableItems(group.name).length})
                          </>
                        )}
                      </button>
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
                        className="grid grid-cols-[56px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_60px_80px_100px_80px_180px] gap-3 py-4 px-6 -mx-6 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors items-center group"
                      >
                        {/* Image */}
                        <div>
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
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-gray-700">
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{item.sectionName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{item.roomName}</span>
                            {item.supplierLink && (
                              <a
                                href={item.supplierLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Model Number - always show */}
                        <div className="min-w-0">
                          <p className="text-sm text-gray-700 truncate">{item.modelNumber || '-'}</p>
                          <p className="text-[10px] text-gray-400 uppercase">Model</p>
                        </div>

                        {/* Brand */}
                        <div className="min-w-0">
                          {item.brand && (
                            <>
                              <p className="text-sm text-gray-600 truncate">{item.brand}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Brand</p>
                            </>
                          )}
                        </div>

                        {/* Color */}
                        <div className="min-w-0">
                          {item.color && (
                            <>
                              <p className="text-sm text-gray-600 truncate">{item.color}</p>
                              <p className="text-[10px] text-gray-400 uppercase">Color</p>
                            </>
                          )}
                        </div>

                        {/* Qty */}
                        <div className="text-center">
                          <p className="text-sm text-gray-700">{item.quantity || 0}</p>
                          <p className="text-[10px] text-gray-400 uppercase">Qty</p>
                        </div>

                        {/* Lead Time - always show */}
                        <div className="text-center">
                          <p className="text-sm text-gray-700">{item.leadTime || '-'}</p>
                          <p className="text-[10px] text-gray-400 uppercase">Lead Time</p>
                        </div>

                        {/* Price column - shows pricing if enabled, or components info without prices */}
                        {shareSettings.showPricing ? (
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <p className={cn(
                                "text-sm font-medium",
                                item.rrpCurrency === 'USD' ? "text-blue-600" : "text-gray-900"
                              )}>
                                {formatCurrency(((item.rrp || 0) * (item.quantity || 1)) + (item.componentsTotal || 0), item.rrpCurrency)}
                              </p>
                              {/* Component breakdown popover with prices */}
                              {item.components && item.components.length > 0 && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-4 h-4 rounded-full bg-purple-100 hover:bg-purple-200 flex items-center justify-center transition-colors"
                                      title="View price breakdown"
                                    >
                                      <Info className="w-2.5 h-2.5 text-purple-600" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    side="left"
                                    align="center"
                                    className="w-64 p-3"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-gray-500 uppercase">Price Breakdown</p>
                                      {/* Base item price */}
                                      {item.rrp && item.rrp > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-600">Base item</span>
                                          <span className="text-gray-900">
                                            {formatCurrency(item.rrp, item.rrpCurrency)} × {item.quantity || 1}
                                          </span>
                                        </div>
                                      )}
                                      {/* Components */}
                                      <div className="border-t pt-2 space-y-1.5">
                                        <p className="text-xs font-medium text-gray-500">Components</p>
                                        {item.components.map(comp => (
                                          <div key={comp.id} className="flex justify-between text-sm">
                                            <span className="text-gray-600 truncate mr-2">{comp.name}</span>
                                            <span className="text-gray-900 whitespace-nowrap">
                                              {comp.price ? `${formatCurrency(comp.price, item.rrpCurrency)} × ${comp.quantity}` : '-'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                      {/* Total */}
                                      <div className="border-t pt-2 flex justify-between text-sm font-medium">
                                        <span className="text-gray-700">Total</span>
                                        <span className={item.rrpCurrency === 'USD' ? "text-blue-600" : "text-gray-900"}>
                                          {formatCurrency(((item.rrp || 0) * (item.quantity || 1)) + (item.componentsTotal || 0), item.rrpCurrency)}
                                        </span>
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 uppercase">
                              {item.rrpCurrency === 'USD' ? 'USD' : 'CAD'}
                            </p>
                          </div>
                        ) : item.components && item.components.length > 0 ? (
                          /* Components without pricing - show name and qty only */
                          <div className="text-center">
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 hover:bg-purple-100 rounded text-xs text-purple-700 transition-colors"
                                  title="View components"
                                >
                                  <Info className="w-3 h-3" />
                                  {item.components.length} component{item.components.length > 1 ? 's' : ''}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                side="left"
                                align="center"
                                className="w-56 p-3"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-gray-500 uppercase">Components</p>
                                  {item.components.map(comp => (
                                    <div key={comp.id} className="flex justify-between text-sm">
                                      <span className="text-gray-700 truncate mr-2">{comp.name}</span>
                                      <span className="text-gray-500 whitespace-nowrap">
                                        Qty: {comp.quantity}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        ) : (
                          <div className="text-center">
                            <span className="text-xs text-gray-400">-</span>
                          </div>
                        )}

                        {/* Status Column - hide for statuses that are shown in Approval column */}
                        <div className="flex items-center justify-center">
                          {item.specStatus &&
                           item.specStatus !== 'CONTRACTOR_TO_ORDER' &&
                           item.specStatus !== 'CLIENT_TO_ORDER' &&
                           formatSpecStatus(item.specStatus) && (
                            <span className={cn(
                              "px-2 py-0.5 text-[10px] font-medium rounded whitespace-nowrap",
                              formatSpecStatus(item.specStatus)!.color
                            )}>
                              {formatSpecStatus(item.specStatus)!.label}
                            </span>
                          )}
                        </div>

                        {/* Approval Column */}
                        <div className="flex items-center justify-end gap-2">
                          {/* Approval Status/Button */}
                          {item.specStatus === 'CONTRACTOR_TO_ORDER' ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full whitespace-nowrap">
                              <span className="text-xs font-medium">Contractor to Order</span>
                            </div>
                          ) : item.clientApproved ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full whitespace-nowrap">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="text-xs font-medium">Approved</span>
                            </div>
                          ) : shareSettings.allowApproval && item.rrp ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                handleApproveItem(item.id, e)
                              }}
                              disabled={approvingItems.has(item.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50 whitespace-nowrap z-10"
                            >
                              {approvingItems.has(item.id) ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Approve
                            </button>
                          ) : shareSettings.allowApproval ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full whitespace-nowrap">
                              <span className="text-xs">Pending</span>
                            </div>
                          ) : null}

                          {/* Details Button - Always visible */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              openItemDetail(item.id)
                            }}
                            className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-100 transition-colors whitespace-nowrap"
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

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 mt-12">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">{orgName}</p>
              {orgEmail && (
                <a
                  href={`mailto:${orgEmail}`}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {orgEmail}
                </a>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Shared specifications document
            </p>
          </div>
        </div>
      </footer>

      {/* Address Verification Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Verify Your Identity
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {pendingApprovalCategory
                ? `To approve all items in ${pendingApprovalCategory}, please enter the project street number for verification.`
                : 'To approve items, please enter the project street number for verification.'}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Street Number
              </label>
              <input
                type="text"
                value={addressInput}
                onChange={(e) => {
                  setAddressInput(e.target.value)
                  setAddressError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddressSubmit()
                  }
                }}
                placeholder="e.g. 5655"
                className={cn(
                  "w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2",
                  addressError
                    ? "border-red-300 focus:ring-red-200"
                    : "border-gray-300 focus:ring-gray-200"
                )}
                autoFocus
              />
              {addressError && (
                <p className="mt-1 text-sm text-red-600">{addressError}</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAddressModal(false)
                  setAddressInput('')
                  setAddressError(null)
                  setPendingApprovalItemId(null)
                  setPendingApprovalCategory(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddressSubmit}
                disabled={approvingItems.size > 0 || approvingCategories.size > 0}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {(approvingItems.size > 0 || approvingCategories.size > 0) && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {pendingApprovalCategory
                  ? `Verify & Approve All (${getApprovableItems(pendingApprovalCategory).length})`
                  : 'Verify & Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

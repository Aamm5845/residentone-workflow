'use client'

import { useState, useEffect } from 'react'
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
  Sparkles
} from 'lucide-react'

// Item status options with professional styling
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
  // Legacy statuses for backward compatibility
  'INTERNAL_REVIEW': { label: 'In Review', icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  'CLIENT_REVIEW': { label: 'Awaiting Approval', icon: AlertCircle, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  'RESUBMIT': { label: 'Resubmit', icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  'CLOSED': { label: 'Closed', icon: Ban, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' },
  'REJECTED': { label: 'Rejected', icon: Ban, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  'APPROVED': { label: 'Approved', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'PAYMENT_DUE': { label: 'Payment Due', icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  'IN_TRANSIT': { label: 'In Transit', icon: Truck, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
  'INSTALLED': { label: 'Installed', icon: CheckCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
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
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    showSupplier: false,
    showBrand: true,
    showPricing: false,
    showDetails: true
  })

  useEffect(() => {
    const fetchSharedSpecs = async () => {
      try {
        const res = await fetch(`/api/shared/specs/${projectId}`)
        const data = await res.json()
        
        if (!res.ok) {
          setError(data.error || 'Failed to load specs')
          return
        }
        
        setProjectName(data.projectName || 'Project Specifications')
        setOrgName(data.orgName || '')
        setSpecs(data.specs || [])
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
        
        // Expand all categories by default
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
            <Package className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-3">Unable to Load</h1>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Premium Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{projectName}</h1>
                {orgName && (
                  <p className="text-slate-500 font-medium mt-0.5">{orgName}</p>
                )}
              </div>
            </div>
            
            {/* Stats Pills */}
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-slate-100 rounded-full">
                <span className="text-sm font-semibold text-slate-700">{specs.length} Items</span>
              </div>
              <div className="px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">
                <span className="text-sm font-semibold text-emerald-700">{groupedSpecs.length} Categories</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {groupedSpecs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Specifications Yet</h2>
            <p className="text-slate-500">Specifications will appear here once added.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedSpecs.map((group) => (
              <div 
                key={group.name}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(group.name)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      expandedCategories.has(group.name) 
                        ? "bg-emerald-100 text-emerald-600" 
                        : "bg-slate-100 text-slate-500"
                    )}>
                      {expandedCategories.has(group.name) ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-semibold text-slate-900">{group.name}</h2>
                      <p className="text-sm text-slate-500">{group.items.length} item{group.items.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </button>

                {/* Items Grid */}
                {expandedCategories.has(group.name) && (
                  <div className="border-t border-slate-100">
                    <div className="p-6 grid gap-4">
                      {group.items.map((item) => (
                        <div 
                          key={item.id}
                          className="group bg-slate-50/50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 transition-all duration-200 hover:shadow-md"
                        >
                          <div className="flex gap-5">
                            {/* Image */}
                            <div className="flex-shrink-0">
                              <div className="w-24 h-24 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm">
                                {item.thumbnailUrl || item.images?.[0] ? (
                                  <img 
                                    src={item.thumbnailUrl || item.images[0]} 
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement
                                      target.style.display = 'none'
                                      target.parentElement?.classList.add('image-error')
                                    }}
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center text-slate-300">
                                    <ImageIcon className="w-8 h-8" />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {/* Top Row: Name & Status */}
                              <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="min-w-0">
                                  <h3 className="text-base font-semibold text-slate-900 truncate">{item.name}</h3>
                                  <p className="text-sm text-slate-500">{item.roomName}</p>
                                </div>
                                <div className="flex-shrink-0">
                                  {getStatusBadge(item.specStatus || 'SELECTED')}
                                </div>
                              </div>
                              
                              {/* Details Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2">
                                {/* Product */}
                                {item.productName && (
                                  <div>
                                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Product</p>
                                    <p className="text-sm text-slate-700 font-medium truncate">{item.productName}</p>
                                  </div>
                                )}
                                
                                {/* Brand */}
                                {shareSettings.showBrand && item.brand && (
                                  <div>
                                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Brand</p>
                                    <p className="text-sm text-slate-700 font-medium">{item.brand}</p>
                                  </div>
                                )}
                                
                                {/* Supplier */}
                                {shareSettings.showSupplier && item.supplierName && (
                                  <div>
                                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Supplier</p>
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-sm text-slate-700 font-medium truncate">{item.supplierName}</p>
                                      {item.supplierLink && (
                                        <a 
                                          href={item.supplierLink} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-blue-500 hover:text-blue-600 flex-shrink-0"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Quantity */}
                                <div>
                                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Qty</p>
                                  <p className="text-sm text-slate-700 font-medium">{item.quantity || 1}</p>
                                </div>
                                
                                {/* Lead Time */}
                                {item.leadTime && (
                                  <div>
                                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Lead Time</p>
                                    <p className="text-sm text-slate-700 font-medium">{item.leadTime}</p>
                                  </div>
                                )}
                                
                                {/* Price */}
                                {shareSettings.showPricing && (item.rrp || item.tradePrice) && (
                                  <div>
                                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Price</p>
                                    <p className="text-sm text-slate-900 font-semibold">{formatCurrency(item.rrp || item.tradePrice)}</p>
                                  </div>
                                )}
                              </div>
                              
                              {/* Description & Details */}
                              {shareSettings.showDetails && (item.description || item.color || item.finish || item.material) && (
                                <div className="mt-3 pt-3 border-t border-slate-200/60">
                                  {item.description && (
                                    <p className="text-sm text-slate-600 line-clamp-2 mb-2">{item.description}</p>
                                  )}
                                  {(item.color || item.finish || item.material) && (
                                    <div className="flex flex-wrap gap-2">
                                      {item.color && (
                                        <span className="inline-flex items-center px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
                                          <span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5" />
                                          {item.color}
                                        </span>
                                      )}
                                      {item.finish && (
                                        <span className="inline-flex items-center px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
                                          {item.finish}
                                        </span>
                                      )}
                                      {item.material && (
                                        <span className="inline-flex items-center px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
                                          {item.material}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Link Button */}
                              {item.supplierLink && !shareSettings.showSupplier && (
                                <div className="mt-3">
                                  <a 
                                    href={item.supplierLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-medium transition-colors"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    View Product
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
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

      {/* Premium Footer */}
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
    </div>
  )
}



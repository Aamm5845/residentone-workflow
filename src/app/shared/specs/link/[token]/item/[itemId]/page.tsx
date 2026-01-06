'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  ExternalLink,
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
  updatedAt: string
}

interface Navigation {
  previous: { id: string; name: string } | null
  next: { id: string; name: string } | null
  currentIndex: number
  totalItems: number
}

interface ShareSettings {
  showSupplier: boolean
  showBrand: boolean
  showPricing: boolean
  showDetails: boolean
}

export default function ItemDetailPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const itemId = params.itemId as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [linkName, setLinkName] = useState('')
  const [item, setItem] = useState<SpecItem | null>(null)
  const [navigation, setNavigation] = useState<Navigation | null>(null)
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    showSupplier: false,
    showBrand: true,
    showPricing: false,
    showDetails: true
  })

  const [imageLightbox, setImageLightbox] = useState<{
    open: boolean
    imageUrl: string
    imageIndex: number
  }>({ open: false, imageUrl: '', imageIndex: 0 })

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const res = await fetch(`/api/shared/specs/link/${token}/item/${itemId}`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Failed to load item')
          return
        }

        setProjectName(data.projectName || '')
        setOrgName(data.orgName || '')
        setLinkName(data.linkName || '')
        setItem(data.item)
        setNavigation(data.navigation)
        setShareSettings(data.shareSettings || {
          showSupplier: false,
          showBrand: true,
          showPricing: false,
          showDetails: true
        })
      } catch (err) {
        console.error('Error fetching item:', err)
        setError('Failed to load item')
      } finally {
        setLoading(false)
      }
    }

    if (token && itemId) {
      fetchItem()
    }
  }, [token, itemId])

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
    const months = Math.floor(diffDays / 30)
    return `Last Updated ${months} month${months > 1 ? 's' : ''} ago`
  }

  const navigateTo = (id: string) => {
    router.push(`/shared/specs/link/${token}/item/${id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-medium text-gray-900 mb-2">Unable to Load</h1>
          <p className="text-gray-500 text-sm">{error || 'Item not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                <span className="text-xs font-medium text-gray-500">
                  {orgName.charAt(0) || 'M'}
                </span>
              </div>
              <div>
                <h1 className="text-base font-medium text-gray-900">{orgName}</h1>
                <p className="text-sm text-gray-500">
                  {linkName || projectName} / <span className="font-medium text-gray-700">Specs</span>
                </p>
              </div>
            </div>

            {item.updatedAt && (
              <div className="text-sm text-gray-400">
                {formatLastUpdated(item.updatedAt)}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push(`/shared/specs/link/${token}`)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Products
          </button>

          {navigation?.next && (
            <button
              onClick={() => navigateTo(navigation.next!.id)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Next Product
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Product Title */}
        <div className="flex items-start gap-4 mb-8">
          <h2 className="text-3xl font-semibold text-gray-900 flex-1">
            {item.name}
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
            <span>{item.specStatus || 'Draft'}</span>
          </div>
        </div>

        {/* Location subtitle */}
        <p className="text-gray-500 mb-8">{item.sectionName}</p>

        {/* Product Info Section */}
        <div className="space-y-6 mb-10">
          {/* Product Name */}
          {item.productName && (
            <div>
              <p className="text-gray-900 text-lg">{item.productName}</p>
              <p className="text-xs text-gray-400 uppercase mt-1">Product Name</p>
            </div>
          )}

          {/* Brand */}
          {shareSettings.showBrand && item.brand && (
            <div>
              <p className="text-gray-900 text-lg">{item.brand}</p>
              <p className="text-xs text-gray-400 uppercase mt-1">Brand Name</p>
            </div>
          )}

          {/* SKU */}
          {item.sku && (
            <div>
              <p className="text-gray-900 text-lg">{item.sku}</p>
              <p className="text-xs text-gray-400 uppercase mt-1">Product Code SKU</p>
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div>
              <p className="text-gray-700">{item.description}</p>
              <p className="text-xs text-gray-400 uppercase mt-1">Product Details</p>
            </div>
          )}
        </div>

        {/* Product Images */}
        {item.images && item.images.length > 0 && (
          <div className="mb-10">
            <div className="flex flex-wrap gap-3">
              {item.images.map((img, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:ring-2 hover:ring-gray-300 transition-all",
                    idx === 0 ? "w-64 h-64" : "w-32 h-32"
                  )}
                  onClick={() => setImageLightbox({ open: true, imageUrl: img, imageIndex: idx })}
                >
                  <img
                    src={img}
                    alt={`${item.name}${idx > 0 ? ` ${idx + 1}` : ''}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            {item.images.length > 1 && (
              <p className="text-xs text-gray-400 mt-2">
                {item.images.length} images - click to enlarge
              </p>
            )}
          </div>
        )}

        {/* Two Column Layout: Specs & Contact Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-gray-200">
          {/* Left Column: Specs */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Specs</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-lg text-gray-900">{item.width || '-'}</p>
                <p className="text-xs text-gray-400 uppercase mt-1">Width (in)</p>
              </div>
              <div>
                <p className="text-lg text-gray-900">{item.height || '-'}</p>
                <p className="text-xs text-gray-400 uppercase mt-1">Height (in)</p>
              </div>
              <div>
                <p className="text-lg text-gray-900">{item.length || '-'}</p>
                <p className="text-xs text-gray-400 uppercase mt-1">Length (in)</p>
              </div>
              <div>
                <p className="text-lg text-gray-900">{item.depth || '-'}</p>
                <p className="text-xs text-gray-400 uppercase mt-1">Depth (in)</p>
              </div>
              <div>
                <p className="text-lg text-gray-900">{item.quantity || 0}</p>
                <p className="text-xs text-gray-400 uppercase mt-1">Quantity</p>
              </div>
              {item.leadTime && (
                <div>
                  <p className="text-lg text-gray-900">{item.leadTime}</p>
                  <p className="text-xs text-gray-400 uppercase mt-1">Lead Time</p>
                </div>
              )}
            </div>

            {/* Material Properties */}
            {(item.color || item.finish || item.material) && (
              <div className="mt-8">
                <h4 className="text-sm font-medium text-gray-500 uppercase mb-4">Materials & Finishes</h4>
                <div className="grid grid-cols-2 gap-6">
                  {item.color && (
                    <div>
                      <p className="text-lg text-gray-900">{item.color}</p>
                      <p className="text-xs text-gray-400 uppercase mt-1">Color</p>
                    </div>
                  )}
                  {item.finish && (
                    <div>
                      <p className="text-lg text-gray-900">{item.finish}</p>
                      <p className="text-xs text-gray-400 uppercase mt-1">Finish</p>
                    </div>
                  )}
                  {item.material && (
                    <div>
                      <p className="text-lg text-gray-900">{item.material}</p>
                      <p className="text-xs text-gray-400 uppercase mt-1">Material</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pricing */}
            {shareSettings.showPricing && (item.rrp || item.tradePrice) && (
              <div className="mt-8">
                <h4 className="text-sm font-medium text-gray-500 uppercase mb-4">Pricing</h4>
                <div className="grid grid-cols-2 gap-6">
                  {item.rrp && (
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{formatCurrency(item.rrp)}</p>
                      <p className="text-xs text-gray-400 uppercase mt-1">Unit Price</p>
                    </div>
                  )}
                  {item.quantity > 0 && item.rrp && (
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{formatCurrency(item.rrp * item.quantity)}</p>
                      <p className="text-xs text-gray-400 uppercase mt-1">Total Price</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Contact/Supplier Info */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Product Link</h3>
            <div className="space-y-4">
              {/* Always show product link if available */}
              {item.supplierLink && (
                <a
                  href={item.supplierLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Product Page
                </a>
              )}

              {/* Show supplier name if enabled */}
              {shareSettings.showSupplier && item.supplierName && (
                <div className="mt-4">
                  <p className="text-lg text-gray-900">{item.supplierName}</p>
                  <p className="text-xs text-gray-400 uppercase mt-1">Vendor</p>
                </div>
              )}

              {!item.supplierLink && !item.supplierName && (
                <p className="text-gray-400 text-sm">No product link available</p>
              )}
            </div>

            {/* Room Info */}
            <div className="mt-8">
              <h4 className="text-sm font-medium text-gray-500 uppercase mb-4">Location</h4>
              <div>
                <p className="text-lg text-gray-900">{item.roomName}</p>
                <p className="text-xs text-gray-400 uppercase mt-1">Room</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        {navigation && (navigation.previous || navigation.next) && (
          <div className="flex items-center justify-between mt-16 pt-8 border-t border-gray-200">
            {navigation.previous ? (
              <button
                onClick={() => navigateTo(navigation.previous!.id)}
                className="flex items-center gap-3 text-gray-600 hover:text-gray-900 transition-colors group"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                <div className="text-left">
                  <p className="text-xs text-gray-400 uppercase">Previous</p>
                  <p className="text-sm font-medium truncate max-w-[200px]">{navigation.previous.name}</p>
                </div>
              </button>
            ) : (
              <div />
            )}

            <p className="text-sm text-gray-400">
              {navigation.currentIndex} of {navigation.totalItems}
            </p>

            {navigation.next ? (
              <button
                onClick={() => navigateTo(navigation.next!.id)}
                className="flex items-center gap-3 text-gray-600 hover:text-gray-900 transition-colors group"
              >
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase">Next</p>
                  <p className="text-sm font-medium truncate max-w-[200px]">{navigation.next.name}</p>
                </div>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <div />
            )}
          </div>
        )}
      </main>

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
                {item.name}
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
                      a.download = item.name || 'image.jpg'
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
              alt={item.name}
              className="max-w-full max-h-[80vh] object-contain mx-auto rounded-lg shadow-2xl"
            />

            {/* Lightbox navigation */}
            {item.images.length > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {item.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setImageLightbox(prev => ({ ...prev, imageUrl: img, imageIndex: idx }))}
                    className={cn(
                      "w-12 h-12 rounded border-2 overflow-hidden transition-all",
                      imageLightbox.imageIndex === idx ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


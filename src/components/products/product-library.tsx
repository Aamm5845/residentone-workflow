'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Search, 
  Filter, 
  Grid3X3, 
  List, 
  Plus,
  ChevronRight,
  ChevronDown,
  Package,
  Armchair,
  Lightbulb,
  Bath,
  Palette,
  Wrench,
  Flower2,
  LayoutGrid,
  Image as ImageIcon,
  ExternalLink,
  MoreVertical,
  Pencil,
  Trash2,
  FolderPlus,
  Building,
  Archive,
  X,
  Save,
  Eye
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Phone, Mail, MapPin, Clock, User, Link as LinkIcon, Upload } from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  color: string | null
  parentId: string | null
  order: number
  _count?: {
    products: number
  }
}

interface Product {
  id: string
  name: string
  description: string | null
  brand: string | null
  sku: string | null
  modelNumber: string | null
  color: string | null
  finish: string | null
  material: string | null
  width: string | null
  height: string | null
  depth: string | null
  length: string | null
  dimensionUnit: string | null
  thumbnailUrl: string | null
  images: string[]
  rrp: number | null
  tradePrice: number | null
  currency: string | null
  supplierName: string | null
  supplierPhone: string | null
  supplierEmail: string | null
  supplierAddress: string | null
  supplierLink: string | null
  leadTime: string | null
  isTaxable: boolean | null
  notes: string | null
  customFields: Record<string, any> | null
  status: string
  categoryId: string | null
  category?: Category
  usageCount: number
  createdAt: string
}

interface NewProductForm {
  name: string
  description: string
  brand: string
  sku: string
  modelNumber: string
  color: string
  finish: string
  material: string
  width: string
  height: string
  depth: string
  length: string
  dimensionUnit: string
  rrp: string
  tradePrice: string
  currency: string
  supplierName: string
  supplierPhone: string
  supplierEmail: string
  supplierAddress: string
  supplierLink: string
  leadTime: string
  isTaxable: boolean
  notes: string
  categoryId: string
  images: string[]
}

interface ProductLibraryProps {
  userId: string
}

const categoryIcons: Record<string, typeof Armchair> = {
  furniture: Armchair,
  lighting: Lightbulb,
  plumbing: Bath,
  textiles: Palette,
  hardware: Wrench,
  appliances: Package,
  accessories: Flower2,
  flooring: LayoutGrid,
  'wall-finishes': Palette,
  'window-treatments': Grid3X3,
  outdoor: Flower2
}

// Product Card Component
function ProductCard({ 
  product, 
  onOpen, 
  onAddToRoom, 
  onDelete,
  formatPrice 
}: { 
  product: Product
  onOpen: (p: Product) => void
  onAddToRoom: (p: Product) => void
  onDelete: (p: Product) => void
  formatPrice: (price: number | null) => string
}) {
  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onOpen(product)}>
      {/* Image */}
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {product.thumbnailUrl || product.images?.[0] ? (
          <img
            src={product.thumbnailUrl || product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-gray-300" />
          </div>
        )}
        
        {/* Quick Actions Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => { e.stopPropagation(); onOpen(product); }}
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => { e.stopPropagation(); onAddToRoom(product); }}
          >
            <Building className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>

        {/* Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpen(product)}>
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddToRoom(product)}>
              <Building className="w-4 h-4 mr-2" />
              Add to Room
            </DropdownMenuItem>
            {product.supplierLink && (
              <DropdownMenuItem asChild>
                <a href={product.supplierLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Source
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-red-600"
              onClick={() => onDelete(product)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <CardContent className="p-3">
        <h3 className="font-medium text-sm text-gray-900 line-clamp-2 mb-1">
          {product.name}
        </h3>
        {product.brand && (
          <p className="text-xs text-gray-500 mb-2">{product.brand}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">
            {formatPrice(product.rrp)}
          </span>
          {product.usageCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              Used {product.usageCount}x
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function ProductLibrary({ userId }: ProductLibraryProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(false)
  
  // Filters and view state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  
  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const pageSize = 24
  
  // Modal states
  const [addToRoomModal, setAddToRoomModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null })
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null })
  const [productDetail, setProductDetail] = useState<{ open: boolean; product: Product | null; editing: boolean }>({ open: false, product: null, editing: false })
  
  // Edit form state
  const [editForm, setEditForm] = useState<Partial<Product>>({})
  const [saving, setSaving] = useState(false)
  
  // Room selection for add to room
  const [projects, setProjects] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedRoom, setSelectedRoom] = useState<string>('')
  const [selectedSection, setSelectedSection] = useState<string>('')
  
  // Group products by category when no filter applied
  const [groupByCategory, setGroupByCategory] = useState(true)
  
  // Add product modal
  const [addProductModal, setAddProductModal] = useState(false)
  const [newProduct, setNewProduct] = useState<NewProductForm>({
    name: '',
    description: '',
    brand: '',
    sku: '',
    modelNumber: '',
    color: '',
    finish: '',
    material: '',
    width: '',
    height: '',
    depth: '',
    length: '',
    dimensionUnit: 'cm',
    rrp: '',
    tradePrice: '',
    currency: 'GBP',
    supplierName: '',
    supplierPhone: '',
    supplierEmail: '',
    supplierAddress: '',
    supplierLink: '',
    leadTime: '',
    isTaxable: true,
    notes: '',
    categoryId: '',
    images: []
  })
  const [creatingProduct, setCreatingProduct] = useState(false)

  // Load categories
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch('/api/products/categories')
        const data = await res.json()
        if (data.categories) {
          setCategories(data.categories)
          // Expand all parent categories by default
          const parents = data.categories.filter((c: Category) => !c.parentId).map((c: Category) => c.id)
          setExpandedCategories(new Set(parents))
        }
      } catch (error) {
        console.error('Failed to load categories:', error)
      }
    }
    loadCategories()
  }, [])

  // Load products
  const loadProducts = useCallback(async () => {
    setProductsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        status: 'ACTIVE'
      })
      if (selectedCategory) params.set('categoryId', selectedCategory)
      if (searchQuery) params.set('search', searchQuery)
      
      const res = await fetch(`/api/products?${params}`)
      const data = await res.json()
      
      if (data.products) {
        setProducts(data.products)
        setTotalPages(data.pagination?.totalPages || 1)
        setTotalProducts(data.pagination?.total || 0)
      }
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setProductsLoading(false)
      setLoading(false)
    }
  }, [page, selectedCategory, searchQuery])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // Load projects for add to room modal
  const loadProjects = async () => {
    try {
      const res = await fetch('/api/extension/projects')
      const data = await res.json()
      if (data.projects) {
        setProjects(data.projects)
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  // Load rooms for selected project
  const loadRooms = async (projectId: string) => {
    try {
      const res = await fetch(`/api/extension/rooms?projectId=${projectId}`)
      const data = await res.json()
      if (data.rooms) {
        setRooms(data.rooms)
      }
    } catch (error) {
      console.error('Failed to load rooms:', error)
    }
  }

  // Load sections for selected room
  const loadSections = async (roomId: string) => {
    try {
      const res = await fetch(`/api/extension/sections?roomId=${roomId}`)
      const data = await res.json()
      if (data.sections) {
        setSections(data.sections)
      }
    } catch (error) {
      console.error('Failed to load sections:', error)
    }
  }

  const handleCategoryClick = (categoryId: string | null) => {
    setSelectedCategory(categoryId)
    setPage(1)
  }

  const toggleCategoryExpand = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadProducts()
  }

  const handleAddToRoom = (product: Product) => {
    setAddToRoomModal({ open: true, product })
    loadProjects()
  }

  const handleSubmitAddToRoom = async () => {
    if (!addToRoomModal.product || !selectedRoom || !selectedSection) return

    try {
      const res = await fetch('/api/extension/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: 'room',
          roomId: selectedRoom,
          sectionId: selectedSection,
          item: {
            name: addToRoomModal.product.name,
            description: addToRoomModal.product.description,
            supplierName: addToRoomModal.product.brand || addToRoomModal.product.supplierName,
            supplierLink: addToRoomModal.product.supplierLink,
            modelNumber: addToRoomModal.product.sku || addToRoomModal.product.modelNumber,
            unitCost: addToRoomModal.product.rrp,
            customFields: {
              colour: addToRoomModal.product.color,
              finish: addToRoomModal.product.finish,
              material: addToRoomModal.product.material,
              tradePrice: addToRoomModal.product.tradePrice
            },
            attachments: {
              images: addToRoomModal.product.images
            }
          }
        })
      })

      if (res.ok) {
        // Update usage count locally
        setProducts(prev => prev.map(p => 
          p.id === addToRoomModal.product!.id 
            ? { ...p, usageCount: p.usageCount + 1 } 
            : p
        ))
        setAddToRoomModal({ open: false, product: null })
        setSelectedProject('')
        setSelectedRoom('')
        setSelectedSection('')
        setRooms([])
        setSections([])
      }
    } catch (error) {
      console.error('Failed to add product to room:', error)
    }
  }

  const handleDeleteProduct = async () => {
    if (!deleteConfirm.product) return

    try {
      const res = await fetch(`/api/products?id=${deleteConfirm.product.id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== deleteConfirm.product!.id))
        setDeleteConfirm({ open: false, product: null })
      }
    } catch (error) {
      console.error('Failed to delete product:', error)
    }
  }

  const handleOpenProduct = (product: Product) => {
    setProductDetail({ open: true, product, editing: false })
    setEditForm(product)
  }

  const handleStartEdit = () => {
    if (productDetail.product) {
      setEditForm(productDetail.product)
      setProductDetail(prev => ({ ...prev, editing: true }))
    }
  }

  const handleCancelEdit = () => {
    if (productDetail.product) {
      setEditForm(productDetail.product)
      setProductDetail(prev => ({ ...prev, editing: false }))
    }
  }

  const handleSaveProduct = async () => {
    if (!productDetail.product) return
    setSaving(true)

    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: productDetail.product.id,
          ...editForm
        })
      })

      if (res.ok) {
        const data = await res.json()
        // Update local state
        setProducts(prev => prev.map(p => 
          p.id === productDetail.product!.id ? { ...p, ...data.product } : p
        ))
        setProductDetail({ open: true, product: { ...productDetail.product, ...data.product }, editing: false })
      }
    } catch (error) {
      console.error('Failed to save product:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateProduct = async () => {
    if (!newProduct.name) return
    setCreatingProduct(true)

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProduct,
          rrp: newProduct.rrp ? parseFloat(newProduct.rrp) : null,
          tradePrice: newProduct.tradePrice ? parseFloat(newProduct.tradePrice) : null,
          categoryId: newProduct.categoryId || null
        })
      })

      if (res.ok) {
        // Reset form
        setNewProduct({
          name: '',
          description: '',
          brand: '',
          sku: '',
          modelNumber: '',
          color: '',
          finish: '',
          material: '',
          width: '',
          height: '',
          depth: '',
          length: '',
          dimensionUnit: 'cm',
          rrp: '',
          tradePrice: '',
          currency: 'GBP',
          supplierName: '',
          supplierPhone: '',
          supplierEmail: '',
          supplierAddress: '',
          supplierLink: '',
          leadTime: '',
          isTaxable: true,
          notes: '',
          categoryId: '',
          images: []
        })
        setAddProductModal(false)
        loadProducts()
      }
    } catch (error) {
      console.error('Failed to create product:', error)
    } finally {
      setCreatingProduct(false)
    }
  }

  // Group products by category for display
  const getProductsByCategory = () => {
    const grouped: Record<string, { category: Category | null; products: Product[] }> = {}
    
    products.forEach(product => {
      const catId = product.categoryId || 'uncategorized'
      if (!grouped[catId]) {
        grouped[catId] = {
          category: product.category || null,
          products: []
        }
      }
      grouped[catId].products.push(product)
    })

    return grouped
  }

  const getCategoryIcon = (slug: string) => {
    const Icon = categoryIcons[slug] || Package
    return <Icon className="w-4 h-4" />
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return '-'
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(price)
  }

  // Build category tree
  const parentCategories = categories.filter(c => !c.parentId)
  const getChildCategories = (parentId: string) => categories.filter(c => c.parentId === parentId)

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-gray-50/50 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Product Library
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {/* All Products */}
          <button
            onClick={() => handleCategoryClick(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === null 
                ? 'bg-emerald-100 text-emerald-800' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            All Products
            <span className="ml-auto text-xs text-gray-500">{totalProducts}</span>
          </button>

          <div className="mt-4">
            <p className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Categories
            </p>
          </div>

          {/* Category Tree */}
          <div className="mt-2 space-y-1">
            {parentCategories.map(parent => (
              <div key={parent.id}>
                <div className="flex items-center">
                  <button
                    onClick={() => toggleCategoryExpand(parent.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {expandedCategories.has(parent.id) 
                      ? <ChevronDown className="w-4 h-4 text-gray-400" />
                      : <ChevronRight className="w-4 h-4 text-gray-400" />
                    }
                  </button>
                  <button
                    onClick={() => handleCategoryClick(parent.id)}
                    className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedCategory === parent.id 
                        ? 'bg-emerald-100 text-emerald-800 font-medium' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {getCategoryIcon(parent.slug)}
                    {parent.name}
                  </button>
                </div>

                {/* Child categories */}
                {expandedCategories.has(parent.id) && (
                  <div className="ml-5 mt-1 space-y-0.5 border-l border-gray-200 pl-2">
                    {getChildCategories(parent.id).map(child => (
                      <button
                        key={child.id}
                        onClick={() => handleCategoryClick(child.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                          selectedCategory === child.id 
                            ? 'bg-emerald-100 text-emerald-800 font-medium' 
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {child.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="p-4 border-b bg-white">
          <div className="flex items-center justify-between gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>

            {/* View Toggle & Actions */}
            <div className="flex items-center gap-2">
              <div className="flex items-center border rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-100' : ''}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-100' : ''}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <Button onClick={() => setAddProductModal(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-1" />
                Add Product
              </Button>
            </div>
          </div>

          {/* Active Filters */}
          {(selectedCategory || searchQuery) && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-gray-500">Filters:</span>
              {selectedCategory && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  {categories.find(c => c.id === selectedCategory)?.name}
                  <button onClick={() => setSelectedCategory(null)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  "{searchQuery}"
                  <button onClick={() => setSearchQuery('')}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </header>

        {/* Product Grid/List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Package className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery 
                  ? `No products match "${searchQuery}"`
                  : 'Start adding products using the Chrome extension'
                }
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View - Group by category when showing all */
            !selectedCategory && !searchQuery ? (
              <div className="space-y-8">
                {Object.entries(getProductsByCategory()).map(([catId, { category, products: catProducts }]) => (
                  <div key={catId}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      {category ? (
                        <>
                          {getCategoryIcon(category.slug)}
                          {category.name}
                        </>
                      ) : (
                        <>
                          <Package className="w-5 h-5 text-gray-400" />
                          Uncategorized
                        </>
                      )}
                      <Badge variant="secondary" className="text-xs">{catProducts.length}</Badge>
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {catProducts.map(product => (
                        <ProductCard 
                          key={product.id} 
                          product={product} 
                          onOpen={handleOpenProduct}
                          onAddToRoom={handleAddToRoom}
                          onDelete={(p) => setDeleteConfirm({ open: true, product: p })}
                          formatPrice={formatPrice}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {products.map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onOpen={handleOpenProduct}
                    onAddToRoom={handleAddToRoom}
                    onDelete={(p) => setDeleteConfirm({ open: true, product: p })}
                    formatPrice={formatPrice}
                  />
                ))}
              </div>
            )
          ) : (
            /* List View */
            <div className="space-y-2">
              {products.map(product => (
                <Card 
                  key={product.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleOpenProduct(product)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Thumbnail */}
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {product.thumbnailUrl || product.images?.[0] ? (
                        <img
                          src={product.thumbnailUrl || product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900">{product.name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        {product.brand && <span>{product.brand}</span>}
                        {product.sku && <span>SKU: {product.sku}</span>}
                        {product.category && (
                          <Badge variant="outline" className="text-xs">
                            {product.category.name}
                          </Badge>
                        )}
                      </div>
                      {product.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {/* Price & Actions */}
                    <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatPrice(product.rrp)}</p>
                        {product.tradePrice && (
                          <p className="text-xs text-gray-500">Trade: {formatPrice(product.tradePrice)}</p>
                        )}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleOpenProduct(product)}>
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button size="sm" onClick={() => handleAddToRoom(product)}>
                        <Building className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenProduct(product)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {product.supplierLink && (
                            <DropdownMenuItem asChild>
                              <a href={product.supplierLink} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View Source
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => setDeleteConfirm({ open: true, product })}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Add to Room Modal */}
      <Dialog open={addToRoomModal.open} onOpenChange={(open) => !open && setAddToRoomModal({ open: false, product: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Room</DialogTitle>
            <DialogDescription>
              Add "{addToRoomModal.product?.name}" to a room's FFE schedule.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select 
                value={selectedProject} 
                onValueChange={(val) => {
                  setSelectedProject(val)
                  setSelectedRoom('')
                  setSelectedSection('')
                  setSections([])
                  loadRooms(val)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProject && rooms.length > 0 && (
              <div className="space-y-2">
                <Label>Room</Label>
                <Select 
                  value={selectedRoom} 
                  onValueChange={(val) => {
                    setSelectedRoom(val)
                    setSelectedSection('')
                    loadSections(val)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a room..." />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map(room => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name || room.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedRoom && sections.length > 0 && (
              <div className="space-y-2">
                <Label>Section</Label>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a section..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map(section => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddToRoomModal({ open: false, product: null })}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitAddToRoom}
              disabled={!selectedRoom || !selectedSection}
            >
              Add to Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, product: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm.product?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm({ open: false, product: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProduct}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Detail/Edit Modal */}
      <Dialog open={productDetail.open} onOpenChange={(open) => !open && setProductDetail({ open: false, product: null, editing: false })}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{productDetail.editing ? 'Edit Product' : productDetail.product?.name}</span>
              {!productDetail.editing && productDetail.product && (
                <Button variant="outline" size="sm" onClick={handleStartEdit}>
                  <Pencil className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          {productDetail.product && !productDetail.editing && (
            /* View Mode */
            <div className="space-y-6">
              {/* Image */}
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                {productDetail.product.thumbnailUrl || productDetail.product.images?.[0] ? (
                  <img
                    src={productDetail.product.thumbnailUrl || productDetail.product.images[0]}
                    alt={productDetail.product.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-gray-300" />
                  </div>
                )}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                {productDetail.product.brand && (
                  <div>
                    <Label className="text-gray-500">Brand</Label>
                    <p className="font-medium">{productDetail.product.brand}</p>
                  </div>
                )}
                {productDetail.product.sku && (
                  <div>
                    <Label className="text-gray-500">SKU</Label>
                    <p className="font-medium">{productDetail.product.sku}</p>
                  </div>
                )}
                {productDetail.product.modelNumber && (
                  <div>
                    <Label className="text-gray-500">Model Number</Label>
                    <p className="font-medium">{productDetail.product.modelNumber}</p>
                  </div>
                )}
                {productDetail.product.category && (
                  <div>
                    <Label className="text-gray-500">Category</Label>
                    <p className="font-medium">{productDetail.product.category.name}</p>
                  </div>
                )}
                {productDetail.product.rrp && (
                  <div>
                    <Label className="text-gray-500">RRP</Label>
                    <p className="font-medium text-lg">{formatPrice(productDetail.product.rrp)}</p>
                  </div>
                )}
                {productDetail.product.tradePrice && (
                  <div>
                    <Label className="text-gray-500">Trade Price</Label>
                    <p className="font-medium text-lg">{formatPrice(productDetail.product.tradePrice)}</p>
                  </div>
                )}
                {productDetail.product.color && (
                  <div>
                    <Label className="text-gray-500">Color</Label>
                    <p className="font-medium">{productDetail.product.color}</p>
                  </div>
                )}
                {productDetail.product.finish && (
                  <div>
                    <Label className="text-gray-500">Finish</Label>
                    <p className="font-medium">{productDetail.product.finish}</p>
                  </div>
                )}
                {productDetail.product.material && (
                  <div>
                    <Label className="text-gray-500">Material</Label>
                    <p className="font-medium">{productDetail.product.material}</p>
                  </div>
                )}
                {productDetail.product.supplierName && (
                  <div>
                    <Label className="text-gray-500">Supplier</Label>
                    <p className="font-medium">{productDetail.product.supplierName}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {productDetail.product.description && (
                <div>
                  <Label className="text-gray-500">Description</Label>
                  <p className="mt-1 text-gray-700 whitespace-pre-wrap">{productDetail.product.description}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={() => handleAddToRoom(productDetail.product!)} className="flex-1">
                  <Building className="w-4 h-4 mr-2" />
                  Add to Room
                </Button>
                {productDetail.product.supplierLink && (
                  <Button variant="outline" asChild>
                    <a href={productDetail.product.supplierLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Source
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}

          {productDetail.editing && (
            /* Edit Mode */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-brand">Brand</Label>
                  <Input
                    id="edit-brand"
                    value={editForm.brand || ''}
                    onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sku">SKU</Label>
                  <Input
                    id="edit-sku"
                    value={editForm.sku || ''}
                    onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-model">Model Number</Label>
                  <Input
                    id="edit-model"
                    value={editForm.modelNumber || ''}
                    onChange={(e) => setEditForm({ ...editForm, modelNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-rrp">RRP</Label>
                  <Input
                    id="edit-rrp"
                    type="number"
                    step="0.01"
                    value={editForm.rrp || ''}
                    onChange={(e) => setEditForm({ ...editForm, rrp: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-trade">Trade Price</Label>
                  <Input
                    id="edit-trade"
                    type="number"
                    step="0.01"
                    value={editForm.tradePrice || ''}
                    onChange={(e) => setEditForm({ ...editForm, tradePrice: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-color">Color</Label>
                  <Input
                    id="edit-color"
                    value={editForm.color || ''}
                    onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-finish">Finish</Label>
                  <Input
                    id="edit-finish"
                    value={editForm.finish || ''}
                    onChange={(e) => setEditForm({ ...editForm, finish: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-material">Material</Label>
                  <Input
                    id="edit-material"
                    value={editForm.material || ''}
                    onChange={(e) => setEditForm({ ...editForm, material: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-supplier">Supplier Name</Label>
                  <Input
                    id="edit-supplier"
                    value={editForm.supplierName || ''}
                    onChange={(e) => setEditForm({ ...editForm, supplierName: e.target.value })}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-link">Supplier Link</Label>
                  <Input
                    id="edit-link"
                    type="url"
                    value={editForm.supplierLink || ''}
                    onChange={(e) => setEditForm({ ...editForm, supplierLink: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Select 
                    value={editForm.categoryId || ''} 
                    onValueChange={(val) => setEditForm({ ...editForm, categoryId: val || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  rows={4}
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSaveProduct} disabled={saving || !editForm.name}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Product Modal */}
      <Dialog open={addProductModal} onOpenChange={setAddProductModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0 gap-0">
          <div className="flex h-[85vh]">
            {/* Main Form */}
            <div className="flex-1 flex flex-col">
              <DialogHeader className="p-6 pb-4 border-b">
                <DialogTitle>Add New Product</DialogTitle>
                <DialogDescription>
                  Manually add a product to your library
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  {/* Image Upload Area */}
                  <div className="flex gap-4">
                    <div className="w-24 h-24 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                      {newProduct.images[0] ? (
                        <img src={newProduct.images[0]} alt="" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-center p-4">
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">Drag & drop or <span className="text-emerald-600 font-medium">browse files</span></p>
                      <p className="text-xs text-gray-400 mt-1">Upload up to 3 images</p>
                    </div>
                  </div>

                  {/* Product Name */}
                  <div className="space-y-2">
                    <Label htmlFor="new-name">Product Name *</Label>
                    <Input
                      id="new-name"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      placeholder="e.g. Bed #1 - Drem Decor"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="new-description">Product Description</Label>
                    <Textarea
                      id="new-description"
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      rows={2}
                      placeholder="Enter product description..."
                    />
                  </div>

                  {/* Product Details */}
                  <div className="space-y-2">
                    <Label htmlFor="new-model">Product Details</Label>
                    <Input
                      id="new-model"
                      value={newProduct.modelNumber}
                      onChange={(e) => setNewProduct({ ...newProduct, modelNumber: e.target.value })}
                      placeholder="e.g. Rounded Headboard"
                    />
                  </div>

                  {/* Brand & SKU */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-brand">Brand</Label>
                      <Input
                        id="new-brand"
                        value={newProduct.brand}
                        onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-sku">SKU</Label>
                      <Input
                        id="new-sku"
                        value={newProduct.sku}
                        onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Lead Time & Product URL */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-leadtime">Lead Time</Label>
                      <Select 
                        value={newProduct.leadTime} 
                        onValueChange={(val) => setNewProduct({ ...newProduct, leadTime: val })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="-" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-2 weeks">1-2 weeks</SelectItem>
                          <SelectItem value="2-4 weeks">2-4 weeks</SelectItem>
                          <SelectItem value="4-6 weeks">4-6 weeks</SelectItem>
                          <SelectItem value="6-8 weeks">6-8 weeks</SelectItem>
                          <SelectItem value="8-12 weeks">8-12 weeks</SelectItem>
                          <SelectItem value="12+ weeks">12+ weeks</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-url">Product URL</Label>
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="new-url"
                          type="url"
                          value={newProduct.supplierLink}
                          onChange={(e) => setNewProduct({ ...newProduct, supplierLink: e.target.value })}
                          className="pl-10"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Product Specifications */}
                  <div className="pt-4 border-t">
                    <h4 className="font-medium text-gray-900 mb-4">Product Specifications</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-height">Height</Label>
                        <Input
                          id="new-height"
                          value={newProduct.height}
                          onChange={(e) => setNewProduct({ ...newProduct, height: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-depth">Depth</Label>
                        <Input
                          id="new-depth"
                          value={newProduct.depth}
                          onChange={(e) => setNewProduct({ ...newProduct, depth: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-width">Width</Label>
                        <Input
                          id="new-width"
                          value={newProduct.width}
                          onChange={(e) => setNewProduct({ ...newProduct, width: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-length">Length</Label>
                        <Input
                          id="new-length"
                          value={newProduct.length}
                          onChange={(e) => setNewProduct({ ...newProduct, length: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-colour">Colour</Label>
                        <Input
                          id="new-colour"
                          value={newProduct.color}
                          onChange={(e) => setNewProduct({ ...newProduct, color: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-finish">Finish</Label>
                        <Input
                          id="new-finish"
                          value={newProduct.finish}
                          onChange={(e) => setNewProduct({ ...newProduct, finish: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-material">Material</Label>
                        <Input
                          id="new-material"
                          value={newProduct.material}
                          onChange={(e) => setNewProduct({ ...newProduct, material: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-category">Product Category</Label>
                        <Select 
                          value={newProduct.categoryId} 
                          onValueChange={(val) => setNewProduct({ ...newProduct, categoryId: val })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-rrp">RRP</Label>
                      <Input
                        id="new-rrp"
                        type="number"
                        step="0.01"
                        value={newProduct.rrp}
                        onChange={(e) => setNewProduct({ ...newProduct, rrp: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-trade">Trade Price</Label>
                      <Input
                        id="new-trade"
                        type="number"
                        step="0.01"
                        value={newProduct.tradePrice}
                        onChange={(e) => setNewProduct({ ...newProduct, tradePrice: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Taxable Toggle */}
                  <div className="flex items-center gap-3">
                    <Switch
                      id="new-taxable"
                      checked={newProduct.isTaxable}
                      onCheckedChange={(checked) => setNewProduct({ ...newProduct, isTaxable: checked })}
                    />
                    <Label htmlFor="new-taxable">Product is taxable?</Label>
                  </div>

                  {/* Custom Specs Note */}
                  <div className="pt-4 border-t">
                    <h4 className="font-medium text-gray-900 mb-2">Custom Specs</h4>
                    <Textarea
                      value={newProduct.notes}
                      onChange={(e) => setNewProduct({ ...newProduct, notes: e.target.value })}
                      rows={3}
                      placeholder="Add any additional specifications or notes..."
                    />
                  </div>
                </div>
              </ScrollArea>

              {/* Actions */}
              <div className="p-6 pt-4 border-t flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setAddProductModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateProduct} 
                  disabled={creatingProduct || !newProduct.name}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {creatingProduct ? 'Creating...' : 'Add Product'}
                </Button>
              </div>
            </div>

            {/* Supplier Details Sidebar */}
            <div className="w-80 bg-gray-50 border-l flex flex-col">
              <div className="p-6 border-b bg-white">
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-2xl font-bold text-gray-500 mb-3">
                    {newProduct.supplierName ? newProduct.supplierName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : <User className="w-8 h-8" />}
                  </div>
                  <Input
                    value={newProduct.supplierName}
                    onChange={(e) => setNewProduct({ ...newProduct, supplierName: e.target.value })}
                    placeholder="Supplier Name"
                    className="text-center font-semibold border-0 bg-transparent text-lg h-auto py-1 focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-gray-400 mt-2.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-gray-500">Phone</Label>
                    <Input
                      value={newProduct.supplierPhone}
                      onChange={(e) => setNewProduct({ ...newProduct, supplierPhone: e.target.value })}
                      placeholder="e.g. 514-416-7701"
                      className="border-0 bg-transparent px-0 h-auto focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-gray-400 mt-2.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-gray-500">Email Address</Label>
                    <Input
                      type="email"
                      value={newProduct.supplierEmail}
                      onChange={(e) => setNewProduct({ ...newProduct, supplierEmail: e.target.value })}
                      placeholder="e.g. info@supplier.com"
                      className="border-0 bg-transparent px-0 h-auto focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-400 mt-2.5" />
                  <div className="flex-1">
                    <Label className="text-xs text-gray-500">Address</Label>
                    <Textarea
                      value={newProduct.supplierAddress}
                      onChange={(e) => setNewProduct({ ...newProduct, supplierAddress: e.target.value })}
                      placeholder="Enter address..."
                      rows={2}
                      className="border-0 bg-transparent px-0 resize-none focus-visible:ring-0"
                    />
                  </div>
                </div>

                <Button variant="outline" className="w-full mt-4">
                  Edit Contact Details
                </Button>
              </div>

              {/* Notes */}
              <div className="p-6 pt-0 flex-1">
                <Label className="text-xs text-gray-500">Notes</Label>
                <Textarea
                  placeholder="Add notes here..."
                  rows={4}
                  className="mt-1 resize-none"
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

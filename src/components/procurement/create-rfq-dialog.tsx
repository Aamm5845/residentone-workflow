'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Search, Plus, Trash2, Paperclip } from 'lucide-react'
import toast from 'react-hot-toast'
import FileUpload, { UploadedFile } from './file-upload'

interface CreateRFQDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  projectId?: string
  preselectedItemIds?: string[]  // Pre-select items (from bulk quote or per-item quote)
}

interface Project {
  id: string
  name: string
  projectNumber?: string
}

interface Supplier {
  id: string
  name: string
  email: string
  contactName?: string
}

interface SpecItem {
  id: string
  name: string
  description?: string
  category?: string
  quantity?: number
  roomName?: string
}

export default function CreateRFQDialog({
  open,
  onOpenChange,
  onSuccess,
  projectId: initialProjectId,
  preselectedItemIds
}: CreateRFQDialogProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)

  // Form data
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState(initialProjectId || '')
  const [responseDeadline, setResponseDeadline] = useState('')
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  // Data
  const [projects, setProjects] = useState<Project[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [specItems, setSpecItems] = useState<SpecItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // File attachments
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([])

  useEffect(() => {
    if (open) {
      loadProjects()
      loadSuppliers()

      // Handle preselected items - skip to step 2 (supplier selection)
      if (preselectedItemIds?.length && !hasInitialized) {
        setSelectedItems(preselectedItemIds)
        setStep(2) // Skip to supplier selection
        setHasInitialized(true)

        // Generate a default title based on item count
        if (preselectedItemIds.length === 1) {
          setTitle('Quote Request')
        } else {
          setTitle(`Quote Request (${preselectedItemIds.length} items)`)
        }
      }
    } else {
      // Reset initialization flag when dialog closes
      setHasInitialized(false)
    }
  }, [open, preselectedItemIds, hasInitialized])

  useEffect(() => {
    if (projectId) {
      // If we have preselected items, load those specifically
      loadSpecItems(preselectedItemIds)
    }
  }, [projectId, preselectedItemIds])

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }

  const loadSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers')
      if (response.ok) {
        const data = await response.json()
        setSuppliers(data.suppliers || [])
      }
    } catch (error) {
      console.error('Error loading suppliers:', error)
    }
  }

  const loadSpecItems = async (itemIds?: string[]) => {
    if (!projectId) return
    setLoading(true)
    try {
      // Load FFE items - if we have preselected IDs, fetch those specifically
      const url = itemIds && itemIds.length > 0
        ? `/api/projects/${projectId}/ffe-specs?ids=${itemIds.join(',')}`
        : `/api/projects/${projectId}/ffe-specs`

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setSpecItems(data.items || [])
      }
    } catch (error) {
      console.error('Error loading spec items:', error)
      // Fallback: empty list for now
      setSpecItems([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!projectId) {
      toast.error('Please select a project')
      return
    }
    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }
    if (selectedSuppliers.length === 0) {
      toast.error('Please select at least one supplier')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/rfq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title,
          description,
          responseDeadline: responseDeadline || null,
          supplierIds: selectedSuppliers,
          documentIds: attachedFiles.map(f => f.id),
          lineItems: selectedItems.map(itemId => {
            const item = specItems.find(s => s.id === itemId)
            return {
              roomFFEItemId: itemId,
              itemName: item?.name || '',
              itemDescription: item?.description || '',
              quantity: item?.quantity || 1
            }
          })
        })
      })

      if (response.ok) {
        toast.success('RFQ created successfully')
        resetForm()
        onSuccess()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create RFQ')
      }
    } catch (error) {
      console.error('Error creating RFQ:', error)
      toast.error('Failed to create RFQ')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setTitle('')
    setDescription('')
    setProjectId(initialProjectId || '')
    setResponseDeadline('')
    setSelectedSuppliers([])
    setSelectedItems([])
    setSearchQuery('')
    setHasInitialized(false)
    setAttachedFiles([])
  }

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev =>
      prev.includes(supplierId)
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    )
  }

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const selectAllItems = () => {
    const filteredIds = filteredItems.map(item => item.id)
    if (selectedItems.length === filteredIds.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredIds)
    }
  }

  const filteredItems = specItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.roomName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && 'Create RFQ - Basic Info'}
            {step === 2 && 'Create RFQ - Select Suppliers'}
            {step === 3 && 'Create RFQ - Select Items'}
          </DialogTitle>
          {preselectedItemIds?.length ? (
            <p className="text-sm text-gray-500">
              {preselectedItemIds.length} item{preselectedItemIds.length > 1 ? 's' : ''} selected from specs
            </p>
          ) : null}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Project <span className="text-red-500">*</span></Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.projectNumber ? `${project.projectNumber} - ` : ''}{project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>RFQ Title <span className="text-red-500">*</span></Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Kitchen Fixtures Quote Request"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional details or requirements..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Response Deadline</Label>
                <Input
                  type="date"
                  value={responseDeadline}
                  onChange={(e) => setResponseDeadline(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* File Attachments */}
              {projectId && (
                <div className="space-y-2">
                  <Label>Attachments</Label>
                  <p className="text-xs text-gray-500 mb-2">
                    Attach drawings, specs, or photos for suppliers
                  </p>
                  <FileUpload
                    projectId={projectId}
                    category="General"
                    fileType="Drawings"
                    onUploadComplete={(file) => setAttachedFiles(prev => [...prev, file])}
                    onUploadError={(error) => console.error('Upload error:', error)}
                    maxFiles={10}
                    visibleToSupplier={true}
                    compact={true}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Suppliers */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Select suppliers to receive this RFQ
              </p>

              {suppliers.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500 mb-4">No suppliers found</p>
                  <Button variant="outline" asChild>
                    <a href="/preferences?tab=suppliers" target="_blank">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Suppliers
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {suppliers.map(supplier => (
                    <label
                      key={supplier.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedSuppliers.includes(supplier.id)
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Checkbox
                        checked={selectedSuppliers.includes(supplier.id)}
                        onCheckedChange={() => toggleSupplier(supplier.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{supplier.name}</p>
                        <p className="text-sm text-gray-500">{supplier.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div className="text-sm text-gray-500">
                {selectedSuppliers.length} supplier(s) selected
              </div>
            </div>
          )}

          {/* Step 3: Select Items */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search items..."
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" onClick={selectAllItems}>
                  {selectedItems.length === filteredItems.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">
                    {specItems.length === 0
                      ? 'No spec items found for this project'
                      : 'No items match your search'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {filteredItems.map(item => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedItems.includes(item.id)
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Checkbox
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-gray-500 truncate">{item.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          {item.category && <span className="bg-gray-100 px-2 py-0.5 rounded">{item.category}</span>}
                          {item.roomName && <span>{item.roomName}</span>}
                          {item.quantity && <span>Qty: {item.quantity}</span>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div className="text-sm text-gray-500">
                {selectedItems.length} item(s) selected
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 pt-4 border-t">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && (!projectId || !title.trim())}
            >
              Next
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create RFQ
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

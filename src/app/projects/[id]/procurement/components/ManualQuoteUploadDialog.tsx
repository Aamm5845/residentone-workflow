'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Upload,
  FileText,
  Loader2,
  Building2,
  X,
  AlertCircle,
  Sparkles
} from 'lucide-react'
import { toast } from 'sonner'

interface Supplier {
  id: string
  name: string
  email: string
  logo?: string | null
}

interface ManualQuoteUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onUploadComplete: (data: {
    fileUrl: string
    fileType: string
    supplierId: string
    supplierName: string
  }) => void
  // New: callback when analysis is complete with data ready for review
  onAnalysisComplete?: (analysisData: any, specItems: any[]) => void
}

export default function ManualQuoteUploadDialog({
  open,
  onOpenChange,
  projectId,
  onUploadComplete,
  onAnalysisComplete
}: ManualQuoteUploadDialogProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [uploadedFile, setUploadedFile] = useState<{ url: string; type: string; name: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState('')

  // Fetch suppliers when dialog opens
  useEffect(() => {
    if (open && suppliers.length === 0) {
      fetchSuppliers()
    }
  }, [open])

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true)
    try {
      const res = await fetch('/api/suppliers')
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data.suppliers || data || [])
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      toast.error('Failed to load suppliers')
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a PDF or image file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum 10MB.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('imageType', 'quote-document')
      formData.append('projectId', projectId)

      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        setUploadedFile({
          url: data.url,
          type: file.type,
          name: file.name
        })
        toast.success('File uploaded')
      } else {
        toast.error('Failed to upload file')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      toast.error('Failed to upload file')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleProceed = async () => {
    if (!uploadedFile || !selectedSupplierId) {
      toast.error('Please select a supplier and upload a quote document')
      return
    }

    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId)
    if (!selectedSupplier) {
      toast.error('Please select a valid supplier')
      return
    }

    // If we have the new callback, do the analysis in this dialog
    if (onAnalysisComplete) {
      setAnalyzing(true)
      setAnalysisProgress('Extracting line items from quote...')

      try {
        // Call the AI extraction API
        const res = await fetch(`/api/projects/${projectId}/procurement/manual-quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: uploadedFile.url,
            fileType: uploadedFile.type,
            supplierId: selectedSupplierId,
            supplierName: selectedSupplier.name
          })
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.message || 'Failed to analyze quote')
        }

        setAnalysisProgress('Matching items to your specs...')
        const analysisData = await res.json()

        // Fetch all spec items for the matching dialog
        const specRes = await fetch(`/api/projects/${projectId}/ffe-specs`)
        let specItems: any[] = []
        if (specRes.ok) {
          const specData = await specRes.json()
          const items = specData.items || []
          specItems = items.map((item: any) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            sku: item.sku,
            brand: item.brand,
            imageUrl: item.images?.[0],
            roomName: item.roomName,
            existingSupplierId: item.supplierId,
            existingSupplierName: item.supplierName,
            existingTradePrice: item.tradePrice ? Number(item.tradePrice) : undefined
          }))
        }

        // Close dialog and pass data to parent
        handleClose()
        onAnalysisComplete(analysisData, specItems)

      } catch (error: any) {
        console.error('Error analyzing quote:', error)
        toast.error(error.message || 'Failed to analyze quote')
        setAnalyzing(false)
        setAnalysisProgress('')
      }
    } else {
      // Legacy callback - just pass the upload data
      onUploadComplete({
        fileUrl: uploadedFile.url,
        fileType: uploadedFile.type,
        supplierId: selectedSupplierId,
        supplierName: selectedSupplier.name
      })
    }
  }

  const handleClose = () => {
    if (analyzing) return // Don't allow close while analyzing
    setSelectedSupplierId('')
    setUploadedFile(null)
    setAnalyzing(false)
    setAnalysisProgress('')
    onOpenChange(false)
  }

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Supplier Quote
          </DialogTitle>
        </DialogHeader>

        {/* Analyzing State - Full overlay */}
        {analyzing ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-blue-600 animate-pulse" />
              </div>
              <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Quote</h3>
            <p className="text-sm text-gray-600 text-center max-w-xs">
              {analysisProgress || 'Please wait while AI extracts and matches line items...'}
            </p>
            <p className="text-xs text-gray-400 mt-4">This may take up to a minute</p>
          </div>
        ) : (
          <>
            <div className="space-y-5 py-2">
              {/* Supplier Selection */}
              <div className="space-y-2">
                <Label>Select Supplier *</Label>
                <Select
                  value={selectedSupplierId}
                  onValueChange={setSelectedSupplierId}
                  disabled={loadingSuppliers}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loadingSuppliers ? "Loading suppliers..." : "Select a supplier"} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(supplier => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        <div className="flex items-center gap-2">
                          {supplier.logo ? (
                            <img
                              src={supplier.logo}
                              alt={supplier.name}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                              <Building2 className="w-3 h-3 text-gray-400" />
                            </div>
                          )}
                          <span>{supplier.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSupplier && (
                  <p className="text-xs text-gray-500">{selectedSupplier.email}</p>
                )}
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Quote Document *</Label>
                {uploadedFile ? (
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <FileText className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="font-medium text-gray-900 text-sm truncate" title={uploadedFile.name}>
                        {uploadedFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {uploadedFile.type === 'application/pdf' ? 'PDF Document' : 'Image'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 flex-shrink-0"
                      onClick={() => setUploadedFile(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                      {uploading ? (
                        <>
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                          <p className="text-sm text-gray-600">Uploading...</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                          <p className="text-sm font-medium text-gray-700">
                            Click to upload quote
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            PDF or image (max 10MB)
                          </p>
                        </>
                      )}
                    </div>
                  </label>
                )}
              </div>

              {/* Info */}
              <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-blue-800">
                  <p className="font-medium">How it works:</p>
                  <ol className="list-decimal list-inside mt-1 space-y-0.5 text-xs">
                    <li>AI will extract line items from the quote</li>
                    <li>Items will be matched to your All Specs</li>
                    <li>Review and approve matches</li>
                    <li>Trade prices will be updated</li>
                  </ol>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleProceed}
                disabled={!uploadedFile || !selectedSupplierId}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze Quote
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

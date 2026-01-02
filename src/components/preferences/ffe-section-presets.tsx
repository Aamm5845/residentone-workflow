'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, FolderCode, GripVertical, Percent } from 'lucide-react'

interface SectionPreset {
  id: string
  name: string
  docCodePrefix: string
  description: string | null
  markupPercent: number | null
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function FFESectionPresets() {
  const [presets, setPresets] = useState<SectionPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<SectionPreset | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formPrefix, setFormPrefix] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formMarkup, setFormMarkup] = useState('')

  // Fetch presets on mount
  useEffect(() => {
    fetchPresets()
  }, [])

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/ffe/section-presets')
      if (res.ok) {
        const data = await res.json()
        setPresets(data.presets || [])
      }
    } catch (error) {
      console.error('Error fetching presets:', error)
      toast.error('Failed to load section presets')
    } finally {
      setLoading(false)
    }
  }

  const openAddDialog = () => {
    setEditingPreset(null)
    setFormName('')
    setFormPrefix('')
    setFormDescription('')
    setFormMarkup('')
    setDialogOpen(true)
  }

  const openEditDialog = (preset: SectionPreset) => {
    setEditingPreset(preset)
    setFormName(preset.name)
    setFormPrefix(preset.docCodePrefix)
    setFormDescription(preset.description || '')
    setFormMarkup(preset.markupPercent?.toString() || '')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Name is required')
      return
    }
    if (!formPrefix.trim()) {
      toast.error('Doc code prefix is required')
      return
    }
    if (!/^[A-Za-z]{1,3}$/.test(formPrefix.trim())) {
      toast.error('Prefix must be 1-3 letters')
      return
    }

    setSaving(true)
    try {
      const isEdit = !!editingPreset
      const res = await fetch('/api/ffe/section-presets', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPreset?.id,
          name: formName.trim(),
          docCodePrefix: formPrefix.toUpperCase().trim(),
          description: formDescription.trim() || null,
          markupPercent: formMarkup.trim() || null
        })
      })

      const data = await res.json()

      if (res.ok) {
        toast.success(isEdit ? 'Preset updated' : 'Preset created')
        setDialogOpen(false)
        fetchPresets()
      } else {
        toast.error(data.error || 'Failed to save preset')
      }
    } catch (error) {
      console.error('Error saving preset:', error)
      toast.error('Failed to save preset')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (preset: SectionPreset) => {
    try {
      const res = await fetch('/api/ffe/section-presets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: preset.id,
          isActive: !preset.isActive
        })
      })

      if (res.ok) {
        setPresets(prev => prev.map(p =>
          p.id === preset.id ? { ...p, isActive: !p.isActive } : p
        ))
        toast.success(preset.isActive ? 'Preset disabled' : 'Preset enabled')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update preset')
      }
    } catch (error) {
      console.error('Error toggling preset:', error)
      toast.error('Failed to update preset')
    }
  }

  const handleDelete = async (preset: SectionPreset) => {
    if (!confirm(`Delete "${preset.name}" preset? This cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch(`/api/ffe/section-presets?id=${preset.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (res.ok) {
        toast.success('Preset deleted')
        fetchPresets()
      } else {
        toast.error(data.error || 'Failed to delete preset')
      }
    } catch (error) {
      console.error('Error deleting preset:', error)
      toast.error('Failed to delete preset')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderCode className="w-5 h-5" />
                Section Presets
              </CardTitle>
              <CardDescription>
                Configure section presets with doc code prefixes. Items in these sections will automatically get doc codes like PL-01, PL-02.
              </CardDescription>
            </div>
            <Button onClick={openAddDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Preset
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {presets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No section presets configured. Click "Add Preset" to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-24">Prefix</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24">Markup %</TableHead>
                  <TableHead className="w-20">Active</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {presets.map((preset) => (
                  <TableRow key={preset.id} className={!preset.isActive ? 'opacity-50' : ''}>
                    <TableCell>
                      <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                    </TableCell>
                    <TableCell className="font-medium">{preset.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {preset.docCodePrefix}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {preset.description || '-'}
                    </TableCell>
                    <TableCell>
                      {preset.markupPercent !== null ? (
                        <Badge variant="outline" className="font-mono">
                          {preset.markupPercent}%
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={preset.isActive}
                        onCheckedChange={() => handleToggleActive(preset)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(preset)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(preset)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            <strong>How it works:</strong> When you add a section using a preset in FFE Workspace,
            items in that section will automatically get doc codes like <code className="bg-blue-100 px-1 rounded">PL-01</code>,
            <code className="bg-blue-100 px-1 rounded ml-1">PL-02</code>, etc.
            The number increments automatically, but you can change it manually in All Specs.
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPreset ? 'Edit Section Preset' : 'Add Section Preset'}
            </DialogTitle>
            <DialogDescription>
              Configure a section preset with a unique doc code prefix.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Plumbing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prefix">Doc Code Prefix * (1-3 letters)</Label>
              <Input
                id="prefix"
                value={formPrefix}
                onChange={(e) => setFormPrefix(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="e.g., PL"
                maxLength={3}
                className="font-mono uppercase"
              />
              <p className="text-xs text-gray-500">
                Items will be numbered as {formPrefix || 'XX'}-01, {formPrefix || 'XX'}-02, etc.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="e.g., Plumbing fixtures and fittings"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="markup" className="flex items-center gap-2">
                <Percent className="w-4 h-4" />
                Default Markup % (optional)
              </Label>
              <Input
                id="markup"
                type="number"
                min="0"
                max="200"
                step="0.5"
                value={formMarkup}
                onChange={(e) => setFormMarkup(e.target.value)}
                placeholder="e.g., 25"
              />
              <p className="text-xs text-gray-500">
                This markup will be suggested when accepting supplier quotes for items in this section.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingPreset ? 'Save Changes' : 'Add Preset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

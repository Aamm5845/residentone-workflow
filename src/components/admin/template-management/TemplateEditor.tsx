'use client';

import React, { useState, useEffect } from 'react';
import { Plus, GripVertical, Trash2, Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { 
  FFETemplate, 
  FFETemplateSection, 
  FFETemplateItem, 
  FFESection, 
  FFEItemState 
} from '@/types/ffe-v2';
import { getPresetItemsForSection } from '@/lib/constants/ffe-section-presets';

interface TemplateEditorProps {
  template: FFETemplate | null;
  sections: FFESection[];
  orgId: string;
  onSave: (templateData: any) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

interface EditableTemplateSection extends Omit<FFETemplateSection, 'items'> {
  items: EditableTemplateItem[];
  isNew?: boolean;
}

interface EditableTemplateItem extends Omit<FFETemplateItem, 'id'> {
  id?: string;
  isNew?: boolean;
  linkedItems?: string[]; // IDs of items this item creates
}

const ITEM_STATES: FFEItemState[] = [
  'PENDING', 'CONFIRMED', 'NOT_NEEDED', 'IN_PROGRESS', 'COMPLETE'
];

export function TemplateEditor({ 
  template, 
  sections, 
  orgId, 
  onSave, 
  onCancel, 
  isLoading 
}: TemplateEditorProps) {
  const [formData, setFormData] = useState({
    name: template?.name || 'New Template',
    description: template?.description || 'Template description'
  });

  const [templateSections, setTemplateSections] = useState<EditableTemplateSection[]>([]);
  const [isSectionLibraryOpen, setIsSectionLibraryOpen] = useState(false);
  const [isCreatingCustomSection, setIsCreatingCustomSection] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    sectionId: string;
    itemIndex: number;
    item: EditableTemplateItem;
  } | null>(null);

  // Initialize template sections
  useEffect(() => {
    if (template?.sections) {
      setTemplateSections(template.sections.map(section => ({
        ...section,
        items: (section.items || []).map(item => ({
          ...item,
          // Extract linkedItems from customFields if it exists
          linkedItems: item.customFields?.linkedItems || item.linkedItems || [],
          // Extract notes from customFields if it exists
          notes: item.customFields?.notes || item.notes || ''
        }))
      })));
    } else {
      setTemplateSections([]);
    }
  }, [template]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Please enter a template name');
      return;
    }
    
    try {
      const templateData = {
        ...formData,
        orgId,
        sections: templateSections.map(section => ({
          name: section.name,
          order: section.order,
          items: section.items.map(item => ({
            name: item.name,
            description: item.description,
            defaultState: item.defaultState,
            isRequired: item.isRequired,
            notes: item.notes,
            linkedItems: (item.linkedItems || []).filter(Boolean)
          }))
        }))
      };

      console.log('TemplateEditor: Full form data:', formData);
      console.log('TemplateEditor: Template sections:', templateSections);
      console.log('TemplateEditor: Final template data being submitted:', JSON.stringify(templateData, null, 2));
      await onSave(templateData);
      console.log('TemplateEditor: Save completed');
    } catch (error) {
      console.error('TemplateEditor: Failed to save template:', error);
      // Don't close the form - let the parent handle the error
    }
  };

  // Section management
  const addSectionFromLibrary = (section: FFESection) => {
    // Get preset items for this section
    const presetItems = getPresetItemsForSection(section.name);
    
    const newTemplateSection: EditableTemplateSection = {
      id: `temp-${Date.now()}`,
      name: section.name,
      order: templateSections.length,
      items: presetItems.map((preset, index) => ({
        name: preset.name,
        description: preset.description || '',
        defaultState: preset.defaultState,
        isRequired: preset.isRequired,
        order: preset.order,
        notes: preset.notes || '',
        linkedItems: [],
        isNew: true
      })),
      isNew: true
    };

    setTemplateSections([...templateSections, newTemplateSection]);
    setIsSectionLibraryOpen(false);
  };

  const addCustomSection = async (sectionName: string) => {
    // Add to current template immediately
    const newTemplateSection: EditableTemplateSection = {
      id: `custom-${Date.now()}`,
      name: sectionName,
      order: templateSections.length,
      items: [],
      isNew: true
    };

    setTemplateSections([...templateSections, newTemplateSection]);
    setIsCreatingCustomSection(false);
    setIsSectionLibraryOpen(false);
    
    // Also save to the library for future use
    try {
      await fetch('/api/ffe/v2/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: sectionName,
          description: `Custom section: ${sectionName}`,
          defaultOrder: 999, // Custom sections go at the end
          applicableRoomTypes: ['BEDROOM', 'BATHROOM', 'KITCHEN', 'LIVING_ROOM', 'DINING_ROOM', 'OFFICE'],
          isGlobal: true
        })
      });
      
    } catch (error) {
      console.log('Could not save custom section to library:', error);
      // Don't block the user if this fails - the section is still added to the current template
    }
  };

  const removeSection = (sectionIndex: number) => {
    const newSections = templateSections.filter((_, index) => index !== sectionIndex);
    // Reorder remaining sections
    const reorderedSections = newSections.map((section, index) => ({
      ...section,
      order: index
    }));
    setTemplateSections(reorderedSections);
  };

  const moveSection = (fromIndex: number, toIndex: number) => {
    const newSections = [...templateSections];
    const [movedSection] = newSections.splice(fromIndex, 1);
    newSections.splice(toIndex, 0, movedSection);
    
    // Update order
    const reorderedSections = newSections.map((section, index) => ({
      ...section,
      order: index
    }));
    
    setTemplateSections(reorderedSections);
  };

  // Item management
  const addItemToSection = (sectionIndex: number) => {
    const newItem: EditableTemplateItem = {
      name: '',
      description: '',
      defaultState: 'PENDING',
      isRequired: false,
      notes: '',
      linkedItems: [],
      isNew: true
    };

    setEditingItem({
      sectionId: templateSections[sectionIndex].id,
      itemIndex: -1, // -1 indicates new item
      item: newItem
    });
  };

  const editItem = (sectionIndex: number, itemIndex: number) => {
    const item = templateSections[sectionIndex].items[itemIndex];
    setEditingItem({
      sectionId: templateSections[sectionIndex].id,
      itemIndex,
      item: { ...item }
    });
  };

  const saveItem = (item: EditableTemplateItem) => {
    if (!editingItem) return;

    const sectionIndex = templateSections.findIndex(s => s.id === editingItem.sectionId);
    if (sectionIndex === -1) return;

    const newSections = [...templateSections];
    const section = { ...newSections[sectionIndex] };
    const newItems = [...section.items];

    if (editingItem.itemIndex === -1) {
      // Adding new item
      newItems.push(item);
    } else {
      // Editing existing item
      newItems[editingItem.itemIndex] = item;
    }

    section.items = newItems;
    newSections[sectionIndex] = section;
    setTemplateSections(newSections);
    setEditingItem(null);
  };

  const removeItem = (sectionIndex: number, itemIndex: number) => {
    const newSections = [...templateSections];
    const section = { ...newSections[sectionIndex] };
    section.items = section.items.filter((_, index) => index !== itemIndex);
    newSections[sectionIndex] = section;
    setTemplateSections(newSections);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
        {/* Header Form */}
        <div className="space-y-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter template name..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this template..."
              rows={2}
            />
          </div>

        </div>

        <Separator />

        {/* Sections */}
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Template Sections</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSectionLibraryOpen(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Section
            </Button>
          </div>

          <ScrollArea className="flex-1 h-full">
            <div className="space-y-4 pr-4 pb-4">
              {templateSections.map((section, sectionIndex) => (
                <Card key={section.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                        <h4 className="font-medium text-gray-900">{section.name}</h4>
                        <Badge variant="secondary">
                          {section.items.length} items
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addItemToSection(sectionIndex)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeSection(sectionIndex)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {section.items.length > 0 ? (
                      <div className="space-y-2">
                        {section.items.map((item, itemIndex) => (
                          <div
                            key={`${section.id}-${itemIndex}`}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-sm">{item.name}</div>
                              {item.description && (
                                <div className="text-xs text-gray-600 mt-1">{item.description}</div>
                              )}
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge variant={item.defaultState === 'PENDING' ? 'secondary' : 'default'} className="text-xs">
                                  {item.defaultState}
                                </Badge>
                                {item.isRequired && (
                                  <Badge variant="destructive" className="text-xs">
                                    Required
                                  </Badge>
                                )}
                                {item.linkedItems && item.linkedItems.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{item.linkedItems.length} linked
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => editItem(sectionIndex, itemIndex)}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removeItem(sectionIndex, itemIndex)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p className="text-sm">No items in this section</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addItemToSection(sectionIndex)}
                          className="mt-2"
                        >
                          Add first item
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {templateSections.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No sections added yet</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSectionLibraryOpen(true)}
                    className="mt-2"
                  >
                    Add your first section
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <Separator className="my-4" />
        <div className="flex items-center justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || !formData.name.trim()}>
            {isLoading ? 'Saving...' : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {template ? 'Update Template' : 'Create Template'}
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Section Library Dialog */}
      <Dialog open={isSectionLibraryOpen} onOpenChange={setIsSectionLibraryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Section</DialogTitle>
          </DialogHeader>
          
          {!isCreatingCustomSection ? (
            <div className="space-y-4">
              {/* Add Custom Section Button */}
              <Button
                variant="default"
                className="w-full"
                onClick={() => setIsCreatingCustomSection(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Custom Section
              </Button>
              
              {/* Divider */}
              <div className="flex items-center">
                <div className="flex-1 border-t border-gray-300" />
                <span className="px-3 text-sm text-gray-500">or choose from library</span>
                <div className="flex-1 border-t border-gray-300" />
              </div>
              
              {/* Library Sections */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {sections && sections.length > 0 ? (
                  sections.map((section) => (
                    <Button
                      key={section.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => addSectionFromLibrary(section)}
                    >
                      {section.name}
                    </Button>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm mb-2">No sections available in the library.</p>
                    <p className="text-xs">You can still create custom sections using the button above.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <CustomSectionForm
              onSave={addCustomSection}
              onCancel={() => setIsCreatingCustomSection(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Item Editor Dialog */}
      {editingItem && (
        <Dialog open={true} onOpenChange={() => setEditingItem(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingItem.itemIndex === -1 ? 'Add New Item' : 'Edit Item'}
              </DialogTitle>
            </DialogHeader>
            <ItemEditor
              item={editingItem.item}
              onSave={saveItem}
              onCancel={() => setEditingItem(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Item Editor Component
interface ItemEditorProps {
  item: EditableTemplateItem;
  onSave: (item: EditableTemplateItem) => void;
  onCancel: () => void;
}

function ItemEditor({ item, onSave, onCancel }: ItemEditorProps) {
  const [formData, setFormData] = useState({
    ...item,
    linkedItems: item.linkedItems || []
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="itemName">Item Name</Label>
        <Input
          id="itemName"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter item name..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="itemDescription">Description (Optional)</Label>
        <Textarea
          id="itemDescription"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe this item..."
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="defaultState">Default State</Label>
          <Select
            value={formData.defaultState}
            onValueChange={(value) => setFormData({ ...formData, defaultState: value as FFEItemState })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ITEM_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {state.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Linked Items (Optional)</Label>
          <div className="space-y-2">
            {(formData.linkedItems || []).map((linkedItem, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  value={linkedItem}
                  onChange={(e) => {
                    const newLinkedItems = [...(formData.linkedItems || [])];
                    newLinkedItems[index] = e.target.value;
                    setFormData({ ...formData, linkedItems: newLinkedItems });
                  }}
                  placeholder="Enter linked item name"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newLinkedItems = (formData.linkedItems || []).filter((_, i) => i !== index);
                    setFormData({ ...formData, linkedItems: newLinkedItems });
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const newLinkedItems = [...(formData.linkedItems || []), ''];
                setFormData({ ...formData, linkedItems: newLinkedItems });
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Linked Item
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isRequired"
          checked={formData.isRequired}
          onCheckedChange={(checked) => setFormData({ ...formData, isRequired: checked })}
        />
        <Label htmlFor="isRequired">Required Item</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="itemNotes">Notes (Optional)</Label>
        <Textarea
          id="itemNotes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes..."
          rows={2}
        />
      </div>

      <div className="flex items-center justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!formData.name.trim()}>
          Save Item
        </Button>
      </div>
    </form>
  );
}

// Custom Section Form Component
interface CustomSectionFormProps {
  onSave: (sectionName: string) => void;
  onCancel: () => void;
}

function CustomSectionForm({ onSave, onCancel }: CustomSectionFormProps) {
  const [sectionName, setSectionName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sectionName.trim()) {
      onSave(sectionName.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sectionName">Section Name</Label>
        <Input
          id="sectionName"
          value={sectionName}
          onChange={(e) => setSectionName(e.target.value)}
          placeholder="Enter section name (e.g., Fixtures, Decor, etc.)"
          required
          autoFocus
        />
      </div>
      
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!sectionName.trim()}>
          Create Section
        </Button>
      </div>
    </form>
  );
}

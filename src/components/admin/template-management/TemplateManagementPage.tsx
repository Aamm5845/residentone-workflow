'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Filter, Copy, Edit, Trash2, Eye, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFFETemplateStore } from '@/stores/ffe-template-store';
import { useFFEApi } from '@/hooks/ffe/useFFEApi';
import { TemplateEditor } from './TemplateEditor';
import { TemplateFilters } from './TemplateFilters';
import { TemplateCard } from './TemplateCard';
import { BulkActions } from './BulkActions';
import { LoadingState } from '@/components/ffe/v2/LoadingState';
import type { FFETemplate, RoomType } from '@/types/ffe-v2';

interface TemplateManagementPageProps {
  orgId: string;
  userRole: 'ADMIN' | 'DESIGNER' | 'FFE' | 'VIEWER';
}

export function TemplateManagementPage({ orgId, userRole }: TemplateManagementPageProps) {
  // Store and API hooks
  const {
    selectedTemplates,
    filters,
    setFilters,
    setSelectedTemplates,
    clearSelectedTemplates
  } = useFFETemplateStore();

  const {
    templates: templatesQuery,
    sections: sectionsQuery,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    copyTemplate
  } = useFFEApi(orgId);

  // Local state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FFETemplate | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Permissions - Allow all roles to edit templates, only restrict delete to ADMIN
  const canEdit = true; // All users can edit FFE templates
  const canDelete = userRole === 'ADMIN';

  // Use API data directly instead of syncing with store to avoid infinite loops

  // Filter templates based on current filters - use API data directly
  const filteredTemplates = useMemo(() => {
    const apiTemplates = templatesQuery.data || [];
    return apiTemplates.filter(template => {
      if (filters.roomType && template.roomType !== filters.roomType) {
        return false;
      }
      
      if (filters.isActive !== undefined && template.isActive !== filters.isActive) {
        return false;
      }

      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        return (
          template.name.toLowerCase().includes(query) ||
          template.description?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [templatesQuery.data, filters]);

  // Template statistics - use API data directly
  const stats = useMemo(() => {
    const apiTemplates = templatesQuery.data || [];
    const activeTemplates = apiTemplates.filter(t => t.isActive).length;
    const roomTypes = new Set(apiTemplates.map(t => t.roomType)).size;
    
    return {
      total: apiTemplates.length,
      active: activeTemplates,
      inactive: apiTemplates.length - activeTemplates,
      roomTypes
    };
  }, [templatesQuery.data]);

  // Handlers
  const handleCreateTemplate = () => {
    console.log('Create template clicked!');
    setEditingTemplate(null);
    setIsEditorOpen(true);
    console.log('Editor should be open:', true);
  };

  const handleEditTemplate = (template: FFETemplate) => {
    if (!canEdit) return;
    setEditingTemplate(template);
    setIsEditorOpen(true);
  };

  const handleCopyTemplate = async (template: FFETemplate) => {
    if (!canEdit) return;
    
    try {
      await copyTemplate.mutateAsync({
        id: template.id,
        name: `${template.name} (Copy)`
      });
    } catch (error) {
      console.error('Failed to copy template:', error);
    }
  };

  const handleDeleteTemplates = async (templateIds: string[]) => {
    if (!canDelete) return;
    
    try {
      await Promise.all(
        templateIds.map(id => deleteTemplate.mutateAsync(id))
      );
      clearSelectedTemplates();
    } catch (error) {
      console.error('Failed to delete templates:', error);
    }
  };

  const handleBulkStatusChange = async (templateIds: string[], isActive: boolean) => {
    if (!canEdit) return;
    
    try {
      await Promise.all(
        templateIds.map(id => 
          updateTemplate.mutateAsync({ id, data: { isActive } })
        )
      );
      clearSelectedTemplates();
    } catch (error) {
      console.error('Failed to update template status:', error);
    }
  };

  // Loading state
  if (templatesQuery.isLoading || sectionsQuery.isLoading) {
    return <LoadingState message="Loading template management..." />;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 m-4 mt-6 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Template Management
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage FFE templates for your organization
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {canEdit && (
              <Button onClick={handleCreateTemplate} className="gap-2">
                <Plus className="w-4 h-4" />
                New Template
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
            </Button>

            <Button
              variant="outline"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              size="sm"
            >
              {viewMode === 'grid' ? <Eye className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center space-x-6 mt-4">
          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{stats.total}</span> templates
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium text-green-600">{stats.active}</span> active
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-500">{stats.inactive}</span> inactive
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium text-blue-600">{stats.roomTypes}</span> room types
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 px-6 py-4 mx-4">
          <TemplateFilters
            filters={filters}
            onFiltersChange={setFilters}
            availableRoomTypes={Array.from(new Set((templatesQuery.data || []).map(t => t.roomType))) as RoomType[]}
          />
        </div>
      )}

      {/* Bulk Actions */}
      {selectedTemplates.length > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 mx-4">
          <BulkActions
            selectedCount={selectedTemplates.length}
            canEdit={canEdit}
            canDelete={canDelete}
            onStatusChange={handleBulkStatusChange}
            onDelete={() => handleDeleteTemplates(selectedTemplates)}
            onClearSelection={clearSelectedTemplates}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto mx-4 mb-6 bg-white rounded-b-lg p-6">
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'grid' | 'list')}>
          <TabsList className="hidden">
            <TabsTrigger value="grid">Grid</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>

          <TabsContent value="grid">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={selectedTemplates.includes(template.id)}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onSelect={(selected) => {
                    if (selected) {
                      setSelectedTemplates([...selectedTemplates, template.id]);
                    } else {
                      setSelectedTemplates(selectedTemplates.filter(id => id !== template.id));
                    }
                  }}
                  onEdit={() => handleEditTemplate(template)}
                  onCopy={() => handleCopyTemplate(template)}
                  onDelete={() => handleDeleteTemplates([template.id])}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="list">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">
                        Template
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">
                        Room Type
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">
                        Sections
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">
                        Updated
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTemplates.map((template) => (
                      <tr key={template.id} className="border-b border-gray-100">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium text-gray-900">
                              {template.name}
                            </div>
                            {template.description && (
                              <div className="text-sm text-gray-600 mt-1">
                                {template.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">
                            {template.roomType}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {template.sections?.length || 0} sections
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={template.isActive ? 'default' : 'secondary'}
                            className={template.isActive ? 'bg-green-100 text-green-800' : ''}
                          >
                            {template.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(template.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {canEdit && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditTemplate(template)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyTemplate(template)}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {canDelete && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-800"
                                onClick={() => handleDeleteTemplates([template.id])}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Empty state */}
        {filteredTemplates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Settings className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No templates found
            </h3>
            <p className="text-gray-600 text-center max-w-md mb-6">
              {(templatesQuery.data || []).length === 0 
                ? "Get started by creating your first FFE template."
                : "No templates match your current filters. Try adjusting your search criteria."
              }
            </p>
            {canEdit && (templatesQuery.data || []).length === 0 && (
              <Button onClick={handleCreateTemplate} className="gap-2">
                <Plus className="w-4 h-4" />
                Create First Template
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Template Editor Dialog */}
      <Dialog 
        open={isEditorOpen} 
        onOpenChange={(open) => {
          console.log('Dialog open state changed to:', open);
          if (!open) {
            console.log('Dialog closed by user');
            setEditingTemplate(null);
          }
          setIsEditorOpen(open);
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
          </DialogHeader>
          
          <TemplateEditor
            template={editingTemplate}
            sections={sectionsQuery.data || []}
            orgId={orgId}
            onSave={async (templateData) => {
              try {
                console.log('Saving template with data:', templateData);
                
                if (editingTemplate) {
                  const result = await updateTemplate.mutateAsync({
                    id: editingTemplate.id,
                    data: templateData
                  });
                  console.log('Template updated:', result);
                } else {
                  const result = await createTemplate.mutateAsync(templateData);
                  console.log('Template created:', result);
                }
                
                // Refresh the templates list
                templatesQuery.refetch();
                
                // Close the editor
                setIsEditorOpen(false);
                setEditingTemplate(null);
                
                console.log('Template save completed successfully');
              } catch (error) {
                console.error('Failed to save template:', error);
                // Don't close the dialog on error, let user try again
                alert('Failed to save template: ' + (error.message || 'Unknown error'));
              }
            }}
            onCancel={() => {
              console.log('Template editor cancelled');
              setIsEditorOpen(false);
              setEditingTemplate(null);
            }}
            isLoading={createTemplate.isLoading || updateTemplate.isLoading}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
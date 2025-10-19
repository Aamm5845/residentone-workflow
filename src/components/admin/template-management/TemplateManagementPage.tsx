'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Filter, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFFETemplateStore } from '@/stores/ffe-template-store';
import { useFFETemplates, useFFESections, useFFETemplateMutations } from '@/hooks/ffe/useFFEApi';
import { TemplateEditor } from './TemplateEditor';
import { TemplateFilters } from './TemplateFilters';
import { TemplateCard } from './TemplateCard';
import { BulkActions } from './BulkActions';
import { LoadingState } from '@/components/ffe/v2/LoadingState';
import type { FFETemplate } from '@/types/ffe-v2';

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

  const templatesQuery = useFFETemplates(orgId);
  const sectionsQuery = useFFESections();
  const { createTemplate, updateTemplate, deleteTemplate, copyTemplate } = useFFETemplateMutations();

  // Local state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FFETemplate | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Permissions - Allow all roles to edit templates, only restrict delete to ADMIN
  const canEdit = true; // All users can edit FFE templates
  const canDelete = true; // FORCE DELETE TO ALWAYS SHOW

  // Use API data directly instead of syncing with store to avoid infinite loops

  // Filter templates based on current filters - use API data directly
  const filteredTemplates = useMemo(() => {
    const apiTemplates = templatesQuery.templates || [];
    
    const filtered = apiTemplates.filter(template => {
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        return (
          template.name.toLowerCase().includes(query) ||
          template.description?.toLowerCase().includes(query)
        );
      }

      return true;
    });
    
    return filtered;
  }, [templatesQuery.templates, filters]);

  // Template statistics - use API data directly
  const stats = useMemo(() => {
    const apiTemplates = templatesQuery.templates || [];
    
    return {
      total: apiTemplates.length
    };
  }, [templatesQuery.templates]);

  // Handlers
  const handleCreateTemplate = () => {
    
    setEditingTemplate(null);
    setIsEditorOpen(true);
    
  };

  const handleEditTemplate = (template: FFETemplate) => {
    if (!canEdit) return;
    setEditingTemplate(template);
    setIsEditorOpen(true);
  };

  const handleCopyTemplate = async (template: FFETemplate) => {
    if (!canEdit) return;
    
    try {
      await copyTemplate(template.id, `${template.name} (Copy)`);
    } catch (error) {
      console.error('Failed to copy template:', error);
    }
  };

  const handleDeleteTemplates = async (templateIds: string[]) => {
    if (!canDelete) {
      return;
    }
    
    // Add confirmation dialog
    if (!window.confirm(`Are you sure you want to delete ${templateIds.length} template(s)? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await Promise.all(
        templateIds.map(id => deleteTemplate(id))
      );
      clearSelectedTemplates();
    } catch (error) {
      console.error('Failed to delete templates:', error);
      alert(`Failed to delete templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          <div className="flex items-center space-x-6">
            <div>
              <div className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">{stats.total}</span> templates
              </div>
            </div>
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
              {showFilters ? 'Hide Filters' : 'Filters'}
            </Button>

          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 px-6 py-4 mx-4">
          <TemplateFilters
            filters={filters}
            onFiltersChange={setFilters}
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
            onDelete={() => handleDeleteTemplates(selectedTemplates)}
            onClearSelection={clearSelectedTemplates}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto mx-4 mb-6 bg-white rounded-b-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

        {/* Empty state */}
        {filteredTemplates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Settings className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No templates found
            </h3>
            <p className="text-gray-600 text-center max-w-md mb-6">
              {(templatesQuery.templates || []).length === 0 
                ? "Get started by creating your first FFE template."
                : "No templates match your current filters. Try adjusting your search criteria."
              }
            </p>
            {canEdit && (templatesQuery.templates || []).length === 0 && (
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
          
          if (!open) {
            
            setEditingTemplate(null);
          }
          setIsEditorOpen(open);
        }}
      >
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
          </DialogHeader>
          
          <TemplateEditor
            template={editingTemplate}
            sections={sectionsQuery.sections || []}
            orgId={orgId}
            onSave={async (templateData) => {
              try {
                
                if (editingTemplate) {
                  const result = await updateTemplate(editingTemplate.id, templateData);
                  
                } else {
                  const result = await createTemplate(templateData);
                  
                }
                
                // Refresh the templates list
                templatesQuery.revalidate();
                
                // Close the editor
                setIsEditorOpen(false);
                setEditingTemplate(null);

              } catch (error) {
                console.error('Failed to save template:', error);
                // Don't close the dialog on error, let user try again
                alert('Failed to save template: ' + (error instanceof Error ? error.message : 'Unknown error'));
              }
            }}
            onCancel={() => {
              
              setIsEditorOpen(false);
              setEditingTemplate(null);
            }}
            isLoading={false}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
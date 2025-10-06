'use client';

import React from 'react';
import { Copy, Edit, Trash2, MoreHorizontal, Eye, Users } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { FFETemplate } from '@/types/ffe-v2';

interface TemplateCardProps {
  template: FFETemplate;
  isSelected: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onSelect: (selected: boolean) => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

export function TemplateCard({
  template,
  isSelected,
  canEdit,
  canDelete,
  onSelect,
  onEdit,
  onCopy,
  onDelete
}: TemplateCardProps) {
  const sectionsCount = template.sections?.length || 0;
  const itemsCount = template.sections?.reduce((total, section) => total + (section.items?.length || 0), 0) || 0;

  return (
    <Card className={`relative group transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
      {/* Selection Checkbox */}
      <div className="absolute top-3 left-3 z-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          className="bg-white shadow-sm"
        />
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between pt-6">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">
              {template.name}
            </h3>
            {template.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {template.description}
              </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit} disabled={!canEdit}>
                <Eye className="w-4 h-4 mr-2" />
                {canEdit ? 'Edit' : 'View'}
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem onClick={onCopy}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem 
                  onClick={onDelete}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center space-x-2 mt-3">
          <Badge variant="outline">
            {template.roomType}
          </Badge>
          <Badge
            variant={template.isActive ? 'default' : 'secondary'}
            className={template.isActive ? 'bg-green-100 text-green-800 border-green-200' : ''}
          >
            {template.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="py-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center text-gray-600">
            <Users className="w-4 h-4 mr-2" />
            <span>{sectionsCount} sections</span>
          </div>
          <div className="flex items-center text-gray-600">
            <Eye className="w-4 h-4 mr-2" />
            <span>{itemsCount} items</span>
          </div>
        </div>

        {template.sections && template.sections.length > 0 && (
          <div className="mt-3">
            <div className="text-xs text-gray-500 mb-2">Sections:</div>
            <div className="flex flex-wrap gap-1">
              {template.sections.slice(0, 3).map((section) => (
                <Badge key={section.id} variant="secondary" className="text-xs">
                  {section.name}
                </Badge>
              ))}
              {template.sections.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{template.sections.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3 border-t">
        <div className="flex items-center justify-between w-full text-xs text-gray-500">
          <span>
            Created: {new Date(template.createdAt).toLocaleDateString()}
          </span>
          <span>
            Updated: {new Date(template.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </CardFooter>

      {/* Quick Actions (shown on hover) */}
      <div className="absolute inset-x-0 bottom-0 bg-white border-t opacity-0 group-hover:opacity-100 transition-opacity p-3">
        <div className="flex items-center justify-center space-x-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            {canEdit ? <Edit className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
            {canEdit ? 'Edit' : 'View'}
          </Button>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={onCopy}>
              <Copy className="w-4 h-4 mr-1" />
              Copy
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
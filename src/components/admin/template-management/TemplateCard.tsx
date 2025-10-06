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
    <Card className={`relative group transition-all hover:shadow-lg h-full flex flex-col ${isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-gray-300'}`}>
      {/* Selection Checkbox */}
      <div className="absolute top-3 left-3 z-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          className="bg-white shadow-sm"
        />
      </div>

      <CardHeader className="pb-4 flex-grow">
        <div className="flex items-start justify-between pt-6 h-full">
          <div className="flex-1 min-w-0 pr-3 flex flex-col">
            <h3 className="font-semibold text-lg text-gray-900 mb-2 leading-tight">
              {template.name}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-3 flex-grow">
              {template.description || 'No description provided'}
            </p>
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

      </CardHeader>

      <CardContent className="py-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center">
            <span className="font-medium">{sectionsCount}</span>
            <span className="ml-1">sections</span>
          </div>
          <div className="flex items-center">
            <span className="font-medium">{itemsCount}</span>
            <span className="ml-1">items</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t bg-gray-50/50">
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
          {canDelete && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onDelete}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
'use client';

import React from 'react';
import { CheckSquare, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface BulkActionsProps {
  selectedCount: number;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: () => void;
  onClearSelection: () => void;
}

export function BulkActions({
  selectedCount,
  canEdit,
  canDelete,
  onDelete,
  onClearSelection
}: BulkActionsProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <CheckSquare className="w-4 h-4 text-blue-600" />
          <span className="font-medium text-gray-900">
            {selectedCount} template{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {canDelete && (
            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <Button
        size="sm"
        variant="ghost"
        onClick={onClearSelection}
        className="gap-2 text-gray-500 hover:text-gray-700"
      >
        <X className="w-4 h-4" />
        Clear Selection
      </Button>
    </div>
  );
}
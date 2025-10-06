'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RoomType } from '@/types/ffe-v2';

interface TemplateFiltersProps {
  filters: {
    searchQuery: string;
    roomType: RoomType | null;
    isActive: boolean | null;
  };
  onFiltersChange: (filters: any) => void;
  availableRoomTypes: RoomType[];
}

export function TemplateFilters({ filters, onFiltersChange, availableRoomTypes }: TemplateFiltersProps) {
  const activeFilterCount = [
    filters.searchQuery,
    filters.roomType,
    filters.isActive !== null
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    onFiltersChange({
      searchQuery: '',
      roomType: null,
      isActive: null
    });
  };

  const clearFilter = (key: string) => {
    onFiltersChange({
      ...filters,
      [key]: key === 'isActive' ? null : key === 'roomType' ? null : ''
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Filters</h3>
        {activeFilterCount > 0 && (
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">
              {activeFilterCount} active
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-gray-500 hover:text-gray-700"
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search templates..."
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
            className="pl-10"
          />
          {filters.searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => clearFilter('searchQuery')}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Room Type */}
        <div className="relative">
          <Select
            value={filters.roomType || 'all'}
            onValueChange={(value) => 
              onFiltersChange({ 
                ...filters, 
                roomType: value === 'all' ? null : value as RoomType 
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All room types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All room types</SelectItem>
              {availableRoomTypes.map((roomType) => (
                <SelectItem key={roomType} value={roomType}>
                  {roomType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filters.roomType && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-8 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => clearFilter('roomType')}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Status */}
        <div className="relative">
          <Select
            value={filters.isActive === null ? 'all' : filters.isActive ? 'active' : 'inactive'}
            onValueChange={(value) => 
              onFiltersChange({ 
                ...filters, 
                isActive: value === 'all' ? null : value === 'active' 
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="inactive">Inactive only</SelectItem>
            </SelectContent>
          </Select>
          {filters.isActive !== null && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-8 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => clearFilter('isActive')}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.searchQuery && (
            <Badge variant="outline" className="gap-2">
              Search: "{filters.searchQuery}"
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={() => clearFilter('searchQuery')}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
          
          {filters.roomType && (
            <Badge variant="outline" className="gap-2">
              Room: {filters.roomType}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={() => clearFilter('roomType')}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
          
          {filters.isActive !== null && (
            <Badge variant="outline" className="gap-2">
              Status: {filters.isActive ? 'Active' : 'Inactive'}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={() => clearFilter('isActive')}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
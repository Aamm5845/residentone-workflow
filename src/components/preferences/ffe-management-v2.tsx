'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings, ArrowRight, FileText, Workflow } from 'lucide-react';
import { TemplateManagementPage } from '@/components/admin/template-management/TemplateManagementPage';

interface FFEManagementV2Props {
  orgId: string;
  user: {
    id: string;
    name: string;
    role: 'ADMIN' | 'DESIGNER' | 'FFE' | 'VIEWER';
  };
}

export default function FFEManagementV2({ orgId, user }: FFEManagementV2Props) {
  const canManageTemplates = true; // All users can manage FFE templates

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FFE Management</h1>
          <p className="text-gray-600 mt-1">
            Manage your FFE templates and system configuration
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Template System v2.0
          </Badge>
          <Badge variant="outline">
            {user.role}
          </Badge>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Template Management</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground ml-auto" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Create and manage FFE templates for different room types. Templates define the structure and default items for FFE phases.
              </p>
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <span>• Room-specific templates</span>
                <span>• Section-based organization</span>
                <span>• Item state management</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <CardTitle className="text-base font-medium">FFE Workflow</CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground ml-auto" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Streamlined room-by-room FFE workflow with template selection, item completion tracking, and notes management.
              </p>
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <span>• Template selection</span>
                <span>• Progress tracking</span>
                <span>• Notes system</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How to Use */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How to Use the New FFE System</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">For Template Management:</h4>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start space-x-2">
                  <span className="bg-blue-100 text-blue-800 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium">1</span>
                  <span>Use the template management interface below to create and edit templates</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="bg-blue-100 text-blue-800 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium">2</span>
                  <span>Organize templates by room type (Bedroom, Bathroom, Kitchen, etc.)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="bg-blue-100 text-blue-800 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium">3</span>
                  <span>Add sections (Flooring, Lighting, etc.) and items to each template</span>
                </li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">For FFE Workflow:</h4>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start space-x-2">
                  <span className="bg-green-100 text-green-800 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium">1</span>
                  <span>Go to a project and select a room</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="bg-green-100 text-green-800 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium">2</span>
                  <span>Click on the FFE phase in the room timeline</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="bg-green-100 text-green-800 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium">3</span>
                  <span>Select a template or start blank, then complete items</span>
                </li>
              </ol>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="bg-blue-100 rounded-full p-1">
                <ArrowRight className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h5 className="font-medium text-blue-900">Ready to get started?</h5>
                <p className="text-blue-700 text-sm mt-1">
                  The template management interface below allows you to create and organize your FFE templates. 
                  Once created, these templates will be available when starting FFE phases in your projects.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permission Check */}
      {!canManageTemplates ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Template Management Access Required
              </h3>
              <p className="text-gray-600 mb-4">
                You need Admin or Designer permissions to manage FFE templates.
              </p>
              <div className="text-sm text-gray-500">
                Current role: <Badge variant="outline">{user.role}</Badge>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Contact your administrator to upgrade your permissions.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Template Management Interface */
        <div className="border rounded-lg">
          <TemplateManagementPage 
            orgId={orgId}
            userRole={user.role}
          />
        </div>
      )}
    </div>
  );
}
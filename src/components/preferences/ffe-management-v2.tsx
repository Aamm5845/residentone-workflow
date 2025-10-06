'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings } from 'lucide-react';
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">FFE Templates</h1>
        <p className="text-gray-600 mt-1">
          Create and manage FFE templates for your projects
        </p>
      </div>


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
        <TemplateManagementPage 
          orgId={orgId}
          userRole={user.role}
        />
      )}
    </div>
  );
}
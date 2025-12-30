'use client';

import React, { useState } from 'react';
import TemplatesManager from '@/components/templates/templates-manager';
import FFESectionPresets from '@/components/preferences/ffe-section-presets';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutTemplate, FolderCode } from 'lucide-react';

interface FFEManagementV2Props {
  orgId: string;
  user: {
    id: string;
    name: string;
    role: 'ADMIN' | 'DESIGNER' | 'FFE' | 'VIEWER';
  };
}

export default function FFEManagementV2({ orgId, user }: FFEManagementV2Props) {
  const [activeTab, setActiveTab] = useState('templates');

  return (
    <div className="h-[calc(100vh-12rem)]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
        <TabsList className="mb-4">
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="presets" className="flex items-center gap-2">
            <FolderCode className="w-4 h-4" />
            Section Presets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="h-[calc(100%-3rem)]">
          <TemplatesManager
            userId={user.id}
            orgId={orgId}
            userRole={user.role}
          />
        </TabsContent>

        <TabsContent value="presets" className="h-[calc(100%-3rem)] overflow-auto">
          <FFESectionPresets />
        </TabsContent>
      </Tabs>
    </div>
  );
}

'use client';

import React from 'react';
import TemplatesManager from '@/components/templates/templates-manager';

interface FFEManagementV2Props {
  orgId: string;
  user: {
    id: string;
    name: string;
    role: 'ADMIN' | 'DESIGNER' | 'FFE' | 'VIEWER';
  };
}

export default function FFEManagementV2({ orgId, user }: FFEManagementV2Props) {
  return (
    <div className="h-[calc(100vh-12rem)]">
      <TemplatesManager 
        userId={user.id}
        orgId={orgId}
        userRole={user.role}
      />
    </div>
  );
}

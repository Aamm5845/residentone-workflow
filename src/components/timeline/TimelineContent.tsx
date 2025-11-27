'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MyTimesheet } from './MyTimesheet'
import { TeamActivity } from './TeamActivity'
import { TimeReports } from './TimeReports'
import { Clock, Users, BarChart3 } from 'lucide-react'

interface TimelineContentProps {
  userId: string
  userRole: string
  isOwnerOrAdmin: boolean
}

export default function TimelineContent({ 
  userId, 
  userRole, 
  isOwnerOrAdmin 
}: TimelineContentProps) {
  const [activeTab, setActiveTab] = useState('timesheet')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="bg-white border border-gray-200 p-1">
        <TabsTrigger 
          value="timesheet" 
          className="flex items-center gap-2 data-[state=active]:bg-cyan-50 data-[state=active]:text-cyan-700"
        >
          <Clock className="w-4 h-4" />
          My Timesheet
        </TabsTrigger>
        <TabsTrigger 
          value="team" 
          className="flex items-center gap-2 data-[state=active]:bg-cyan-50 data-[state=active]:text-cyan-700"
        >
          <Users className="w-4 h-4" />
          Team Activity
        </TabsTrigger>
        {isOwnerOrAdmin && (
          <TabsTrigger 
            value="reports" 
            className="flex items-center gap-2 data-[state=active]:bg-cyan-50 data-[state=active]:text-cyan-700"
          >
            <BarChart3 className="w-4 h-4" />
            Reports
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="timesheet" className="mt-0">
        <MyTimesheet userId={userId} />
      </TabsContent>

      <TabsContent value="team" className="mt-0">
        <TeamActivity />
      </TabsContent>

      {isOwnerOrAdmin && (
        <TabsContent value="reports" className="mt-0">
          <TimeReports />
        </TabsContent>
      )}
    </Tabs>
  )
}

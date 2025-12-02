'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MyTimesheet } from './MyTimesheet'
import { Users, User, Loader2 } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function TeamTimesheets() {
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  // Fetch all team members
  const { data: teamData, isLoading: loadingTeam } = useSWR('/api/team', fetcher)
  const teamMembers = teamData?.users || []

  // Get selected user info
  const selectedUser = teamMembers.find((m: any) => m.id === selectedUserId)

  // Debug: Always show this first
  console.log('TeamTimesheets rendering, loadingTeam:', loadingTeam, 'teamMembers:', teamMembers.length)

  if (loadingTeam) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
        <span className="ml-2 text-gray-600">Loading team members...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Team Member Selector */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-600" />
            View Team Member Timesheet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 w-full sm:max-w-md">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-full h-12">
                  <SelectValue placeholder="Select a team member to view their timesheet..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {teamMembers.map((member: any) => (
                    <SelectItem 
                      key={member.id} 
                      value={member.id}
                      className="py-3"
                    >
                      <span className="font-medium">{member.name || member.email || 'Unnamed'}</span>
                      <span className="text-xs text-gray-500 ml-2">({member.role})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUser && (
              <div className="flex items-center gap-3 px-4 py-2 bg-cyan-50 rounded-lg border border-cyan-200">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={selectedUser.image} alt={selectedUser.name} />
                  <AvatarFallback className="bg-cyan-600 text-white">
                    {selectedUser.name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-cyan-900">{selectedUser.name}</p>
                  <p className="text-sm text-cyan-700">{selectedUser.email}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Selected User's Timesheet */}
      {selectedUserId ? (
        <div className="relative">
          {/* Header showing whose timesheet */}
          <div className="mb-4 flex items-center gap-2 text-gray-600">
            <User className="w-4 h-4" />
            <span>Viewing <strong className="text-gray-900">{selectedUser?.name}</strong>'s timesheet</span>
          </div>
          
          {/* Reuse MyTimesheet component with selected user ID */}
          <MyTimesheet userId={selectedUserId} />
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Select a Team Member
            </h3>
            <p className="text-gray-600 max-w-md">
              Choose a team member from the dropdown above to view their full timesheet, 
              including daily hours, weekly totals, and all time entries.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


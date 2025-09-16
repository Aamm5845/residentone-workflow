'use client'

interface TeamManagementClientProps {
  teamMembers: any[]
  currentUser: any
}

export default function TeamManagementClient({ teamMembers, currentUser }: TeamManagementClientProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h2>
      <div className="space-y-4">
        {teamMembers.map((member) => (
          <div key={member.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">{member.name}</h3>
              <p className="text-sm text-gray-600">{member.email}</p>
              <p className="text-sm text-gray-500">Role: {member.role}</p>
            </div>
            <div className="text-sm text-gray-500">
              {member._count.assignedStages} active stages
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          Team management interface is being enhanced. More features coming soon!
        </p>
      </div>
    </div>
  )
}

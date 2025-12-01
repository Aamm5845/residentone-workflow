// Changelog data - Add new updates at the TOP of the array
// The first item is always the newest

export interface ChangelogEntry {
  id: string // Unique ID for tracking "seen" status
  version?: string // Optional version number
  date: string // Date in format "December 1, 2025"
  title: string
  description: string
  type: 'feature' | 'improvement' | 'fix' | 'announcement'
  highlights?: string[] // Bullet points
}

export const changelog: ChangelogEntry[] = [
  // ⬇️ ADD NEW UPDATES HERE (at the top) ⬇️
  {
    id: 'update-2024-12-01-project-updates',
    date: 'December 1, 2025',
    title: '📸 Project Updates & On-Site Surveys',
    description: 'Keep everyone in the loop! Post project progress updates in the Overview section and capture on-site photos with our new Survey feature.',
    type: 'feature',
    highlights: [
      'Post updates in Project Overview to share where the project is at',
      'Start an on-site photo survey directly from the app',
      'All photos automatically saved & uploaded to Dropbox (7- folders)',
      'Tag images with notes and labels for easy reference',
      'Track project milestones and share progress with the team'
    ]
  },
  {
    id: 'update-2024-12-01-timeline',
    date: 'December 1, 2025',
    title: '⏱️ Time Tracking is Here!',
    description: 'Track your work hours on each project and see what your team is currently working on in real-time.',
    type: 'feature',
    highlights: [
      'Start timer from dashboard or any phase',
      'See what teammates are working on',
      'Manual timesheet entries',
      'Track project costs accurately'
    ]
  },
  {
    id: 'update-2024-11-30-password',
    date: 'November 30, 2025',
    title: '🔐 Password Management',
    description: 'Team members can now change their password from the preferences page and use forgot password on sign-in.',
    type: 'feature',
    highlights: [
      'Change password in Team Preferences → Security',
      'Forgot password on sign-in page',
      'Email confirmation when password changed'
    ]
  },
  // Add more entries above this line
]

// Helper to get the latest update ID for badge tracking
export const getLatestUpdateId = () => changelog[0]?.id || ''

// Helper to count unseen updates
export const countUnseenUpdates = (seenIds: string[]): number => {
  return changelog.filter(entry => !seenIds.includes(entry.id)).length
}

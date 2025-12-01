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
    id: 'update-2024-12-01-auto-refresh',
    date: 'December 1, 2025',
    title: 'Auto-Update for Desktop App',
    description: 'The app will now automatically refresh when updates are available and you\'re not actively working.',
    type: 'improvement',
    highlights: [
      'Checks for updates every 5 minutes',
      'Auto-refreshes after 3 minutes of inactivity',
      'Shows notification if you\'re actively working',
      'No more manual refreshing needed!'
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
    id: 'update-2024-12-01-mentions',
    date: 'December 1, 2025',
    title: '@Mentions with Email Notifications',
    description: 'Mention team members in Floorplan chat and they\'ll receive email notifications.',
    type: 'feature',
    highlights: [
      'Type @ to see team members',
      'Email sent to mentioned users',
      'Works in Floorplan Drawings chat'
    ]
  },
  {
    id: 'update-2024-11-30-password',
    date: 'November 30, 2025',
    title: 'Password Management',
    description: 'Team members can now change their password from the preferences page and use forgot password on sign-in.',
    type: 'feature',
    highlights: [
      'Change password in Team Preferences → Security',
      'Forgot password on sign-in page',
      'Email confirmation when password changed',
      'Case-insensitive email login'
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


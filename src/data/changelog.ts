// Changelog data - Add new updates at the TOP of the array
// The first item is always the newest

export interface ChangelogEntry {
  id: string // Unique ID for tracking "seen" status
  version?: string // Optional version number
  date: string // Date in format "December 1, 2025"
  title: string
  description: string
  type: 'feature' | 'improvement' | 'fix' | 'announcement'
  icon?: 'camera' | 'clock' | 'lock' | 'megaphone' | 'zap' | 'wrench' | 'star' | 'bell' // Optional icon name
  highlights?: string[] // Bullet points
  link?: { // Optional link to the feature
    href: string
    label: string
  }
}

export const changelog: ChangelogEntry[] = [
  // ⬇️ ADD NEW UPDATES HERE (at the top) ⬇️
  {
    id: 'update-2024-12-01-project-updates',
    date: 'December 1, 2025',
    title: 'Project Updates & On-Site Surveys',
    description: 'Keep everyone in the loop! Post project progress updates and capture on-site photos with the Site Survey feature.',
    type: 'feature',
    icon: 'camera',
    highlights: [
      'Post updates in Project Overview to share where the project is at',
      'Start Site Survey to capture on-site photos & videos',
      'Photos saved to Dropbox: Project Folder → 7- SOURCES → Site Photos → Date',
      'Tag photos with room names, trade categories & notes',
      'Mark photos as Before/After for easy comparison',
      'View all media in the Photos tab with full details'
    ],
    link: {
      href: '/projects',
      label: 'Go to Projects → Select a Project → Project Updates'
    }
  },
  {
    id: 'update-2024-12-01-timeline',
    date: 'December 1, 2025',
    title: 'Time Tracking is Here!',
    description: 'Track your work hours on each project and see what your team is currently working on in real-time.',
    type: 'feature',
    icon: 'clock',
    highlights: [
      'Start timer from dashboard or any phase',
      'See what teammates are working on',
      'Manual timesheet entries',
      'Track project costs accurately'
    ],
    link: {
      href: '/timeline',
      label: 'Open Timeline'
    }
  },
  {
    id: 'update-2024-11-30-password',
    date: 'November 30, 2025',
    title: 'Password Management',
    description: 'Team members can now change their password from the preferences page and use forgot password on sign-in.',
    type: 'feature',
    icon: 'lock',
    highlights: [
      'Change password in Team Preferences → Security',
      'Forgot password on sign-in page',
      'Email confirmation when password changed'
    ],
    link: {
      href: '/team',
      label: 'Go to Team → Click your name → Security tab'
    }
  },
  // Add more entries above this line
]

// Helper to get the latest update ID for badge tracking
export const getLatestUpdateId = () => changelog[0]?.id || ''

// Helper to count unseen updates
export const countUnseenUpdates = (seenIds: string[]): number => {
  return changelog.filter(entry => !seenIds.includes(entry.id)).length
}

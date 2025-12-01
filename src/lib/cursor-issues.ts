import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

interface CursorIssue {
  id: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  reportedBy: string
  reporterName: string | null
  reporterEmail: string
  createdAt: string
  projectName?: string | null
  roomName?: string | null
  stageName?: string | null
  imageUrl?: string | null
  consoleLog?: string | null
}

interface CursorIssuesFile {
  lastUpdated: string
  openCount: number
  issues: CursorIssue[]
}

/**
 * Sync open issues to .cursor/issues.json so Cursor AI can access them
 */
export async function syncIssuesToCursor(): Promise<void> {
  try {
    // Fetch all open issues
    const issues = await prisma.issue.findMany({
      where: {
        status: {
          in: ['OPEN', 'IN_PROGRESS']
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        reporter: {
          select: {
            name: true,
            email: true
          }
        },
        project: {
          select: {
            name: true
          }
        },
        room: {
          select: {
            name: true,
            type: true
          }
        },
        stage: {
          select: {
            type: true
          }
        }
      }
    })

    // Transform to simpler format for Cursor
    const cursorIssues: CursorIssue[] = issues.map(issue => ({
      id: issue.id,
      title: issue.title,
      description: issue.description,
      type: issue.type,
      priority: issue.priority,
      status: issue.status,
      reportedBy: issue.reportedBy,
      reporterName: issue.reporter.name,
      reporterEmail: issue.reporter.email,
      createdAt: issue.createdAt.toISOString(),
      projectName: issue.project?.name,
      roomName: issue.room?.name || issue.room?.type,
      stageName: issue.stage?.type,
      imageUrl: (issue.metadata as any)?.imageUrl,
      consoleLog: (issue.metadata as any)?.consoleLog
    }))

    const data: CursorIssuesFile = {
      lastUpdated: new Date().toISOString(),
      openCount: cursorIssues.length,
      issues: cursorIssues
    }

    // Write to .cursor/issues.json
    const cursorDir = path.join(process.cwd(), '.cursor')
    const issuesPath = path.join(cursorDir, 'issues.json')

    // Ensure .cursor directory exists
    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true })
    }

    fs.writeFileSync(issuesPath, JSON.stringify(data, null, 2))
    console.log(`[Cursor Issues] Synced ${cursorIssues.length} open issues to .cursor/issues.json`)
  } catch (error) {
    console.error('[Cursor Issues] Failed to sync issues:', error)
    // Don't throw - this is a nice-to-have feature, not critical
  }
}


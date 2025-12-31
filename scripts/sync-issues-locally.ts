/**
 * Script to sync issues from production API to .cursor/issues.json
 * This allows Cursor AI to read and help fix the issues
 * 
 * Usage: npx ts-node scripts/sync-issues-locally.ts
 * Or add to package.json: "sync-issues": "ts-node scripts/sync-issues-locally.ts"
 */

import * as fs from 'fs'
import * as path from 'path'

interface Issue {
  id: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  createdAt: string
  reporter: {
    name: string
    email: string
  }
  project?: {
    name: string
  }
  room?: {
    name: string
    type: string
  }
  stage?: {
    type: string
  }
  metadata?: {
    imageUrl?: string
    consoleLog?: string
  }
}

interface CursorIssue {
  id: string
  title: string
  description: string
  type: string
  priority: string
  status: string
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

async function syncIssues() {
  const PRODUCTION_URL = 'https://app.meisnerinteriors.com'
  
  console.log('🔄 Fetching issues from production...')
  
  try {
    // Fetch issues from production API (public endpoint for open issues)
    const response = await fetch(`${PRODUCTION_URL}/api/issues?status=OPEN`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch issues: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    const issues: Issue[] = data.issues || []
    
    console.log(`📋 Found ${issues.length} open issues`)
    
    // Transform to Cursor format
    const cursorIssues: CursorIssue[] = issues.map(issue => ({
      id: issue.id,
      title: issue.title,
      description: issue.description,
      type: issue.type,
      priority: issue.priority,
      status: issue.status,
      reporterName: issue.reporter?.name || null,
      reporterEmail: issue.reporter?.email || '',
      createdAt: issue.createdAt,
      projectName: issue.project?.name || null,
      roomName: issue.room?.name || issue.room?.type || null,
      stageName: issue.stage?.type || null,
      imageUrl: issue.metadata?.imageUrl || null,
      consoleLog: issue.metadata?.consoleLog || null,
    }))
    
    // Sort by priority and date
    const priorityOrder: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
    cursorIssues.sort((a, b) => {
      const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
      if (priorityDiff !== 0) return priorityDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    
    const cursorData: CursorIssuesFile = {
      lastUpdated: new Date().toISOString(),
      openCount: cursorIssues.length,
      issues: cursorIssues,
    }
    
    // Write to .cursor/issues.json
    const cursorDir = path.join(process.cwd(), '.cursor')
    const issuesPath = path.join(cursorDir, 'issues.json')
    
    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true })
    }
    
    fs.writeFileSync(issuesPath, JSON.stringify(cursorData, null, 2))
    
    console.log(`✅ Synced ${cursorIssues.length} issues to .cursor/issues.json`)
    console.log('')
    console.log('📊 Issues Summary:')
    
    // Print summary by type and priority
    const byType: Record<string, number> = {}
    const byPriority: Record<string, number> = {}
    
    cursorIssues.forEach(issue => {
      byType[issue.type] = (byType[issue.type] || 0) + 1
      byPriority[issue.priority] = (byPriority[issue.priority] || 0) + 1
    })
    
    console.log('  By Type:', byType)
    console.log('  By Priority:', byPriority)
    console.log('')
    console.log('Top issues:')
    cursorIssues.slice(0, 5).forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.priority}] ${issue.title}`)
    })
    
  } catch (error) {
    console.error('❌ Failed to sync issues:', error)
    process.exit(1)
  }
}

syncIssues()





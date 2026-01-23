/**
 * Utility to trigger GitHub Actions workflows
 */

interface TriggerAutoFixParams {
  issueId: string
  title: string
  description: string
  type: string
  priority: string
  consoleLog?: string
  projectName?: string
  roomName?: string
  reporterName?: string
}

/**
 * Trigger the auto-fix GitHub Actions workflow for urgent issues
 */
export async function triggerAutoFixWorkflow(params: TriggerAutoFixParams): Promise<boolean> {
  const githubToken = process.env.GITHUB_TOKEN
  const githubRepo = process.env.GITHUB_REPO // Format: "owner/repo"

  if (!githubToken || !githubRepo) {
    console.error('[GitHub Actions] Missing GITHUB_TOKEN or GITHUB_REPO env vars')
    return false
  }

  const [owner, repo] = githubRepo.split('/')
  if (!owner || !repo) {
    console.error('[GitHub Actions] Invalid GITHUB_REPO format. Expected: owner/repo')
    return false
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/dispatches`

  try {
    console.log(`[GitHub Actions] Triggering auto-fix for issue: ${params.issueId}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event_type: 'urgent-issue',
        client_payload: {
          issueId: params.issueId,
          title: params.title,
          description: params.description,
          type: params.type,
          priority: params.priority,
          consoleLog: params.consoleLog || '',
          projectName: params.projectName || '',
          roomName: params.roomName || '',
          reporterName: params.reporterName || ''
        }
      })
    })

    if (response.status === 204 || response.status === 200) {
      console.log(`[GitHub Actions] Successfully triggered auto-fix workflow`)
      return true
    } else {
      const errorText = await response.text()
      console.error(`[GitHub Actions] Failed to trigger workflow: ${response.status} - ${errorText}`)
      return false
    }
  } catch (error) {
    console.error('[GitHub Actions] Error triggering workflow:', error)
    return false
  }
}

/**
 * Check if auto-fix should be triggered for this issue
 */
export function shouldTriggerAutoFix(priority: string, type: string): boolean {
  // Only trigger for HIGH and URGENT priority
  if (priority !== 'HIGH' && priority !== 'URGENT') {
    return false
  }

  // Check if auto-fix is enabled
  const autoFixEnabled = process.env.AUTO_FIX_ENABLED !== 'false'

  return autoFixEnabled
}

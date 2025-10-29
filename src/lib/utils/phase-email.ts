interface PhaseEmailResponse {
  success: boolean
  message?: string
  error?: string
  details?: string
  emailInfo?: {
    recipient: {
      name: string
      email: string
    }
    subject: string
    preview: string
    phase: string
    project: string
  }
}

/**
 * Send phase ready email to the next phase assignee
 */
export async function sendPhaseEmail(stageId: string): Promise<PhaseEmailResponse> {
  try {
    const response = await fetch('/api/notifications/phase-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        stageId
      })
    })

    const data = await response.json()

    if (response.ok) {
      return {
        success: true,
        message: data.message,
        emailInfo: data.emailInfo
      }
    } else {
      return {
        success: false,
        error: data.error || 'Failed to send email',
        details: data.details,
        emailInfo: data.emailInfo
      }
    }
  } catch (error) {
    return {
      success: false,
      error: 'Network error occurred while sending email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getOpenAI, isOpenAIConfigured } from '@/lib/server/openai'

export const dynamic = 'force-dynamic'

// Rate limiting: Store last request timestamp per project
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_MS = 60000 // 1 minute

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId } = await params

    // Check if OpenAI is configured
    if (!isOpenAIConfigured()) {
      return NextResponse.json(
        { 
          error: 'AI features are not configured. Please add OPENAI_API_KEY to environment variables.' 
        },
        { status: 503 }
      )
    }

    // Rate limiting check
    const rateLimitKey = `${session.user.id}-${projectId}`
    const lastRequest = rateLimitMap.get(rateLimitKey)
    const now = Date.now()

    if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
      const remainingSeconds = Math.ceil((RATE_LIMIT_MS - (now - lastRequest)) / 1000)
      return NextResponse.json(
        { 
          error: `Please wait ${remainingSeconds} seconds before requesting another summary.` 
        },
        { status: 429 }
      )
    }

    // Update rate limit timestamp
    rateLimitMap.set(rateLimitKey, now)

    // Fetch project with all rooms and stages including assignees
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
      },
      include: {
        client: true,
        rooms: {
          include: {
            stages: {
              include: {
                assignedUser: {
                  select: {
                    name: true
                  }
                },
                clientApprovalVersions: {
                  take: 1,
                  orderBy: {
                    createdAt: 'desc'
                  }
                }
              }
            }
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Build detailed room and stage information
    const roomDetails: string[] = []
    const waitingFor: string[] = []
    const completed: string[] = []
    const inProgress: string[] = []
    
    project.rooms.forEach(room => {
      room.stages.forEach(stage => {
        // Map stage types to readable names
        const phaseNames: Record<string, string> = {
          'DESIGN_CONCEPT': 'Design Concept',
          'THREE_D': '3D Rendering',
          'RENDERING': '3D Rendering',
          'CLIENT_APPROVAL': 'Client Approval',
          'DRAWINGS': 'Drawings',
          'FFE': 'FFE'
        }
        const phaseName = phaseNames[stage.type] || stage.type.replace(/_/g, ' ')
        
        if (stage.status === 'COMPLETED') {
          completed.push(`${room.name} - ${phaseName}`)
        } else if (stage.status === 'IN_PROGRESS') {
          const assignee = (stage as any).assignedUser?.name || 'team'
          inProgress.push(`${room.name} - ${phaseName} (${assignee} working on it)`)
        } else if (stage.status === 'PENDING_APPROVAL' || ((stage as any).clientApprovalVersions?.length > 0)) {
          const assignee = (stage as any).assignedUser?.name || 'client'
          waitingFor.push(`${room.name} - ${phaseName} waiting for ${assignee} approval`)
        } else if (stage.status === 'REVISION_REQUESTED') {
          const assignee = (stage as any).assignedUser?.name || 'team'
          waitingFor.push(`${room.name} - ${phaseName} needs revisions from ${assignee}`)
        }
      })
    })

    // Build concise, actionable prompt
    const prompt = `Summarize the ${project.name} project for ${project.client.name} in 3-4 concise sentences.

Recently Completed:
${completed.slice(0, 3).map(item => `- ${item}`).join('\n') || '- None yet'}

Currently In Progress:
${inProgress.slice(0, 4).map(item => `- ${item}`).join('\n') || '- None'}

Waiting For:
${waitingFor.slice(0, 4).map(item => `- ${item}`).join('\n') || '- None'}

Write a brief, direct summary. Mention specific rooms by name. Say who is working on what or who needs to approve what. Use simple language. Be factual and actionable.`

    console.log('[AI Project Summary] Generating summary for:', project.name)
    console.log('[AI Project Summary] Completed:', completed.length, 'In Progress:', inProgress.length, 'Waiting:', waitingFor.length)

    // Generate AI summary using OpenAI
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-efficient model
      messages: [
        {
          role: 'system',
          content: 'You are a concise project manager. Write brief, specific summaries mentioning actual room names and people. Use simple, direct language. No fluff or corporate speak.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 250
    })

    const summary = response.choices[0]?.message?.content || 'Unable to generate summary.'

    console.log('[AI Project Summary] Summary generated successfully')

    return NextResponse.json({
      summary,
      projectName: project.name,
      clientName: project.client.name,
      generatedAt: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('[AI Project Summary] Error:', error)

    // Handle OpenAI-specific errors
    if (error?.error?.type === 'insufficient_quota') {
      return NextResponse.json(
        { error: 'OpenAI API quota exceeded. Please check your billing.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate AI summary. Please try again later.' },
      { status: 500 }
    )
  }
}

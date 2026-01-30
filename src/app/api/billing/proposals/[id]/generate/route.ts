import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getOpenAI, isOpenAIConfigured } from '@/lib/server/openai'
import { z } from 'zod'

const generateSchema = z.object({
  customInstructions: z.string().optional(),
  includeTimeline: z.boolean().default(true),
  includePricing: z.boolean().default(true),
  includeTerms: z.boolean().default(true),
})

interface AuthSession {
  user: {
    id: string
    orgId: string
    role: string
  }
}

// Helper to check billing access
async function canAccessBilling(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, canSeeBilling: true },
  })
  return user?.role === 'OWNER' || user?.canSeeBilling === true
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await context.params
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await canAccessBilling(session.user.id))) {
      return NextResponse.json({ error: 'No billing access' }, { status: 403 })
    }

    if (!isOpenAIConfigured()) {
      return NextResponse.json({
        error: 'AI generation is not configured. Please add OPENAI_API_KEY to environment variables.'
      }, { status: 503 })
    }

    const body = await request.json()
    const { customInstructions, includeTimeline, includePricing, includeTerms } = generateSchema.parse(body)

    // Get proposal with project context
    const proposal = await prisma.proposal.findFirst({
      where: {
        id: proposalId,
        orgId: session.user.orgId,
      },
      include: {
        project: {
          include: {
            client: true,
            rooms: {
              select: {
                id: true,
                type: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Get organization info for business context
    const org = await prisma.organization.findFirst({
      where: { id: session.user.orgId },
      select: {
        name: true,
        businessName: true,
      },
    })

    // Build context for AI
    const projectContext = {
      projectName: proposal.project.name,
      projectType: proposal.project.type,
      clientName: proposal.clientName || proposal.project.client.name,
      rooms: proposal.project.rooms.map(r => r.name || r.type).join(', '),
      roomCount: proposal.project.rooms.length,
      companyName: org?.businessName || org?.name || 'Our Company',
    }

    const openai = getOpenAI()

    const systemPrompt = `You are an expert interior design business consultant helping create professional proposals.
Generate proposal content that is professional, clear, and persuasive.
The content should be tailored for interior design projects.
Use Canadian English spelling.
Be specific and detailed but concise.

Company: ${projectContext.companyName}
Project: ${projectContext.projectName}
Project Type: ${projectContext.projectType}
Client: ${projectContext.clientName}
Rooms: ${projectContext.rooms} (${projectContext.roomCount} total)

Generate the proposal content in JSON format with the following structure:
{
  "scope": "A detailed project scope description (2-3 paragraphs)",
  "deliverables": [
    { "title": "Deliverable name", "description": "Brief description" }
  ],
  ${includeTimeline ? '"timeline": "Estimated project timeline description",' : ''}
  ${includePricing ? '"pricing": { "notes": "Pricing notes and payment terms" },' : ''}
  ${includeTerms ? '"terms": "Standard terms and conditions for interior design services"' : ''}
}`

    const userPrompt = customInstructions
      ? `Generate a professional interior design proposal with these additional instructions: ${customInstructions}`
      : 'Generate a professional interior design proposal based on the project context provided.'

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      return NextResponse.json({ error: 'AI did not generate content' }, { status: 500 })
    }

    let generatedContent
    try {
      generatedContent = JSON.parse(responseText)
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    // Update the proposal with generated content
    const updatedProposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        content: generatedContent,
      },
    })

    // Log activity
    await prisma.proposalActivity.create({
      data: {
        proposalId: proposalId,
        type: 'AI_GENERATED',
        message: 'Content generated using AI',
        metadata: { customInstructions: customInstructions || null },
      },
    })

    return NextResponse.json({
      success: true,
      content: generatedContent,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Error generating proposal:', error)
    return NextResponse.json({ error: 'Failed to generate proposal content' }, { status: 500 })
  }
}

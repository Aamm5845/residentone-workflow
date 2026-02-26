import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { isValidAuthSession } from '@/lib/attribution'
import { getClaude } from '@/lib/server/claude'

/**
 * Generate a short, natural project overview for a proposal
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      projectName,
      projectType,
      clientName,
      designDescription,
      whatToInclude,
      whatNotToInclude,
      scopeItems,
      currentOverview,
    } = body

    if (!designDescription && !scopeItems?.length) {
      return NextResponse.json(
        { error: 'Provide a design description or scope items' },
        { status: 400 }
      )
    }

    const scopeList = scopeItems?.length
      ? scopeItems.map((s: any) => s.title).join(', ')
      : ''

    const claude = getClaude()
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `You write short project overviews for Meisner Interiors, a high-end interior design firm in Montreal.

Write exactly 2-3 sentences that describe what this project is and what design services will be provided.

Rules:
- Sound like a real person wrote it, not AI. No filler, no fluff.
- Be specific to the project — mention the actual spaces or areas involved.
- Don't start with "This project..." — vary your openings.
- Keep it under 60 words. Short and clear.
- No bullet points, just flowing sentences.
- Don't be overly enthusiastic or use words like "transform", "elevate", "stunning", "breathe life into".
- Write like you're briefly explaining the project to a colleague.`,
      messages: [
        {
          role: 'user',
          content: `Write a brief project overview for:

PROJECT: ${projectName}
TYPE: ${projectType || 'Interior Design'}
CLIENT: ${clientName}
${designDescription ? `DESCRIPTION: ${designDescription}` : ''}
${whatToInclude ? `INCLUDED SERVICES: ${whatToInclude}` : ''}
${whatNotToInclude ? `NOT INCLUDED: ${whatNotToInclude}` : ''}
${scopeList ? `PHASES: ${scopeList}` : ''}
${currentOverview ? `CURRENT OVERVIEW (improve this): ${currentOverview}` : ''}

Return ONLY the overview text, nothing else.`
        }
      ]
    })

    const overview = response.content[0].type === 'text'
      ? response.content[0].text.trim().replace(/^["']|["']$/g, '')
      : ''

    return NextResponse.json({ overview })
  } catch (error) {
    console.error('Error generating overview:', error)
    return NextResponse.json({ error: 'Failed to generate overview' }, { status: 500 })
  }
}

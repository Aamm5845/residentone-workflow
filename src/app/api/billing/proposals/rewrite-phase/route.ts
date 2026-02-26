import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { isValidAuthSession } from '@/lib/attribution'
import { getClaude } from '@/lib/server/claude'

/**
 * Rewrite a single phase description with an optional user instruction
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      phaseTitle,
      currentDescription,
      instruction,
      projectName,
      designDescription,
      whatToInclude,
      whatNotToInclude,
    } = body

    if (!phaseTitle) {
      return NextResponse.json({ error: 'Phase title is required' }, { status: 400 })
    }

    const claude = getClaude()
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system: `You rewrite phase descriptions for interior design proposals at Meisner Interiors, a high-end firm in Montreal.

Rules:
- Write 1-2 clear sentences. Be specific, not generic.
- Sound like a real person, not AI.
- Be direct — say what we'll do and why it matters.
- Don't start with "This phase..." or "In this phase..."
- Avoid words like "transform", "elevate", "stunning".
- Write like you're explaining to a client over coffee.`,
      messages: [
        {
          role: 'user',
          content: `Rewrite the description for this phase:

PHASE: ${phaseTitle}
${currentDescription ? `CURRENT DESCRIPTION: ${currentDescription}` : ''}
${projectName ? `PROJECT: ${projectName}` : ''}
${designDescription ? `PROJECT DESCRIPTION: ${designDescription}` : ''}
${whatToInclude ? `INCLUDED SERVICES: ${whatToInclude}` : ''}
${whatNotToInclude ? `NOT INCLUDED: ${whatNotToInclude}` : ''}
${instruction ? `USER INSTRUCTION: ${instruction}` : ''}

Return ONLY the new description text, nothing else.`
        }
      ]
    })

    const description = response.content[0].type === 'text'
      ? response.content[0].text.trim().replace(/^["']|["']$/g, '')
      : ''

    return NextResponse.json({ description })
  } catch (error) {
    console.error('Error rewriting phase:', error)
    return NextResponse.json({ error: 'Failed to rewrite phase' }, { status: 500 })
  }
}
